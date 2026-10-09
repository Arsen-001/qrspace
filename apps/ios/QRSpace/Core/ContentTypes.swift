import Foundation

/// The generator's content types and their fields — port of src/lib/qr/payload.ts (FIELDS, CONTENT_GROUPS,
/// buildPayload, titleOfContent). Labels are `type.<id>`, `field.<name>`, `group.<id>` in the dictionaries.
enum ContentTypes {
    static let groups: [(id: String, types: [String])] = [
        ("main", ["url", "text", "wifi", "contact", "location", "event"]),
        ("contact", ["phone", "sms", "email", "whatsapp", "telegram", "viber"]),
        ("social", ["instagram", "facebook", "tiktok", "youtube", "linkedin", "x"]),
    ]
    static let all: [String] = groups.flatMap(\.types)

    /// Fields of each type, in form order.
    static let fields: [String: [String]] = [
        "url": ["url"],
        "text": ["text"],
        "wifi": ["ssid", "password", "security"],
        "phone": ["phone"],
        "whatsapp": ["phone", "message"],
        "telegram": ["username"],
        "email": ["email", "subject", "body"],
        "contact": ["firstName", "lastName", "phone", "email", "company", "website"],
        "location": ["place"],
        "event": ["title", "start", "end", "place", "notes"],
        "sms": ["phone", "message"],
        "viber": ["phone"],
        "instagram": ["username"],
        "facebook": ["username"],
        "tiktok": ["username"],
        "youtube": ["username"],
        "linkedin": ["username"],
        "x": ["username"],
    ]

    static let wifiSecurity = ["WPA", "WEP", "nopass"]

    /// SF Symbol for a content type.
    static func icon(_ type: String) -> String {
        switch type {
        case "url": "link"
        case "text": "text.alignleft"
        case "wifi": "wifi"
        case "phone": "phone.fill"
        case "sms": "message.fill"
        case "email": "envelope.fill"
        case "whatsapp", "viber": "bubble.left.and.bubble.right.fill"
        case "telegram": "paperplane.fill"
        case "contact": "person.crop.rectangle.fill"
        case "location": "mappin.and.ellipse"
        case "event": "calendar"
        case "youtube": "play.rectangle.fill"
        case "instagram", "tiktok", "facebook", "linkedin", "x": "person.2.fill"
        default: "qrcode"
        }
    }
}

extension Content {
    /// The main value shown on a dashboard card (the first filled field of the type).
    var mainValue: String {
        (ContentTypes.fields[type] ?? []).lazy.compactMap { fields[$0]?.trimmingCharacters(in: .whitespacesAndNewlines) }
            .first { !$0.isEmpty } ?? ""
    }

