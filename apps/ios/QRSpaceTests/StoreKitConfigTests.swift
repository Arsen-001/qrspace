import StoreKit
import StoreKitTest
import XCTest
@testable import QRSpace

/// QRSpace.storekit has all 8 products with the right types, and StoreKit testing serves them to the app. Runs in the
/// app's own process, so it also sets the Simulator up for the UI tests and the App Store screenshots (a session made
/// in the UI test runner doesn't reach the app) — fastlane/shots/take.mjs runs it on every device first.
@MainActor
final class StoreKitConfigTests: XCTestCase {
    func testAllProductsLoad() async throws {
        let session = try SKTestSession(configurationFileNamed: "QRSpace")
        session.disableDialogs = true
        // A freshly booted Simulator can answer empty for a few seconds.
        var list: [Product] = []
        for _ in 0..<15 {
            list = try await Product.products(for: IAPProduct.allCases.map(\.rawValue))
            if !list.isEmpty { break }
            try await Task.sleep(for: .seconds(1))
        }
        XCTAssertEqual(Set(list.map(\.id)), Set(IAPProduct.allCases.map(\.rawValue)))
        for p in list {
            let space = p.id.hasPrefix("co.qrspace.space")
            XCTAssertEqual(p.type, space ? .nonRenewable : .consumable, p.id)
        }
        XCTAssertEqual(list.first { $0.id == IAPProduct.code.rawValue }?.displayPrice, "$0.99")
    }
}
