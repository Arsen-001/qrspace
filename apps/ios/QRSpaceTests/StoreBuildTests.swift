import XCTest
@testable import QRSpace

/// The App Store switch for buy/pay screens (StoreBuild): what the price check leads to, with and without purchases.
final class StoreBuildTests: XCTestCase {
    private func quote(paid: Bool = false, free: Bool = false, pack: Quote.PackQuote? = nil) -> Quote {
        Quote(paid: paid, price: 1, free: free, pack: pack)
    }

    func testStepsWithPurchases() {
        XCTAssertEqual(StoreBuild.step(for: quote(paid: true), purchases: true), .go)
        XCTAssertEqual(StoreBuild.step(for: quote(free: true), purchases: true), .ask)
        XCTAssertEqual(StoreBuild.step(for: quote(pack: .init(left: 3, bytes: 1_048_576)), purchases: true), .ask)
        XCTAssertEqual(StoreBuild.step(for: quote(), purchases: true), .ask) // the pay gate
    }

    /// No purchases: what's paid, free or from a pack still works; only "pay" turns into "not in the app".
    func testStepsWithoutPurchases() {
        XCTAssertEqual(StoreBuild.step(for: quote(paid: true), purchases: false), .go)
        XCTAssertEqual(StoreBuild.step(for: quote(free: true), purchases: false), .ask)
        XCTAssertEqual(StoreBuild.step(for: quote(pack: .init(left: 1, bytes: 1_048_576)), purchases: false), .ask)
        XCTAssertEqual(StoreBuild.step(for: quote(), purchases: false), .notInApp)
    }

    func testBuildSettingParsing() {
        XCTAssertTrue(StoreBuild.parse(nil))
        XCTAssertTrue(StoreBuild.parse(""))
        XCTAssertTrue(StoreBuild.parse("YES"))
        XCTAssertFalse(StoreBuild.parse("NO"))
        XCTAssertFalse(StoreBuild.parse(" no "))
        XCTAssertFalse(StoreBuild.parse("false"))
        XCTAssertFalse(StoreBuild.parse("0"))
    }

    /// The default build keeps purchases on; Info.plist carries the build setting (QR_PURCHASES_ENABLED).
    func testDefaultBuildHasPurchases() {
        let raw = Bundle.main.object(forInfoDictionaryKey: "QRPurchasesEnabled") as? String
        XCTAssertNotNil(raw, "QRPurchasesEnabled missing from Info.plist")
        XCTAssertEqual(StoreBuild.parse(raw), true)
    }

    /// Store compliance bits that live in the built Info.plist.
    func testStoreInfoPlist() {
        let info = Bundle.main.infoDictionary ?? [:]
        XCTAssertEqual(info["ITSAppUsesNonExemptEncryption"] as? Bool, false)
        XCTAssertEqual(info["CFBundleShortVersionString"] as? String, "1.0.0")
        XCTAssertNotNil(info["NSCameraUsageDescription"])
        XCTAssertNotNil(Bundle.main.url(forResource: "PrivacyInfo", withExtension: "xcprivacy"), "privacy manifest not in the bundle")
    }
}
