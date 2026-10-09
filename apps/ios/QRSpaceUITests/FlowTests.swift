import StoreKitTest
import XCTest

/// End-to-end against the local dev server (http://localhost:3720, demo mode). Writes go only there.
/// Purchases go through Apple in-app purchase with Xcode's StoreKit testing (QRSpace.storekit, no dialogs); the dev
/// server must run with IAP_ALLOW_XCODE=1 to accept those transactions.
/// Screenshots land in $QR_SHOTS (pass `TEST_RUNNER_QR_SHOTS=<dir>` to xcodebuild); the big test video is
/// $QR_VIDEO (`TEST_RUNNER_QR_VIDEO=<path to a >1 MB .mp4>`). See README "End-to-end in the Simulator".
final class FlowTests: XCTestCase {
    static let server = ProcessInfo.processInfo.environment["QR_SERVER"] ?? "http://localhost:3720"
    var shots: URL? { ProcessInfo.processInfo.environment["QR_SHOTS"].map { URL(fileURLWithPath: $0) } }
    let stamp = String(Int(Date().timeIntervalSince1970) % 100000)

    private var store: SKTestSession?

    override func setUpWithError() throws {
        continueAfterFailure = false
        store = try SKTestSession(configurationFileNamed: "QRSpace")
        store?.disableDialogs = true
        store?.clearTransactions()
    }

    private func launch(_ args: [String]) -> XCUIApplication {
        let app = XCUIApplication()
        app.launchArguments = ["-QRAPIBase", Self.server, "-AppleLanguages", "(en)", "-AppleLocale", "en_US"] + args
        app.launch()
        return app
    }

    private func shot(_ name: String) {
        let png = XCUIScreen.main.screenshot().pngRepresentation
        let a = XCTAttachment(data: png, uniformTypeIdentifier: "public.png")
        a.name = name
        a.lifetime = .keepAlways
        add(a)
        if let dir = shots {
            try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
            try? png.write(to: dir.appendingPathComponent("\(name).png"))
        }
    }

    /// Any element by accessibility identifier (text fields with a vertical axis are text views).
    private func el(_ app: XCUIApplication, _ id: String) -> XCUIElement {
        app.descendants(matching: .any).matching(identifier: id).firstMatch
    }

    private func scrollTo(_ el: XCUIElement, in app: XCUIApplication, max: Int = 12) {
        var n = 0
        while !(el.exists && el.isHittable) && n < max {
            app.swipeUp(velocity: .slow)
            n += 1
        }
    }

