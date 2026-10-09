import Foundation

// Shapes of the qrspace.co API (src/lib/codes.ts, src/app/api/**). Only what the app reads; everything optional
// where the server may leave it out, so a new field on the server never breaks decoding.

/// Name in several languages: {hy, ru, en, …}.
struct L10nName: Codable, Hashable {
    let values: [String: String]
    init(from decoder: Decoder) throws {
        let c = try decoder.singleValueContainer()
        if let s = try? c.decode(String.self) { values = ["en": s] } else { values = try c.decode([String: String].self) }
    }
    func encode(to encoder: Encoder) throws { var c = encoder.singleValueContainer(); try c.encode(values) }
    var text: String { values[uiLanguage] ?? values["en"] ?? values.values.first ?? "" }
}

/// Any JSON value (kept as is, e.g. a saved style we only hash).
enum JSONValue: Codable, Hashable {
    case null, bool(Bool), number(Double), string(String), array([JSONValue]), object([String: JSONValue])

    init(from decoder: Decoder) throws {
        let c = try decoder.singleValueContainer()
        if c.decodeNil() { self = .null }
        else if let b = try? c.decode(Bool.self) { self = .bool(b) }
        else if let n = try? c.decode(Double.self) { self = .number(n) }
        else if let s = try? c.decode(String.self) { self = .string(s) }
        else if let a = try? c.decode([JSONValue].self) { self = .array(a) }
        else { self = .object(try c.decode([String: JSONValue].self)) }
    }

    func encode(to encoder: Encoder) throws {
        var c = encoder.singleValueContainer()
        switch self {
        case .null: try c.encodeNil()
        case .bool(let b): try c.encode(b)
        case .number(let n): try c.encode(n)
        case .string(let s): try c.encode(s)
        case .array(let a): try c.encode(a)
        case .object(let o): try c.encode(o)
        }
    }

    subscript(_ key: String) -> JSONValue? { if case .object(let o) = self { return o[key] } else { return nil } }
    var string: String? { if case .string(let s) = self { return s } else { return nil } }
    var number: Double? { if case .number(let n) = self { return n } else { return nil } }

    /// Stable text (sorted keys) — for cache keys.
    var canonical: String {
        let enc = JSONEncoder()
        enc.outputFormatting = [.sortedKeys, .withoutEscapingSlashes]
        return (try? enc.encode(self)).map { String(decoding: $0, as: UTF8.self) } ?? ""
    }
}

/// GET /api/me
struct MeResponse: Decodable {
    let me: String?
    let base: String?
    let people: [Person]?
    let demo: Bool?
    let providers: Providers?
}

/// Which real sign-ins the server has keys for (false until the owner adds Google / Apple keys).
struct Providers: Decodable, Equatable {
    let google: Bool
    let apple: Bool
}

struct Person: Decodable, Identifiable, Hashable {
    let id: String
    let name: L10nName
    let color: String?
    let demo: L10nName?
}

/// GET /api/codes
struct CodeList: Decodable {
    let base: String
    let mine: [CodeView]
    let shared: [CodeView]
}

enum AccessLevel: String, Decodable { case owner, edit, view, closed }

struct Block: Decodable, Identifiable, Hashable {
    let id: String
    let kind: String // text | photo | video
    let text: String
    let media: String?
    let author: String?
    let at: String
    let size: Int?
}

/// The saved look of a code (src/lib/qr/style.ts SavedStyle) — the whole object, plus the two colors the app uses.
struct CodeStyle: Decodable, Hashable {
    let raw: JSONValue
    var bg: String? { raw["bg"]?.string }
    var fg: String? { raw["fg"]?.string }
    init(from decoder: Decoder) throws { raw = try JSONValue(from: decoder) }
}

/// What the generator put in the code: {type: "url" | "wifi" | …, fields}.
struct Content: Codable, Hashable {
    var type: String
    var fields: [String: String]

    init(type: String, fields: [String: String]) {
        self.type = type
        self.fields = fields
    }
    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        type = try c.decode(String.self, forKey: .type)
        // Only text fields (the server keeps only strings, but never trust the shape).
        let raw = (try? c.decode([String: JSONValue].self, forKey: .fields)) ?? [:]
        fields = raw.compactMapValues(\.string)
    }
}

struct Storage: Decodable, Hashable {
    let used: Int
    let quota: Int
    let plan: String?
    let until: String?
}

/// Scans (owner only): by day for 30 days (oldest → today, UTC), total, last 7 days, people signed in.
struct ScanStats: Decodable, Hashable {
    let days: [Int]
    let total: Int
    let week: Int
    let people: Int?
}

/// A reminder ("To do"): what and when; `every` — repeat.
struct TaskItem: Decodable, Hashable, Identifiable {
    let id: String
    let text: String
    let due: String
    let every: String?
}

