import XCTest
@testable import QRSpace

final class PayloadTests: XCTestCase {
    func testOurShortLink() {
        guard case .ours(.short("X7MXXA"), _) = Parsed.parse("https://qrspace.co/K/X7MXXA") else { return XCTFail() }
        guard case .ours(.code("BaUu9Xfu"), _) = Parsed.parse("https://www.qrspace.co/c/BaUu9Xfu") else { return XCTFail() }
        guard case .ours(.short("AB12"), _) = Parsed.parse("qrspace.co/K/AB12") else { return XCTFail() }
        XCTAssertEqual(OurLink(URL(string: "qrspace://c/abc")!), .code("abc"))
        XCTAssertNil(OurLink(URL(string: "https://example.com/K/abc")!))
    }

    func testURL() {
        guard case .url(let u) = Parsed.parse("https://www.apple.com/iphone/") else { return XCTFail() }
        XCTAssertEqual(u.host, "www.apple.com")
    }

    func testWifiEscapes() {
        XCTAssertEqual(Parsed.parse(#"WIFI:T:WPA;S:My\;Net;P:pa\:ss;H:true;;"#),
                       .wifi(ssid: "My;Net", password: "pa:ss", security: "WPA", hidden: true))
        XCTAssertEqual(Parsed.parse("WIFI:S:Open;;"), .wifi(ssid: "Open", password: "", security: "nopass", hidden: false))
    }

    func testContactActions() {
        XCTAssertEqual(Parsed.parse("tel:+37491000000"), .phone("+37491000000"))
        XCTAssertEqual(Parsed.parse("mailto:a@b.co?subject=Hi"), .email(address: "a@b.co", subject: "Hi", body: ""))
        XCTAssertEqual(Parsed.parse("SMSTO:+123:hello"), .sms(number: "+123", body: "hello"))
        XCTAssertEqual(Parsed.parse("geo:40.18,44.51"), .geo(lat: 40.18, lon: 44.51, query: ""))
        guard case .contact(let name, let lines, _) = Parsed.parse("BEGIN:VCARD\nVERSION:3.0\nN:Petrosyan;Ani;;;\nTEL:+374\nEND:VCARD")
        else { return XCTFail() }
        XCTAssertEqual(name, "Ani Petrosyan")
        XCTAssertEqual(lines, ["+374"])
        guard case .contact("John Doe", _, _) = Parsed.parse("MECARD:N:Doe,John;TEL:123;;") else { return XCTFail() }
    }

    func testEvent() {
        guard case .event(let t, let start, _, let loc, _) = Parsed.parse("BEGIN:VEVENT\nSUMMARY:Party\nDTSTART:20261010T183000\nLOCATION:Yerevan\nEND:VEVENT")
        else { return XCTFail() }
        XCTAssertEqual(t, "Party"); XCTAssertNotNil(start); XCTAssertEqual(loc, "Yerevan")
    }

    func testBarcodes() {
        XCTAssertEqual(Parsed.parse("4006381333931", symbology: .ean13), .barcode("4006381333931", .ean13))
        let (s, p) = Symbology.normalized(.ean13, payload: "0123456789012")
        XCTAssertEqual(s, .upca); XCTAssertEqual(p, "123456789012")
        XCTAssertEqual(Parsed.parse("hello world"), .text("hello world"))
    }

    func testContentPayloadMatchesSite() {
        XCTAssertEqual(Content(type: "wifi", fields: ["ssid": "Home", "password": "p;1", "security": "WPA"]).payload, #"WIFI:T:WPA;S:Home;P:p\;1;;"#)
        XCTAssertEqual(Content(type: "url", fields: ["url": "example.com"]).payload, "https://example.com")
        XCTAssertEqual(Content(type: "phone", fields: ["phone": "+374 91 00"]).payload, "tel:+3749100")
        XCTAssertEqual(Content(type: "telegram", fields: ["username": "@qrspace"]).payload, "https://t.me/qrspace")
    }
}