    /// Sign in through the website (qrspace.co's /login in the in-app browser, demo person) → home.
    func test1_SignInOnSiteCreateEdit() throws {
        let app = launch(["-QRSignOut", "YES", "-QRTab", "home"])
        let signIn = app.buttons["signin-site"]
        XCTAssertTrue(signIn.waitForExistence(timeout: 15))
        shot("01-signin")
        signIn.tap()

        // The website in ASWebAuthenticationSession (another process). Tap the demo person "Arman".
        let springboard = XCUIApplication(bundleIdentifier: "com.apple.springboard")
        if springboard.buttons["Continue"].waitForExistence(timeout: 3) { springboard.buttons["Continue"].tap() }
        // Only the website's own button — never the app's demo row under the sheet.
        let hosts = ["com.apple.SafariViewService", "com.apple.AuthenticationServicesCore.AuthenticationServicesAgent",
                     "com.apple.AuthenticationServicesUI"].map { XCUIApplication(bundleIdentifier: $0) }
        var person: XCUIElement?
        var host: XCUIApplication?
        let deadline = Date().addingTimeInterval(40)
        while person == nil && Date() < deadline {
            for h in hosts {
                for q in [h.webViews.buttons, h.buttons] {
                    let b = q.matching(NSPredicate(format: "label CONTAINS[c] 'Arman'")).firstMatch
                    if b.exists { person = b; host = h; break }
                }
                if person != nil { break }
            }
            if person == nil {
                let b = app.webViews.buttons.matching(NSPredicate(format: "label CONTAINS[c] 'Arman'")).firstMatch
                if b.exists { person = b; host = app } else { Thread.sleep(forTimeInterval: 1) }
            }
        }
        shot("02-site-login")
        guard let person, let host else {
            for h in hosts { print("HOST \(h.debugDescription.prefix(3000))") }
            return XCTFail("demo person button not found on the website")
        }
        // Small slow drags until the button sits between the browser's top bar and bottom toolbar (frames only:
        // web elements can report an invalid activation point while the page settles).
        func drag(from: CGFloat, to: CGFloat) {
            host.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: from))
                .press(forDuration: 0.05, thenDragTo: host.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: to)),
                       withVelocity: .slow, thenHoldForDuration: 0.3)
        }
        var tries = 0
        while tries < 14 {
            let f = person.frame, h = host.frame
            if f.minY < h.minY + 190 { drag(from: 0.45, to: 0.6) } else if f.maxY > h.maxY - 150 { drag(from: 0.6, to: 0.4) } else { break }
            tries += 1
            usleep(500_000)
        }
        sleep(1)
        person.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).tap()

        // Back in the app, signed in → "My QR codes" (the dev server may compile /app/callback on first use).
        let create = app.buttons["create-new"]
        if !create.waitForExistence(timeout: 15) {
            shot("02b-after-tap")
            if person.exists { person.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).tap() } // once more
        }
        XCTAssertTrue(create.waitForExistence(timeout: 60), "home dashboard after sign-in")
        sleep(2)
        shot("03-home")

        // Flip the first card's switch: the code slides away and shows what's under it.
        // (A button with the toggle trait is a "switch" for XCUITest.) Keep it clear of the floating tab bar.
        let flip = el(app, "flip-switch")
        XCTAssertTrue(flip.waitForExistence(timeout: 10))
        var n = 0
        while flip.frame.maxY > app.frame.maxY - 160 && n < 6 { app.swipeUp(velocity: .slow); n += 1 }
        sleep(1)
        flip.tap()
        sleep(2)
        XCTAssertTrue(["ON", "1"].contains(flip.value as? String ?? ""), "switch is on: \(String(describing: flip.value))")
        shot("04-switch-on")
        flip.tap()
        app.swipeDown(velocity: .fast)

        // Create a link code.
        create.tap()
        let url = el(app, "field-url")
        XCTAssertTrue(url.waitForExistence(timeout: 10))
        url.tap()
        url.typeText("example.com/menu-\(stamp)")
        let title = el(app, "field-codeTitle")
        title.tap()
        title.typeText("Cafe menu \(stamp)")
        if app.keyboards.buttons["Return"].exists { app.keyboards.buttons["Return"].tap() }
        let preset = app.buttons["preset-dots"]
        scrollTo(preset, in: app)
        preset.tap()
        sleep(2)
        shot("05-create")
        let submit = app.buttons["create-submit"]
        scrollTo(submit, in: app, max: 20)
        submit.tap()
        let confirm = app.buttons["gate-confirm"]
        if confirm.waitForExistence(timeout: 10) {
            sleep(1)
            shot("06-gate")
            confirm.tap()
        }

        // The new code's edit page.
        let editTitle = el(app, "edit-title")
        XCTAssertTrue(editTitle.waitForExistence(timeout: 20), "edit page after creating")
        XCTAssertEqual(editTitle.value as? String, "Cafe menu \(stamp)")
        sleep(1)
        shot("07-edit")

        // Rename.
        editTitle.tap()
        sleep(1)
        editTitle.coordinate(withNormalizedOffset: CGVector(dx: 0.9, dy: 0.5)).tap() // cursor to the end
        editTitle.typeText(String(repeating: XCUIKeyboardKey.delete.rawValue, count: 30))
        editTitle.typeText("Menu \(stamp) renamed")
        let save = app.buttons["edit-title-save"]
        XCTAssertTrue(save.waitForExistence(timeout: 5))
        save.tap()
        XCTAssertTrue(app.staticTexts["Saved"].waitForExistence(timeout: 10))

        // Add a text entry.
        let text = el(app, "composer-text")
        scrollTo(text, in: app, max: 20)
        text.tap()
        text.typeText("Wi-Fi password is on the fridge \(stamp)")
        let add = app.buttons["composer-save"]
        scrollTo(add, in: app)
        add.tap()
        XCTAssertTrue(app.staticTexts["Wi-Fi password is on the fridge \(stamp)"].waitForExistence(timeout: 15))
        sleep(1)
        shot("08-entry-added")
    }

    /// A file bigger than the free 1 MB: the room offer (size, free space, plan and price), pay → it uploads.
    func test2_RoomOfferPayAndUpload() throws {
        guard let video = ProcessInfo.processInfo.environment["QR_VIDEO"] else { throw XCTSkip("QR_VIDEO not set") }
        let id = try newMemoryCode()
        let app = launch(["-QRDemoPerson", "arman", "-QROpenCode", id, "-QRAttachFile", video])
        // No manual scrolling: the offer scrolls itself into view, its button above the floating tab bar.
        let pay = app.buttons["room-pay"]
        XCTAssertTrue(pay.waitForExistence(timeout: 25), "room offer shown for a big file")
        sleep(2)
        XCTAssertTrue(el(app, "room-sizes").exists)
        XCTAssertTrue(pay.label.contains("$0.99"), "the App Store price on the button: \(pay.label)")
        XCTAssertLessThanOrEqual(pay.frame.maxY, tabBarTop(app) - 4, "Pay button (\(pay.frame.maxY)) above the tab bar (\(tabBarTop(app)))")
        shot("09-room-offer")
        pay.tap()
        // Uploaded: the composer's file is gone and the space is now 10 MB.
        let file = el(app, "composer-file")
        let done = NSPredicate(format: "exists == false")
        expectation(for: done, evaluatedWith: file)
        waitForExpectations(timeout: 90)
        sleep(2)
        shot("10-uploaded")
        let code = try fetch(id)
        let storage = code["storage"] as? [String: Any]
        XCTAssertEqual(storage?["quota"] as? Int, 10 * 1024 * 1024)
        XCTAssertEqual((code["blocks"] as? [[String: Any]])?.first?["kind"] as? String, "video")

        // Download the full-size image: a memory code is paid at download (gate), then the share sheet.
        let download = el(app, "download-png")
        scrollTo(download, in: app, max: 20)
        download.tap()
        let confirm = app.buttons["gate-confirm"]
        XCTAssertTrue(confirm.waitForExistence(timeout: 10), "download gate for an unpaid memory code")
        sleep(1)
        shot("11-download-gate")
        confirm.tap()
        sleep(4)
        shot("12-share-sheet")
    }

    /// A pack of 5 codes from Account, at the App Store's price; the server adds 5 codes to my packs.
    func test4_BuyPackInAccount() throws {
        _ = try call("/api/me", method: "POST", body: ["personId": "arman"])
        let before = (try call("/api/packs") as? [String: Any])?["left"] as? Int ?? -1
        let app = launch(["-QRDemoPerson", "arman", "-QRTab", "account"])
        let pack = app.buttons["pack-p5"]
        XCTAssertTrue(pack.waitForExistence(timeout: 25), "packs with store prices")
        XCTAssertTrue(pack.label.contains("$3.99"), "store price: \(pack.label)")
        var n = 0
        while pack.frame.maxY > tabBarTop(app) - 20 && n < 6 { app.swipeUp(velocity: .slow); n += 1 }
        sleep(1)
        shot("13-packs")
        pack.tap()
        XCTAssertTrue(el(app, "packs-note").waitForExistence(timeout: 30), "bought note")
        sleep(1)
        shot("14-pack-bought")
        let after = (try call("/api/packs") as? [String: Any])?["left"] as? Int ?? -1
        XCTAssertEqual(after, before + 5)
    }

    /// The build without purchases (StoreBuild.purchasesEnabled = NO): no prices and no pay buttons, the app still works
    /// (the room offer only says what doesn't fit; Account has no packs; the privacy links are there).
    func test5_NoPurchasesBuild() throws {
        guard let video = ProcessInfo.processInfo.environment["QR_VIDEO"] else { throw XCTSkip("QR_VIDEO not set") }
        let id = try newMemoryCode()
        var app = launch(["-QRPurchases", "NO", "-QRDemoPerson", "arman", "-QROpenCode", id, "-QRAttachFile", video])
        XCTAssertTrue(el(app, "room-not-in-app").waitForExistence(timeout: 25), "room offer without a price")
        XCTAssertFalse(app.buttons["room-pay"].exists)
        XCTAssertFalse(app.staticTexts.matching(NSPredicate(format: "label CONTAINS '$'")).firstMatch.exists, "no prices")
        sleep(1)
        shot("15-no-purchases-room")
        app = launch(["-QRPurchases", "NO", "-QRDemoPerson", "arman", "-QRTab", "account"])
        XCTAssertTrue(app.buttons["sign-out"].waitForExistence(timeout: 20))
        XCTAssertFalse(app.buttons["pack-p5"].exists, "no packs to buy")
        XCTAssertFalse(el(app, "iap-unavailable").exists)
        toBottom(app)
        XCTAssertTrue(el(app, "legal-links").exists, "privacy and terms links")
        shot("16-no-purchases-account")
    }

    /// Every scrolling screen: scrolled to the end, its last control sits fully above the floating tab bar.
    func test3_LastControlsClearTheTabBar() throws {
        continueAfterFailure = true
        let id = try anyCodeId()
        var app = launch(["-QRDemoPerson", "arman", "-QRTab", "home"])
        XCTAssertTrue(app.buttons["create-new"].waitForExistence(timeout: 20))
        toBottom(app)
        let shared = app.buttons.matching(identifier: "shared-tile").allElementsBoundByIndex.last
        checkClear(shared ?? app.buttons["new-tile"], app, "home")
        shot("18-home-bottom")

        app = launch(["-QRDemoPerson", "arman", "-QRCreate", "YES"])
        XCTAssertTrue(app.buttons["create-submit"].waitForExistence(timeout: 20))
        toBottom(app)
        checkClear(app.buttons["create-submit"], app, "create")
        shot("19-create-bottom")

        app = launch(["-QRDemoPerson", "arman", "-QROpenCode", id])
        XCTAssertTrue(el(app, "edit-title").waitForExistence(timeout: 20))
        toBottom(app)
        checkClear(el(app, "edit-share"), app, "edit")
        shot("20-edit-bottom")

        app = launch(["-QRDemoPerson", "arman", "-QRTab", "account"])
        XCTAssertTrue(app.buttons["sign-out"].waitForExistence(timeout: 20))
        toBottom(app)
        checkClear(app.buttons["sign-out"], app, "account")
        shot("21-account-bottom")
    }

    private func tabBarTop(_ app: XCUIApplication) -> CGFloat {
        let bar = app.tabBars.firstMatch
        return bar.exists ? bar.frame.minY : app.frame.maxY - 100
    }

    private func toBottom(_ app: XCUIApplication) {
        for _ in 0..<12 { app.swipeUp(velocity: .fast) }
        sleep(2)
    }

    private func checkClear(_ e: XCUIElement, _ app: XCUIApplication, _ what: String) {
        XCTAssertTrue(e.exists, "\(what): last control exists")
        let top = tabBarTop(app)
        XCTAssertLessThanOrEqual(e.frame.maxY, top - 4, "\(what): last control ends at \(e.frame.maxY), tab bar starts at \(top)")
    }

    // MARK: server helpers (localhost only)

    private lazy var api: URLSession = {
        // The test runner's own cookie jar (a separate process from the app).
        let cfg = URLSessionConfiguration.default
        cfg.httpCookieStorage = .shared
        cfg.httpCookieAcceptPolicy = .always
        return URLSession(configuration: cfg)
    }()

    private func call(_ path: String, method: String = "GET", body: [String: Any]? = nil) throws -> Any {
        var req = URLRequest(url: URL(string: Self.server + path)!)
        req.httpMethod = method
        if let body {
            req.setValue("application/json", forHTTPHeaderField: "Content-Type")
            req.httpBody = try JSONSerialization.data(withJSONObject: body)
        }
        var out: Data?
        let done = expectation(description: path)
        api.dataTask(with: req) { d, _, _ in out = d; done.fulfill() }.resume()
        wait(for: [done], timeout: 20)
        return try JSONSerialization.jsonObject(with: out ?? Data("{}".utf8))
    }

    private func newMemoryCode() throws -> String {
        _ = try call("/api/me", method: "POST", body: ["personId": "arman"])
        let c = try call("/api/codes", method: "POST", body: ["title": "Room test \(stamp)", "kind": "memory"]) as? [String: Any]
        return try XCTUnwrap(c?["id"] as? String)
    }

    /// A code of Arman with the longest edit page (memory with entries), for layout checks.
    private func anyCodeId() throws -> String {
        _ = try call("/api/me", method: "POST", body: ["personId": "arman"])
        let list = try call("/api/codes") as? [String: Any]
        let mine = (list?["mine"] as? [[String: Any]]) ?? []
        let rich = mine.first { ($0["kind"] as? String) == "memory" && !((($0["blocks"] as? [Any]) ?? []).isEmpty) }
        return try XCTUnwrap((rich ?? mine.first)?["id"] as? String)
    }

    private func fetch(_ id: String) throws -> [String: Any] {
        try XCTUnwrap(try call("/api/codes/\(id)") as? [String: Any])
    }
}