struct MessageLite: Decodable, Hashable { let read: Bool }
struct RequestLite: Decodable, Hashable { let personId: String }
struct Edition: Decodable, Hashable { let no: Int; let of: Int? }

/// GET /api/codes/{id} — the code as the current person sees it. blocks == nil → closed to me.
struct CodeView: Decodable, Identifiable, Hashable {
    let id: String
    let kind: String
    let owner: String?
    let title: String?
    let short: String?
    let compact: Bool?
    let access: AccessLevel
    let visibility: String?
    let blocks: [Block]?
    let style: CodeStyle?
    let content: Content?
    let blocked: Bool?
    let storage: Storage?
    let requested: Bool?
    let stats: ScanStats?
    let tasks: [TaskItem]?
    let messages: [MessageLite]?
    let requests: [RequestLite]?
    let lost: Bool?
    let edition: Edition?
    let styleLocked: Bool?
    let publicAdd: Bool?
    /// Paid (generator codes, market editions, or a memory code bought at download): full-size drawing allowed;
    /// unpaid codes get at most 256 px. nil — an older server.
    let paid: Bool?

    /// What is printed in the code (linkOf in src/lib/codes.ts): the short link in capitals for "compact" codes
    /// (every generator code), otherwise /c/{id}.
    func link(base: String) -> String {
        if compact == true, let s = short, !s.isEmpty { return "\(base.uppercased())/K/\(s)" }
        return "\(base)/c/\(id)"
    }

    /// Unread messages + access requests — the badge on the card.
    var unread: Int { (messages ?? []).filter { !$0.read }.count + (requests ?? []).count }

    var canAdd: Bool { access == .owner || access == .edit }
}

/// POST /api/codes/quick
struct QuickResult: Decodable {
    let id: String
    let link: String
}

/// POST /api/codes/{id}/upload-url — `direct: true` (production, Vercel Blob): PUT the bytes to `url` with `headers`,
/// then add the entry with `uploaded = name`.
struct UploadTicket: Decodable {
    let direct: Bool
    let name: String?
    let url: String?
    let method: String?
    let headers: [String: String]?
}

/// GET /api/verify?u=…
struct VerifyResult: Decodable {
    let result: String // ours | missing | foreign | site | text
    let id: String?
}

/// GET /api/profile
struct Profile: Decodable {
    let id: String
    let name: String
    let email: String?
    let provider: String?
    let since: String?
    let codes: Int
    let stats: ProfileStats
    let purchases: [Purchase]
    let packs: [Pack]
}

struct ProfileStats: Decodable {
    let scans30: Int
    let scans: Int
    let used: Int
    let quota: Int
    let packsLeft: Int
    let spent: Double
}

struct Purchase: Decodable, Hashable, Identifiable {
    let key: String
    let tier: String
    let price: Double
    let free: Bool
    let at: String
    let pack: String?
    var id: String { key + at }
}

struct Pack: Decodable, Hashable, Identifiable {
    let id: String
    let plan: String
    let codes: Int
    let used: Int
    let price: Double
    let at: String
    let bytes: Int?
}

/// GET /api/packs
struct PacksState: Decodable {
    let left: Int
    let packs: [Pack]
}

/// GET /api/notifications
struct Notices: Decodable {
    let unread: Int
    let due: Int
}

enum Format {
    /// "0.4 MB", "120 KB", "1 GB" — like fmtBytes on the site (1 MB = 1024 × 1024).
    static func bytes(_ n: Int) -> String {
        let f = NumberFormatter()
        f.maximumFractionDigits = 1
        f.minimumFractionDigits = 0
        f.locale = uiLocale
        let d = Double(n)
        if d >= 1024 * 1024 * 1024 { return "\(f.string(from: NSNumber(value: d / 1024 / 1024 / 1024)) ?? "") GB" }
        if d >= 1024 * 1024 { return "\(f.string(from: NSNumber(value: d / 1024 / 1024)) ?? "") MB" }
        return "\(max(1, Int((d / 1024).rounded()))) KB"
    }
    static func money(_ v: Double) -> String {
        v == v.rounded() ? "$\(Int(v))" : String(format: "$%.2f", v)
    }
    static func isoDate(_ iso: String) -> Date? {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return f.date(from: iso) ?? ISO8601DateFormatter().date(from: iso)
    }
    static func date(_ iso: String) -> String {
        guard let d = isoDate(iso) else { return iso }
        return d.formatted(Date.FormatStyle(date: .abbreviated, time: .omitted).locale(uiLocale))
    }
    static func dateTime(_ iso: String) -> String {
        guard let d = isoDate(iso) else { return iso }
        return d.formatted(Date.FormatStyle(date: .abbreviated, time: .shortened).locale(uiLocale))
    }
}
