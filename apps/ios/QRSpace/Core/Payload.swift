import Foundation

/// Barcode/QR kinds we scan. Raw values are stored in scan history.
enum Symbology: String, Codable, CaseIterable {
    case qr, microQR, aztec, dataMatrix, pdf417, ean13, ean8, upca, upce, code128, code39, code93, itf, codabar, gs1, unknown

    var name: String {
        switch self {
        case .qr: "QR"
        case .microQR: "Micro QR"
        case .aztec: "Aztec"
        case .dataMatrix: "Data Matrix"
        case .pdf417: "PDF417"
        case .ean13: "EAN-13"
        case .ean8: "EAN-8"
        case .upca: "UPC-A"
        case .upce: "UPC-E"
        case .code128: "Code 128"
        case .code39: "Code 39"
        case .code93: "Code 93"
        case .itf: "ITF"
        case .codabar: "Codabar"
        case .gs1: "GS1 DataBar"
        case .unknown: "—"
        }
    }

    /// 2D codes carry structured content (links, Wi‑Fi…); 1D barcodes carry a product/number.
    var is2D: Bool { [.qr, .microQR, .aztec, .dataMatrix, .pdf417].contains(self) }

    /// EAN-13 starting with 0 is a UPC-A (AVFoundation and Vision report UPC-A as EAN-13).
    static func normalized(_ s: Symbology, payload: String) -> (Symbology, String) {
        if s == .ean13, payload.count == 13, payload.hasPrefix("0") { return (.upca, String(payload.dropFirst())) }
        return (s, payload)
    }
}

/// A scanned string, understood.
enum Parsed: Equatable {
    case ours(OurLink, URL)
    case url(URL)
    case wifi(ssid: String, password: String, security: String, hidden: Bool)
    case phone(String)
    case email(address: String, subject: String, body: String)
    case sms(number: String, body: String)
    case contact(name: String, lines: [String], vcard: String)
    case event(title: String, start: Date?, end: Date?, location: String, notes: String)
    case geo(lat: Double, lon: Double, query: String)
    case text(String)
    case barcode(String, Symbology)

    static func parse(_ raw: String, symbology: Symbology = .qr) -> Parsed {
        let s = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        if !symbology.is2D && symbology != .unknown {
            // A URL in a 1D code is rare but possible (Code 128).
            if symbology == .code128 || symbology == .code39 || symbology == .code93, let u = webURL(s) { return u }
            return .barcode(s, symbology)
        }
        let upper = s.uppercased()
        if upper.hasPrefix("WIFI:") { return wifi(s) }
        if upper.hasPrefix("BEGIN:VCARD") { return vcard(s) }
        if upper.hasPrefix("MECARD:") { return mecard(s) }
        if upper.hasPrefix("BEGIN:VEVENT") || upper.hasPrefix("BEGIN:VCALENDAR") { return event(s) }
        if upper.hasPrefix("TEL:") { return .phone(String(s.dropFirst(4))) }
        if upper.hasPrefix("MAILTO:") { return mailto(s) }
        if upper.hasPrefix("MATMSG:") { return matmsg(s) }
        if upper.hasPrefix("SMSTO:") || upper.hasPrefix("SMS:") || upper.hasPrefix("MMSTO:") { return sms(s) }
        if upper.hasPrefix("GEO:"), let g = geo(s) { return g }
        if let u = webURL(s) { return u }
        // Other app schemes (viber://, tg://, whatsapp://…) — open as a link.
        if let u = URL(string: s), let sch = u.scheme, sch.count > 1, !s.contains(" "), s.contains(":") ,
           ["viber", "tg", "whatsapp", "itms-apps", "facetime", "maps"].contains(sch.lowercased()) {
            return .url(u)
        }
        return .text(s)
    }

