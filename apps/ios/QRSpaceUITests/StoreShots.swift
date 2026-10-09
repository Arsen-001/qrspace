import StoreKitTest
import XCTest

/// App Store screenshots — run by fastlane/shots/take.sh, never on its own: the script creates two temporary demo codes
/// for "arman" on qrspace.co with this locale's texts (and deletes them afterwards), boots the device and passes:
///   QR_SHOTS_DIR  where to save (fastlane/screenshots/<locale>)   QR_SHOT_LANG / QR_SHOT_LOCALE  e.g. ru / ru_RU
///   QR_SHOT_SUFFIX  e.g. 6.9in                                    QR_SHOT_CODE  the album code (photo + text)
///   QR_STILL  the "camera" picture (fastlane/shots/make-assets.swift)   QR_VIDEO  a file bigger than 1 MB
/// Production is only read here (the demo sign-in aside); prices come from QRSpace.storekit via StoreKit testing.
final class StoreShots: XCTestCase {
    private let env = ProcessInfo.processInfo.environment
    private var store: SKTestSession?

    override func setUpWithError() throws {
        guard env["QR_SHOTS_DIR"] != nil else { throw XCTSkip("run by fastlane/shots/take.sh") }
        continueAfterFailure = true
        store = try SKTestSession(configurationFileNamed: "QRSpace")
        store?.disableDialogs = true
    }

    func testStoreScreenshots() throws {
        let code = try XCTUnwrap(env["QR_SHOT_CODE"])
        let still = try XCTUnwrap(env["QR_STILL"])
        let video = try XCTUnwrap(env["QR_VIDEO"])

        // 1. Scanner with a result: the camera "sees" a Wi‑Fi code, the result sheet with its buttons.
        // No demo sign-in here: signing in switches the app to "My QR codes" (the scanner needs no account).
        var app = launch(["-QRTab", "scan", "-QRCameraStill", still, "-QRDecodeFile", still], signIn: false)
        let ssid = app.descendants(matching: .any).matching(NSPredicate(format: "label CONTAINS 'Ararat'")).firstMatch
        XCTAssertTrue(ssid.waitForExistence(timeout: 15), "scan result")
        sleep(2)
        shot("1-scan")

        // 2. "My QR codes": the newest card (the album) with its switch ON — what a person sees after the scan.
        app = launch(["-QRTab", "home"])
        XCTAssertTrue(app.buttons["create-new"].waitForExistence(timeout: 25))
        let flip = app.descendants(matching: .any).matching(identifier: "flip-switch").firstMatch
        XCTAssertTrue(flip.waitForExistence(timeout: 20))
        sleep(3) // drawings and photos
        // The card's top just under the status bar: the whole card with its switch, the demo "To do" list
        // (seeded in Russian) scrolled away.
        var n = 0
        while flip.frame.minY > app.frame.height * 0.27 && n < 30 { drag(app, by: 0.03); n += 1 }
        flip.tap()
        sleep(3)
        shot("2-codes")

        // 3. Create: a link, the lime style picked, the preview from the server and the ready styles.
        app = launch(["-QRCreate", "YES"])
        sleep(1)
        let url = app.descendants(matching: .any).matching(identifier: "field-url").firstMatch
        XCTAssertTrue(url.waitForExistence(timeout: 20))
        // Longer labels (ru, de…) push the field under the floating tab bar — bring it up first.
        n = 0
        while url.frame.maxY > app.frame.height - 150 && n < 6 { drag(app, by: 0.15); n += 1 }
        url.tap()
        url.typeText("qrspace.co\n")
        let preset = app.buttons["preset-lime"]
        n = 0
        while (!preset.isHittable || preset.frame.minY > app.frame.height * 0.68) && n < 16 { drag(app, by: 0.12); n += 1 }
        n = 0
        while preset.frame.minY < app.frame.height * 0.56 && n < 4 { drag(app, by: -0.05); n += 1 }
        preset.tap()
        sleep(4)
        shot("3-create")

        // 4. The room offer: a 3.7 MB video under a code with 1 MB free — the space it needs and the store's price.
        app = launch(["-QROpenCode", code, "-QRAttachFile", video])
        let pay = app.buttons["room-pay"]
        XCTAssertTrue(pay.waitForExistence(timeout: 30), "room offer")
        sleep(3)
        shot("4-room")

        // 5. The code's page as others see it: the code, the photo and the text under it.
        app = launch(["-QRTab", "home"])
        XCTAssertTrue(app.buttons["create-new"].waitForExistence(timeout: 25))
        let guest = app.buttons.matching(NSPredicate(format: "identifier == 'card-guest'")).firstMatch
        XCTAssertTrue(guest.waitForExistence(timeout: 20))
        n = 0
        while !guest.isHittable && n < 8 { drag(app, by: 0.2); n += 1 }
        guest.tap()
        sleep(5)
        shot("5-code")
    }

    private func launch(_ args: [String], signIn: Bool = true) -> XCUIApplication {
        let app = XCUIApplication()
        let lang = env["QR_SHOT_LANG"] ?? "en", locale = env["QR_SHOT_LOCALE"] ?? "en_US"
        app.launchArguments = (signIn ? ["-QRDemoPerson", "arman"] : []) + ["-AppleLanguages", "(\(lang))", "-AppleLocale", locale] + args
        app.launch()
        return app
    }

    /// Scroll by a share of the screen (positive — content moves up).
    private func drag(_ app: XCUIApplication, by k: CGFloat) {
        let from = app.coordinate(withNormalizedOffset: CGVector(dx: 0.92, dy: 0.5 + k / 2))
        let to = app.coordinate(withNormalizedOffset: CGVector(dx: 0.92, dy: 0.5 - k / 2))
        from.press(forDuration: 0.05, thenDragTo: to, withVelocity: .slow, thenHoldForDuration: 0.4)
    }

    private func shot(_ name: String) {
        let png = XCUIScreen.main.screenshot().pngRepresentation
        let a = XCTAttachment(data: png, uniformTypeIdentifier: "public.png")
        a.name = name
        a.lifetime = .keepAlways
        add(a)
        guard let dir = env["QR_SHOTS_DIR"] else { return }
        let out = URL(fileURLWithPath: dir)
        try? FileManager.default.createDirectory(at: out, withIntermediateDirectories: true)
        try? png.write(to: out.appendingPathComponent("\(name)-\(env["QR_SHOT_SUFFIX"] ?? "shot").png"))
    }
}
