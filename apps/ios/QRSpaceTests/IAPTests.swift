import StoreKit
import StoreKitTest
import XCTest
@testable import QRSpace

/// Apple in-app purchases end to end against the LOCAL dev server: Xcode's StoreKit testing (QRSpace.storekit, no
/// dialogs) → the app's Store → POST /api/iap (the dev server runs with IAP_ALLOW_XCODE=1) → what the server granted.
/// Skipped unless both are set — it never runs against production:
///   TEST_RUNNER_QR_IAP=1 TEST_RUNNER_QR_API_BASE=http://localhost:3720 xcodebuild … -only-testing:QRSpaceTests/IAPTests test
@MainActor
final class IAPTests: XCTestCase {
    private var session: SKTestSession!

    override func setUp() async throws {
        let env = ProcessInfo.processInfo.environment
        guard env["QR_IAP"] == "1", ["localhost", "127.0.0.1"].contains(AppConfig.base.host ?? "") else {
            throw XCTSkip("IAP end-to-end: set TEST_RUNNER_QR_IAP=1 and TEST_RUNNER_QR_API_BASE=http://localhost:3720")
        }
        session = try SKTestSession(configurationFileNamed: "QRSpace")
        session.disableDialogs = true
        session.clearTransactions()
        try await API.shared.signIn(personId: "arman") // a demo person on the local server
        await Store.shared.loadProducts()
        XCTAssertTrue(Store.shared.ready, "products didn't load from QRSpace.storekit")
    }

    /// Prices come from the store (displayPrice), never our "$1".
    func testPricesFromTheStore() {
        XCTAssertEqual(Store.shared.price(.code), "$0.99")
        XCTAssertEqual(Store.shared.price(.pack50), "$32.99")
        XCTAssertEqual(Store.shared.price(IAPProduct.space("s1000")), "$8.99")
        for p in IAPProduct.allCases { XCTAssertNotNil(Store.shared.product(p), p.rawValue) }
    }

    /// One code: not paid → buy through Apple → the server counts it under the key → the code is created.
    func testBuyCode() async throws {
        let content = Content(type: "url", fields: ["url": "https://example.com/iap-\(UUID().uuidString.prefix(8))"])
        let style = QRStyle.presets.first { $0.id == "lime" }!.style // styled — never the free first code
        XCTAssertEqual(Pricing.tier(of: style), .styled)
        let key = Pricing.codeKey(payload: content.sitePayload, styleJSON: style.json)
        let before = try await API.shared.quote(key: key, tier: .styled)
        XCTAssertFalse(before.paid)
        XCTAssertFalse(before.free)

        let outcome = try await Store.shared.buy(.code(key: key, tier: "styled"))
        XCTAssertEqual(outcome, .done)
        let after = try await API.shared.quote(key: key, tier: .styled)
        XCTAssertTrue(after.paid, "the server didn't record the purchase")
        let made = try await API.shared.quick(content: content, style: style, key: key, title: "IAP test code")
        XCTAssertFalse(made.id.isEmpty)
        let unfinished = await unfinishedCount()
        XCTAssertEqual(unfinished, 0, "the transaction must be finished after the server took it")
    }

    /// A pack: five more codes in my packs.
    func testBuyPack() async throws {
        let before = try await API.shared.packs().left
        let outcome = try await Store.shared.buy(.pack(plan: "p5"))
        XCTAssertEqual(outcome, .done)
        let after = try await API.shared.packs().left
        XCTAssertEqual(after, before + 5)
    }

    /// Space: a month of 10 MB for one memory code; bought again — one more month for the same code.
    func testBuySpaceTwice() async throws {
        let c = try await API.shared.create(title: "IAP space test", kind: "memory", style: .default)
        XCTAssertEqual(c.storage?.quota, StoragePlans.free)

        var outcome = try await Store.shared.buy(.space(code: c.id, plan: "s10"))
        XCTAssertEqual(outcome, .done)
        let once = try await API.shared.code(c.id)
        XCTAssertEqual(once.storage?.quota, 10 * 1024 * 1024)
        let until1 = try XCTUnwrap(once.storage?.until)

        outcome = try await Store.shared.buy(.space(code: c.id, plan: "s10"))
        XCTAssertEqual(outcome, .done)
        let twice = try await API.shared.code(c.id)
        let until2 = try XCTUnwrap(twice.storage?.until)
        XCTAssertGreaterThan(until2, until1, "a second month should extend the code's space")
    }

    /// The same signed transaction twice: the server answers 409 the second time (counted once).
    func testReplayIsCountedOnce() async throws {
        let product = try XCTUnwrap(Store.shared.product(.pack10))
        guard case .success(let v) = try await product.purchase() else { return XCTFail("purchase didn't succeed") }
        let before = try await API.shared.packs().left
        try await API.shared.iap(jws: v.jwsRepresentation, intent: .pack(plan: "p10"))
        do {
            try await API.shared.iap(jws: v.jwsRepresentation, intent: .pack(plan: "p10"))
            XCTFail("a replay must be refused")
        } catch let e as APIError {
            XCTAssertEqual(e, .conflict)
        }
        await v.unsafePayloadValue.finish()
        let after = try await API.shared.packs().left
        XCTAssertEqual(after, before + 10)
    }

    /// The wrong intent for a product: 422 — the app keeps the transaction open (no money lost).
    func testWrongProductIsRefused() async throws {
        let product = try XCTUnwrap(Store.shared.product(.code))
        guard case .success(let v) = try await product.purchase() else { return XCTFail("purchase didn't succeed") }
        do {
            try await API.shared.iap(jws: v.jwsRepresentation, intent: .pack(plan: "p5"))
            XCTFail("a code transaction must not buy a pack")
        } catch let e as APIError {
            XCTAssertEqual(e, .http(422))
        }
        await v.unsafePayloadValue.finish()
    }

    /// Bought, but the app closed before the server saw it: at the next launch the unfinished transaction is
    /// handed over (a pack can be told by its product) and finished.
    func testUnfinishedIsDeliveredLater() async throws {
        let product = try XCTUnwrap(Store.shared.product(.pack5))
        guard case .success = try await product.purchase() else { return XCTFail("purchase didn't succeed") }
        var unfinished = await unfinishedCount()
        XCTAssertEqual(unfinished, 1)
        let before = try await API.shared.packs().left
        await Store.shared.deliverUnfinished()
        let after = try await API.shared.packs().left
        XCTAssertEqual(after, before + 5)
        unfinished = await unfinishedCount()
        XCTAssertEqual(unfinished, 0)
    }

    private func unfinishedCount() async -> Int {
        var n = 0
        for await _ in Transaction.unfinished { n += 1 }
        return n
    }
}