    /// Exactly what the site's buildPayload gives ("" — the main field is empty). Used for the payment key and to
    /// know that a form is ready; `payload` (Payload.swift) is the iOS-friendly variant for actions.
    var sitePayload: String {
        let v = { (k: String) in (fields[k] ?? "").trimmingCharacters(in: .whitespacesAndNewlines) }
        let digits = { (s: String) in s.filter { $0.isNumber || $0 == "+" } }
        let wifiEsc = { (s: String) in s.replacingOccurrences(of: #"([\\;,:"])"#, with: #"\\$1"#, options: .regularExpression) }
        let vEsc = { (s: String) in
            s.replacingOccurrences(of: #"([\\;,])"#, with: #"\\$1"#, options: .regularExpression).replacingOccurrences(of: "\n", with: "\\n")
        }
        switch type {
        case "sms":
            let n = digits(v("phone"))
            return n.isEmpty ? "" : "SMSTO:\(n):\(v("message"))"
        case "viber":
            let n = digits(v("phone"))
            return n.isEmpty ? "" : "viber://chat?number=\(JSURI.component(n.hasPrefix("+") ? n : "+\(n)"))"
        case "location":
            let q = v("place")
            if q.isEmpty { return "" }
            if let m = q.wholeMatch(of: #/\s*(-?\d+(?:\.\d+)?)\s*[,;\s]\s*(-?\d+(?:\.\d+)?)\s*/#) {
                return "https://maps.google.com/?q=\(m.1),\(m.2)"
            }
            return "https://maps.google.com/?q=\(JSURI.component(q))"
        case "event":
            if v("title").isEmpty || v("start").isEmpty { return "" }
            let ics = { (s: String) -> String in
                let t = s.replacingOccurrences(of: "-", with: "").replacingOccurrences(of: ":", with: "")
                return String((t + String(repeating: "0", count: 13)).prefix(13)) + "00"
            }
            return ["BEGIN:VEVENT", "SUMMARY:\(vEsc(v("title")))", "DTSTART:\(ics(v("start")))",
                    v("end").isEmpty ? "" : "DTEND:\(ics(v("end")))",
                    v("place").isEmpty ? "" : "LOCATION:\(vEsc(v("place")))",
                    v("notes").isEmpty ? "" : "DESCRIPTION:\(vEsc(v("notes")))", "END:VEVENT"]
                .filter { !$0.isEmpty }.joined(separator: "\n")
        case "instagram", "facebook", "tiktok", "youtube", "linkedin", "x":
            let u = v("username")
            if u.isEmpty { return "" }
            if u.range(of: #"^https?://"#, options: [.regularExpression, .caseInsensitive]) != nil
                || u.range(of: #"\.(com|me)/"#, options: [.regularExpression, .caseInsensitive]) != nil { return Self.normalizeURL(u) }
            let name = u.hasPrefix("@") ? String(u.dropFirst()) : u
            let prefix = ["instagram": "https://instagram.com/", "facebook": "https://facebook.com/", "tiktok": "https://www.tiktok.com/@",
                          "youtube": "https://youtube.com/@", "linkedin": "https://www.linkedin.com/in/", "x": "https://x.com/"][type]!
            return prefix + name
        case "url":
            return Self.normalizeURL(v("url"))
        case "text":
            return fields["text"] ?? ""
        case "wifi":
            if v("ssid").isEmpty { return "" }
            let sec = v("security").isEmpty ? "WPA" : v("security")
            let pass = sec == "nopass" ? "" : "P:\(wifiEsc(fields["password"] ?? ""));"
            return "WIFI:T:\(sec);S:\(wifiEsc(fields["ssid"] ?? ""));\(pass);"
        case "phone":
            return v("phone").isEmpty ? "" : "tel:\(digits(v("phone")))"
        case "whatsapp":
            var n = digits(v("phone"))
            if n.hasPrefix("+") { n.removeFirst() }
            if n.isEmpty { return "" }
            return v("message").isEmpty ? "https://wa.me/\(n)" : "https://wa.me/\(n)?text=\(JSURI.component(v("message")))"
        case "telegram":
            var u = v("username")
            if u.hasPrefix("@") { u.removeFirst() }
            u = u.replacingOccurrences(of: #"^https?://t\.me/"#, with: "", options: .regularExpression)
            return u.isEmpty ? "" : "https://t.me/\(u)"
        case "email":
            if v("email").isEmpty { return "" }
            var q: [String] = []
            if !v("subject").isEmpty { q.append("subject=\(JSURI.form(v("subject")))") }
            if !v("body").isEmpty { q.append("body=\(JSURI.form(v("body")))") }
            return "mailto:\(v("email"))" + (q.isEmpty ? "" : "?" + q.joined(separator: "&"))
        case "contact":
            if v("firstName").isEmpty && v("lastName").isEmpty && v("phone").isEmpty { return "" }
            return ["BEGIN:VCARD", "VERSION:3.0", "N:\(vEsc(v("lastName")));\(vEsc(v("firstName")));;;",
                    "FN:\(vEsc([v("firstName"), v("lastName")].filter { !$0.isEmpty }.joined(separator: " ")))",
                    v("phone").isEmpty ? "" : "TEL;TYPE=CELL:\(digits(v("phone")))",
                    v("email").isEmpty ? "" : "EMAIL:\(v("email"))",
                    v("company").isEmpty ? "" : "ORG:\(vEsc(v("company")))",
                    v("website").isEmpty ? "" : "URL:\(Self.normalizeURL(v("website")))", "END:VCARD"]
                .filter { !$0.isEmpty }.joined(separator: "\n")
        default:
            return ""
        }
    }

    /// The code's name in "My codes" — the server gives a generator code this title (titleOfContent).
    var autoTitle: String {
        let f = fields
        let main: String
        switch type {
        case "contact":
            let n = [f["firstName"], f["lastName"]].compactMap { $0 }.filter { !$0.isEmpty }.joined(separator: " ")
            main = n.isEmpty ? (f["phone"] ?? "") : n
        case "event": main = f["title"] ?? ""
        case "wifi": main = f["ssid"] ?? ""
        default: main = f["url"] ?? f["phone"] ?? f["email"] ?? f["username"] ?? f["place"] ?? f["text"] ?? ""
        }
        let t = main.replacingOccurrences(of: #"^https?://"#, with: "", options: [.regularExpression, .caseInsensitive])
            .replacingOccurrences(of: #"\s+"#, with: " ", options: .regularExpression)
            .trimmingCharacters(in: .whitespacesAndNewlines)
        let cut = String(t.prefix(60))
        return cut.isEmpty ? type : cut
    }

    static func normalizeURL(_ raw: String) -> String {
        let s = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        if s.isEmpty { return "" }
        if s.range(of: #"^[a-z][a-z\d+.-]*:"#, options: [.regularExpression, .caseInsensitive]) != nil { return s }
        return "https://\(s)"
    }
}

/// JavaScript's URL encodings, byte for byte.
enum JSURI {
    /// encodeURIComponent: keeps A–Z a–z 0–9 - _ . ! ~ * ' ( )
    static func component(_ s: String) -> String {
        s.addingPercentEncoding(withAllowedCharacters: CharacterSet(charactersIn: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_.!~*'()")) ?? s
    }
    /// URLSearchParams, then "+" → "%20" (as the site's email builder does): keeps A–Z a–z 0–9 * - . _
    static func form(_ s: String) -> String {
        s.addingPercentEncoding(withAllowedCharacters: CharacterSet(charactersIn: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789*-._ "))?
            .replacingOccurrences(of: " ", with: "%20") ?? s
    }
}
