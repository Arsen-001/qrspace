import XCTest
@testable import QRSpace

/// Expected values were produced by the website's own code (src/lib/pricing.ts, src/lib/qr/payload.ts,
/// src/lib/codes.ts), so the app and the site agree on keys, payloads, tiers and storage plans.
final class PricingTests: XCTestCase {
    // MARK: style JSON and tiers

    func testStyleJSONMatchesSite() {
        XCTAssertEqual(QRStyle.default.json,
                       ##"{"fg":"#111111","bg":"#ffffff","eyeColor":"#111111","dot":"square","eye":"square","eyeBall":"auto","eyeBallColor":"#111111","gradient":null,"rotate":0,"effect":"none","texture":null,"eyeIcon":null,"logo":null,"picture":null}"##)
        let sunset = QRStyle.presets.first { $0.id == "gradient" }!.style
        XCTAssertEqual(sunset.json,
                       ##"{"fg":"#7a1f2b","bg":"#ffffff","eyeColor":"#7a1f2b","dot":"diamond","eye":"leaf","eyeBall":"leaf","eyeBallColor":"#7a1f2b","gradient":{"to":"#2e3fd6","angle":45},"rotate":0,"effect":"none","texture":null,"eyeIcon":null,"logo":null,"picture":null}"##)
        let night = QRStyle.presets.first { $0.id == "night" }!.style
        XCTAssertEqual(night.json,
                       ##"{"fg":"#f3f2ec","bg":"#0b0b0c","eyeColor":"#f3f2ec","dot":"liquid","eye":"rounded","eyeBall":"rounded","eyeBallColor":"#c6ff2e","gradient":null,"rotate":0,"effect":"none","texture":null,"eyeIcon":null,"logo":null,"picture":null}"##)
        XCTAssertNotNil(night.jsonObject["gradient"])
    }

    func testTiers() {
        let tiers = Dictionary(uniqueKeysWithValues: QRStyle.presets.map { ($0.id, Pricing.tier(of: $0.style)) })
        XCTAssertEqual(tiers["classic"], .simple)
        XCTAssertEqual(tiers["soft"], .simple)
        XCTAssertEqual(tiers["dots"], .simple)
        for id in ["lime", "night", "hearts", "stars", "circuit", "gradient", "raised"] { XCTAssertEqual(tiers[id], .styled, id) }
        var s = QRStyle.default
        s.gradient = .init(to: "#2e3fd6", angle: 90)
        XCTAssertEqual(Pricing.tier(of: s), .simple) // colors and gradient stay simple
    }

    func testSavedStyleTier() throws {
        let decode = { (s: String) in try JSONDecoder().decode(JSONValue.self, from: Data(s.utf8)) }
        XCTAssertEqual(Pricing.tier(ofSaved: nil), .simple)
        XCTAssertEqual(Pricing.tier(ofSaved: try decode(QRStyle.default.json)), .simple)
        XCTAssertEqual(Pricing.tier(ofSaved: try decode(QRStyle.presets.first { $0.id == "lime" }!.style.json)), .styled)
        XCTAssertEqual(Pricing.tier(ofSaved: try decode(##"{"dot":"dots","eye":"circle","eyeBall":"circle","effect":"none","texture":null,"logo":{"src":"x","scale":0.2}}"##)), .simple)
        XCTAssertEqual(Pricing.tier(ofSaved: try decode(##"{"dot":"square","eye":"square","eyeBall":"auto","effect":"none","texture":"marble"}"##)), .styled)
        XCTAssertEqual(Pricing.tier(ofSaved: try decode(##"{"dot":"square","picture":{"src":"x"}}"##)), .styled)
    }

    func testCodeKeyMatchesSite() {
        XCTAssertEqual(Pricing.codeKey(payload: "https://example.com/menu", styleJSON: QRStyle.default.json), "g:ckayfe7j9pns")
        let lime = QRStyle.presets.first { $0.id == "lime" }!.style
        XCTAssertEqual(Pricing.codeKey(payload: "Привет, мир! 👋 ok", styleJSON: lime.json), "g:173b0061e8ck14")
        let sunset = QRStyle.presets.first { $0.id == "gradient" }!.style
        XCTAssertEqual(Pricing.codeKey(payload: #"WIFI:T:WPA;S:Home\;Net;P:p\:a\"ss;;"#, styleJSON: sunset.json), "g:6393g91rbm25r")
        // The server accepts keys matching ^(g|code):[\w-]{1,40}$
        XCTAssertNotNil(Pricing.codeKey(payload: String(repeating: "x", count: 5000), styleJSON: "{}").range(of: #"^g:[0-9a-z]{1,40}$"#, options: .regularExpression))
    }

    func testStyleColorRules() {
        var s = QRStyle.default
        s.setFg("#ff0000")
        XCTAssertEqual([s.fg, s.eyeColor, s.eyeBallColor], ["#ff0000", "#ff0000", "#ff0000"]) // corners followed the dots
        s.eyeColor = "#00ff00"
        s.setFg("#0000ff")
        XCTAssertEqual([s.fg, s.eyeColor], ["#0000ff", "#00ff00"]) // own corner color stays
        XCTAssertLessThan(QRStyle(fg: "#eeeeee", bg: "#ffffff").contrast, 2.5)
        XCTAssertGreaterThan(QRStyle.default.contrast, 15)
    }

    // MARK: space under a code

    func testPlanFor() {
        let mb = 1024 * 1024
        XCTAssertNil(StoragePlans.planFor(mb))               // fits into the free 1 MB
        XCTAssertEqual(StoragePlans.planFor(mb + 1)?.id, "s10")
        XCTAssertEqual(StoragePlans.planFor(10 * mb)?.id, "s10")
        XCTAssertEqual(StoragePlans.planFor(10 * mb + 1)?.id, "s100")
        XCTAssertEqual(StoragePlans.planFor(1024 * mb)?.id, "s1000")
        XCTAssertNil(StoragePlans.planFor(1024 * mb + 1))    // more than the biggest plan
        XCTAssertEqual(StoragePlans.planFor(230 * mb)?.price, 9)
    }

    func testRoomOffer() {
        let mb = 1024 * 1024
        let free = Storage(used: 400 * 1024, quota: mb, plan: nil, until: nil)
        XCTAssertNil(RoomOffer(storage: free, need: 600 * 1024))          // fits exactly-ish: 1000 KB ≤ 1024 KB
        let o = RoomOffer(storage: free, need: 3 * mb)!
        XCTAssertEqual(o.free, 624 * 1024)
        XCTAssertEqual(o.plan?.id, "s10")                                  // used + need = 3.4 MB → 10 MB
        XCTAssertEqual(RoomOffer(storage: free, need: 50 * mb)?.plan?.id, "s100")
        XCTAssertNil(RoomOffer(storage: free, need: 2000 * mb)?.plan)      // "at most 1 GB"
        XCTAssertNil(RoomOffer(storage: nil, need: 5 * mb))               // no numbers — the server decides
        let full = Storage(used: 11 * mb, quota: 10 * mb, plan: "s10", until: nil)
        XCTAssertEqual(RoomOffer(storage: full, need: 1)?.free, 0)
    }

    func testQuoteDecoding() throws {
        let free = try JSONDecoder().decode(Quote.self, from: Data(#"{"paid":false,"price":0,"free":true}"#.utf8))
        XCTAssertTrue(free.free); XCTAssertNil(free.pack)
        let pack = try JSONDecoder().decode(Quote.self, from: Data(#"{"paid":false,"price":0,"free":false,"pack":{"left":4,"bytes":1048576}}"#.utf8))
        XCTAssertEqual(pack.pack, Quote.PackQuote(left: 4, bytes: 1_048_576))
        let pay = try JSONDecoder().decode(Quote.self, from: Data(#"{"paid":false,"price":1,"free":false}"#.utf8))
        XCTAssertEqual(pay.price, 1)
    }

    func testBytesFormat() {
        XCTAssertTrue(Format.bytes(1024 * 1024).hasSuffix(" MB"))
        XCTAssertTrue(Format.bytes(1024 * 1024 * 1024).hasPrefix("1"))
        XCTAssertEqual(Format.bytes(100), "1 KB")
    }
}

final class ContentTests: XCTestCase {
    private func c(_ t: String, _ f: [String: String]) -> Content { Content(type: t, fields: f) }

    func testSitePayloadMatchesBuildPayload() {
        XCTAssertEqual(c("url", ["url": "example.com/menu"]).sitePayload, "https://example.com/menu")
        XCTAssertEqual(c("text", ["text": "Привет, мир! 👋 ok"]).sitePayload, "Привет, мир! 👋 ok")
        XCTAssertEqual(c("wifi", ["ssid": "Home;Net", "password": "p:a\"ss", "security": "WPA"]).sitePayload, #"WIFI:T:WPA;S:Home\;Net;P:p\:a\"ss;;"#)
        XCTAssertEqual(c("wifi", ["ssid": "Open", "security": "nopass"]).sitePayload, "WIFI:T:nopass;S:Open;;")
        XCTAssertEqual(c("phone", ["phone": "+374 (91) 00-00-00"]).sitePayload, "tel:+37491000000")
        XCTAssertEqual(c("whatsapp", ["phone": "+374 91 000000", "message": "Здравствуйте & hi"]).sitePayload,
                       "https://wa.me/37491000000?text=%D0%97%D0%B4%D1%80%D0%B0%D0%B2%D1%81%D1%82%D0%B2%D1%83%D0%B9%D1%82%D0%B5%20%26%20hi")
        XCTAssertEqual(c("telegram", ["username": "@qrspace"]).sitePayload, "https://t.me/qrspace")
        XCTAssertEqual(c("email", ["email": "a@b.co", "subject": "Hello world", "body": "Line + more"]).sitePayload,
                       "mailto:a@b.co?subject=Hello%20world&body=Line%20%2B%20more")
        XCTAssertEqual(c("contact", ["firstName": "Ani", "lastName": "Petrosyan", "phone": "+374 91", "email": "ani@x.am", "company": "A;B", "website": "qrspace.co"]).sitePayload,
                       "BEGIN:VCARD\nVERSION:3.0\nN:Petrosyan;Ani;;;\nFN:Ani Petrosyan\nTEL;TYPE=CELL:+37491\nEMAIL:ani@x.am\nORG:A\\;B\nURL:https://qrspace.co\nEND:VCARD")
        XCTAssertEqual(c("sms", ["phone": "+37491", "message": "hi there"]).sitePayload, "SMSTO:+37491:hi there")
        XCTAssertEqual(c("location", ["place": "40.18, 44.51"]).sitePayload, "https://maps.google.com/?q=40.18,44.51")
        XCTAssertEqual(c("location", ["place": "Republic Square, Yerevan"]).sitePayload, "https://maps.google.com/?q=Republic%20Square%2C%20Yerevan")
        XCTAssertEqual(c("event", ["title": "Party", "start": "2026-10-10T18:30", "end": "2026-10-10T22:00", "place": "Yerevan", "notes": "Bring cake"]).sitePayload,
                       "BEGIN:VEVENT\nSUMMARY:Party\nDTSTART:20261010T183000\nDTEND:20261010T220000\nLOCATION:Yerevan\nDESCRIPTION:Bring cake\nEND:VEVENT")
        XCTAssertEqual(c("viber", ["phone": "37491000000"]).sitePayload, "viber://chat?number=%2B37491000000")
        XCTAssertEqual(c("instagram", ["username": "@qr.space"]).sitePayload, "https://instagram.com/qr.space")
        XCTAssertEqual(c("youtube", ["username": "https://youtube.com/@x"]).sitePayload, "https://youtube.com/@x")
        XCTAssertEqual(c("url", ["url": ""]).sitePayload, "")           // empty → not ready
        XCTAssertEqual(c("event", ["title": "Party"]).sitePayload, "")   // no start → not ready
    }

    func testAutoTitleMatchesTitleOfContent() {
        XCTAssertEqual(c("url", ["url": "https://example.com/menu"]).autoTitle, "example.com/menu")
        XCTAssertEqual(c("contact", ["firstName": "Ani", "lastName": "Petrosyan"]).autoTitle, "Ani Petrosyan")
        XCTAssertEqual(c("contact", ["phone": "+374 91"]).autoTitle, "+374 91")
        XCTAssertEqual(c("wifi", ["ssid": "Home;Net"]).autoTitle, "Home;Net")
        XCTAssertEqual(c("event", ["title": "Party  at   home"]).autoTitle, "Party at home")
        XCTAssertEqual(c("telegram", ["username": "@qrspace"]).autoTitle, "@qrspace")
        XCTAssertEqual(c("url", [:]).autoTitle, "url")
    }

    func testMainValue() {
        XCTAssertEqual(c("whatsapp", ["message": "hi", "phone": " +374 "]).mainValue, "+374")
        XCTAssertEqual(c("contact", ["lastName": "P", "email": "e"]).mainValue, "P")
        XCTAssertEqual(c("text", [:]).mainValue, "")
        XCTAssertEqual(ContentTypes.all.count, 18)
        XCTAssertEqual(Set(ContentTypes.all), Set(ContentTypes.fields.keys))
    }

    func testDecodesServerCode() throws {
        let json = #"""
        {"id":"abc","kind":"link","owner":"arman","title":"Menu","short":"X7MXXA","compact":true,"access":"owner","visibility":"all",
         "blocks":[],"style":{"fg":"#1b2a4a","bg":"#ffffff","dot":"dots","gradient":null},"content":{"type":"url","fields":{"url":"example.com","junk":5}},
         "storage":{"used":10,"quota":1048576,"plan":null,"until":null},"stats":{"days":[0,1,2],"total":3,"week":3,"people":1},
         "tasks":[{"id":"t1","text":"Service","due":"2026-10-12","every":"year","done":[]}],"messages":[{"read":false},{"read":true}],
         "requests":[{"personId":"lilit","at":"x"}],"blocked":false,"requested":false,"newField":{"x":1}}
        """#
        let v = try JSONDecoder().decode(CodeView.self, from: Data(json.utf8))
        XCTAssertEqual(v.content?.fields, ["url": "example.com"])
        XCTAssertEqual(v.style?.bg, "#ffffff")
        XCTAssertEqual(v.stats?.total, 3)
        XCTAssertEqual(v.unread, 2)
        XCTAssertEqual(v.link(base: "https://qrspace.co"), "HTTPS://QRSPACE.CO/K/X7MXXA") // compact → capitals (linkOf)
        XCTAssertTrue(v.canAdd)
    }

    func testLinkOfNonCompact() throws {
        let v = try JSONDecoder().decode(CodeView.self, from: Data(#"{"id":"zDkC3TVQ","kind":"lost","short":"G3M49M","compact":false,"access":"owner"}"#.utf8))
        XCTAssertEqual(v.link(base: "https://qrspace.co"), "https://qrspace.co/c/zDkC3TVQ")
    }
}

final class AuthTests: XCTestCase {
    func testCallbackToken() {
        let t = "AbCdEfGhIjKlMnOpQrStUvWxYz012345"
        XCTAssertEqual(WebAuth.token(from: URL(string: "qrspace://auth?token=\(t)")!), t)
        XCTAssertNil(WebAuth.token(from: URL(string: "qrspace://auth?token=short")!))
        XCTAssertNil(WebAuth.token(from: URL(string: "qrspace://c/abc?token=\(t)")!))
        XCTAssertNil(WebAuth.token(from: URL(string: "https://qrspace.co/auth?token=\(t)")!))
    }

    @MainActor func testStartURLs() {
        let base = URL(string: "https://qrspace.co")!
        XCTAssertEqual(WebAuth.startURL(.site, base: base).absoluteString, "https://qrspace.co/login?next=%2Fapp%2Fcallback")
        XCTAssertEqual(WebAuth.startURL(.google, base: base).absoluteString, "https://qrspace.co/api/auth/google?next=%2Fapp%2Fcallback")
        XCTAssertEqual(WebAuth.startURL(.apple, base: base).absoluteString, "https://qrspace.co/api/auth/apple?next=%2Fapp%2Fcallback")
    }

    func testMultipartBody() throws {
        let tmp = FileManager.default.temporaryDirectory.appendingPathComponent("t-\(UUID().uuidString).jpg")
        try Data([1, 2, 3]).write(to: tmp)
        let form = try Multipart.write(fields: ["text": "привет"], file: UploadFile(url: tmp, mime: "image/jpeg", filename: "photo.jpg", size: 3), boundary: "B")
        let body = try Data(contentsOf: form.url)
        let expected = Data("--B\r\nContent-Disposition: form-data; name=\"text\"\r\n\r\nпривет\r\n--B\r\nContent-Disposition: form-data; name=\"file\"; filename=\"photo.jpg\"\r\nContent-Type: image/jpeg\r\n\r\n".utf8)
            + Data([1, 2, 3]) + Data("\r\n--B--\r\n".utf8)
        XCTAssertEqual(body, expected)
    }

    func testDueDays() {
        let f = DateFormatter()
        f.dateFormat = "yyyy-MM-dd"
        let today = f.string(from: Date())
        XCTAssertEqual(Due.daysLeft(today), 0)
        let in3 = f.string(from: Calendar.current.date(byAdding: .day, value: 3, to: Date())!)
        XCTAssertEqual(Due.daysLeft(in3), 3)
        let ago = f.string(from: Calendar.current.date(byAdding: .day, value: -2, to: Date())!)
        XCTAssertEqual(Due.daysLeft(ago), -2)
    }
}