    private static func webURL(_ s: String) -> Parsed? {
        var str = s
        let lower = s.lowercased()
        if !lower.hasPrefix("http://") && !lower.hasPrefix("https://") {
            // "qrspace.co/K/AB12" or "www.example.com" without a scheme.
            guard !s.contains(" "), !s.contains("\n"), s.range(of: #"^[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)+(/\S*)?$"#, options: .regularExpression) != nil,
                  lower.hasPrefix("www.") || lower.hasPrefix("qrspace.co") else { return nil }
            str = "https://" + s
        }
        guard let u = URL(string: str), u.host != nil else { return nil }
        if let ours = OurLink(u) { return .ours(ours, u) }
        return .url(u)
    }

    /// "a\;b" → split on unescaped separators.
    private static func splitEscaped(_ s: String, on sep: Character) -> [String] {
        var parts: [String] = [], cur = "", esc = false
        for ch in s {
            if esc { cur.append(ch); esc = false; continue }
            if ch == "\\" { esc = true; continue }
            if ch == sep { parts.append(cur); cur = ""; continue }
            cur.append(ch)
        }
        parts.append(cur)
        return parts
    }

    /// "KEY:value;KEY:value;;" after a prefix → [KEY: value]
    private static func fields(_ body: String) -> [String: String] {
        var out: [String: String] = [:]
        for part in splitEscaped(body, on: ";") {
            guard let i = part.firstIndex(of: ":") else { continue }
            let k = part[..<i].uppercased()
            if out[k] == nil { out[k] = String(part[part.index(after: i)...]) }
        }
        return out
    }

    private static func wifi(_ s: String) -> Parsed {
        let f = fields(String(s.dropFirst(5)))
        return .wifi(ssid: f["S"] ?? "", password: f["P"] ?? "", security: (f["T"] ?? "").isEmpty ? "nopass" : f["T"]!,
                     hidden: (f["H"] ?? "").lowercased() == "true")
    }

    private static func mailto(_ s: String) -> Parsed {
        guard let c = URLComponents(string: s) else { return .text(s) }
        let q = Dictionary((c.queryItems ?? []).map { ($0.name.lowercased(), $0.value ?? "") }, uniquingKeysWith: { a, _ in a })
        return .email(address: c.path, subject: q["subject"] ?? "", body: q["body"] ?? "")
    }

    private static func matmsg(_ s: String) -> Parsed {
        let f = fields(String(s.dropFirst(7)))
        return .email(address: f["TO"] ?? "", subject: f["SUB"] ?? "", body: f["BODY"] ?? "")
    }

    private static func sms(_ s: String) -> Parsed {
        let upper = s.uppercased()
        if upper.hasPrefix("SMSTO:") || upper.hasPrefix("MMSTO:") {
            let rest = s.dropFirst(6)
            let parts = rest.split(separator: ":", maxSplits: 1, omittingEmptySubsequences: false)
            return .sms(number: String(parts.first ?? ""), body: parts.count > 1 ? String(parts[1]) : "")
        }
        // sms:+123?body=hi
        let rest = String(s.dropFirst(4))
        let c = URLComponents(string: "sms:" + rest)
        let body = c?.queryItems?.first { $0.name.lowercased() == "body" }?.value ?? ""
        return .sms(number: rest.components(separatedBy: "?").first ?? rest, body: body)
    }

    private static func geo(_ s: String) -> Parsed? {
        let rest = String(s.dropFirst(4))
        let main = rest.components(separatedBy: "?").first ?? rest
        let nums = main.split(separator: ",").map { Double($0.trimmingCharacters(in: .whitespaces)) }
        guard nums.count >= 2, let lat = nums[0], let lon = nums[1] else { return nil }
        let q = URLComponents(string: "geo:x?" + (rest.components(separatedBy: "?").dropFirst().first ?? ""))?
            .queryItems?.first { $0.name == "q" }?.value ?? ""
        return .geo(lat: lat, lon: lon, query: q)
    }

    private static func unescapeV(_ s: String) -> String {
        s.replacingOccurrences(of: "\\n", with: "\n").replacingOccurrences(of: "\\N", with: "\n")
            .replacingOccurrences(of: "\\,", with: ",").replacingOccurrences(of: "\\;", with: ";")
            .replacingOccurrences(of: "\\\\", with: "\\")
    }

    /// vCard/iCal lines: unfold continuation lines, then KEY;params:value.
    private static func props(_ s: String) -> [(key: String, value: String)] {
        let unfolded = s.replacingOccurrences(of: "\r\n", with: "\n").replacingOccurrences(of: "\n ", with: "")
        return unfolded.split(separator: "\n").compactMap { line in
            guard let i = line.firstIndex(of: ":") else { return nil }
            let key = line[..<i].split(separator: ";").first.map { $0.uppercased() } ?? ""
            return (key, String(line[line.index(after: i)...]))
        }
    }

    private static func vcard(_ s: String) -> Parsed {
        var name = "", lines: [String] = []
        for p in props(s) {
            switch p.key {
            case "FN": name = unescapeV(p.value)
            case "N" where name.isEmpty:
                let n = splitEscaped(p.value, on: ";")
                name = [n.count > 1 ? n[1] : "", n.first ?? ""].filter { !$0.isEmpty }.joined(separator: " ")
            case "TEL", "EMAIL", "URL": lines.append(unescapeV(p.value))
            case "ORG": lines.append(unescapeV(p.value).replacingOccurrences(of: ";", with: " "))
            case "ADR": lines.append(splitEscaped(p.value, on: ";").filter { !$0.isEmpty }.joined(separator: ", "))
            default: break
            }
        }
        return .contact(name: name, lines: lines, vcard: s)
    }

    private static func mecard(_ s: String) -> Parsed {
        let f = fields(String(s.dropFirst(7)))
        let n = (f["N"] ?? "").split(separator: ",").map(String.init)
        let first = n.count > 1 ? n[1] : "", last = n.first ?? ""
        var v = ["BEGIN:VCARD", "VERSION:3.0", "N:\(last);\(first);;;", "FN:\([first, last].filter { !$0.isEmpty }.joined(separator: " "))"]
        var lines: [String] = []
        if let t = f["TEL"], !t.isEmpty { v.append("TEL:\(t)"); lines.append(t) }
        if let e = f["EMAIL"], !e.isEmpty { v.append("EMAIL:\(e)"); lines.append(e) }
        if let u = f["URL"], !u.isEmpty { v.append("URL:\(u)"); lines.append(u) }
        if let a = f["ADR"], !a.isEmpty { v.append("ADR:;;\(a);;;;"); lines.append(a) }
        v.append("END:VCARD")
        return .contact(name: [first, last].filter { !$0.isEmpty }.joined(separator: " "), lines: lines, vcard: v.joined(separator: "\n"))
    }

    private static func icsDate(_ v: String) -> Date? {
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_US_POSIX")
        let utc = v.hasSuffix("Z")
        f.timeZone = utc ? TimeZone(identifier: "UTC") : .current
        for fmt in ["yyyyMMdd'T'HHmmss'Z'", "yyyyMMdd'T'HHmmss", "yyyyMMdd'T'HHmm", "yyyyMMdd"] {
            f.dateFormat = fmt
            if let d = f.date(from: v) { return d }
        }
        return nil
    }

    private static func event(_ s: String) -> Parsed {
        var title = "", start: Date?, end: Date?, loc = "", notes = ""
        for p in props(s) {
            switch p.key {
            case "SUMMARY": title = unescapeV(p.value)
            case "DTSTART": start = icsDate(p.value)
            case "DTEND": end = icsDate(p.value)
            case "LOCATION": loc = unescapeV(p.value)
            case "DESCRIPTION": notes = unescapeV(p.value)
            default: break
            }
        }
        return .event(title: title, start: start, end: end, location: loc, notes: notes)
    }
}

/// Server code content → the string the generator puts in a code (port of buildPayload, src/lib/qr/payload.ts),
/// so the app shows it with the same actions as a scan.
extension Content {
    var payload: String {
        let v = { (k: String) in (fields[k] ?? "").trimmingCharacters(in: .whitespaces) }
        let digits = { (s: String) in s.filter { $0.isNumber || $0 == "+" } }
        let esc = { (s: String) in s.replacingOccurrences(of: #"([\\;,:"])"#, with: #"\\$1"#, options: .regularExpression) }
        let vesc = { (s: String) in s.replacingOccurrences(of: #"([\\;,])"#, with: #"\\$1"#, options: .regularExpression).replacingOccurrences(of: "\n", with: "\\n") }
        let norm = { (s: String) -> String in
            s.range(of: #"^[a-z][a-z\d+.-]*:"#, options: [.regularExpression, .caseInsensitive]) != nil ? s : (s.isEmpty ? "" : "https://\(s)")
        }
        let enc = { (s: String) in s.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed.subtracting(CharacterSet(charactersIn: "&=+?"))) ?? s }
        let social: [String: String] = ["instagram": "https://instagram.com/", "facebook": "https://facebook.com/", "tiktok": "https://www.tiktok.com/@",
                                        "youtube": "https://youtube.com/@", "linkedin": "https://www.linkedin.com/in/", "x": "https://x.com/"]
        switch type {
        case "url": return norm(v("url"))
        case "text": return fields["text"] ?? ""
        case "wifi":
            let sec = v("security").isEmpty ? "WPA" : v("security")
            return "WIFI:T:\(sec);S:\(esc(fields["ssid"] ?? ""));" + (sec == "nopass" ? "" : "P:\(esc(fields["password"] ?? ""));") + ";"
        case "phone": return "tel:\(digits(v("phone")))"
        case "sms": return "SMSTO:\(digits(v("phone"))):\(v("message"))"
        case "viber":
            let n = digits(v("phone"))
            return "viber://chat?number=\(enc(n.hasPrefix("+") ? n : "+\(n)"))"
        case "whatsapp":
            let n = digits(v("phone")).replacingOccurrences(of: "+", with: "")
            return v("message").isEmpty ? "https://wa.me/\(n)" : "https://wa.me/\(n)?text=\(enc(v("message")))"
        case "telegram":
            let u = v("username").replacingOccurrences(of: "@", with: "").replacingOccurrences(of: "https://t.me/", with: "")
            return "https://t.me/\(u)"
        case "email":
            var q: [String] = []
            if !v("subject").isEmpty { q.append("subject=\(enc(v("subject")))") }
            if !v("body").isEmpty { q.append("body=\(enc(v("body")))") }
            return "mailto:\(v("email"))" + (q.isEmpty ? "" : "?" + q.joined(separator: "&"))
        case "location":
            let q = v("place")
            if let m = q.range(of: #"^\s*(-?\d+(\.\d+)?)\s*[,;\s]\s*(-?\d+(\.\d+)?)\s*$"#, options: .regularExpression) {
                let nums = q[m].split(whereSeparator: { ",; ".contains($0) })
                if nums.count == 2 { return "geo:\(nums[0]),\(nums[1])" }
            }
            return "https://maps.apple.com/?q=\(enc(q))"
        case "contact":
            let lines = ["BEGIN:VCARD", "VERSION:3.0", "N:\(vesc(v("lastName")));\(vesc(v("firstName")));;;",
                         "FN:\(vesc([v("firstName"), v("lastName")].filter { !$0.isEmpty }.joined(separator: " ")))",
                         v("phone").isEmpty ? "" : "TEL;TYPE=CELL:\(digits(v("phone")))",
                         v("email").isEmpty ? "" : "EMAIL:\(v("email"))",
                         v("company").isEmpty ? "" : "ORG:\(vesc(v("company")))",
                         v("website").isEmpty ? "" : "URL:\(norm(v("website")))", "END:VCARD"]
            return lines.filter { !$0.isEmpty }.joined(separator: "\n")
        case "event":
            let ics = { (s: String) in String((s.replacingOccurrences(of: "-", with: "").replacingOccurrences(of: ":", with: "") + "0000000000000").prefix(13)) + "00" }
            let lines = ["BEGIN:VEVENT", "SUMMARY:\(vesc(v("title")))", "DTSTART:\(ics(v("start")))",
                         v("end").isEmpty ? "" : "DTEND:\(ics(v("end")))", v("place").isEmpty ? "" : "LOCATION:\(vesc(v("place")))",
                         v("notes").isEmpty ? "" : "DESCRIPTION:\(vesc(v("notes")))", "END:VEVENT"]
            return lines.filter { !$0.isEmpty }.joined(separator: "\n")
        default:
            if let prefix = social[type] {
                let u = v("username")
                if u.lowercased().hasPrefix("http") { return u }
                return prefix + u.replacingOccurrences(of: "@", with: "")
            }
            return ""
        }
    }
}
