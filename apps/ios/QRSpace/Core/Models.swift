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

/// GET /api/me
struct MeResponse: Decodable {
    let me: String?
    let base: String?
    let people: [Person]?
    let demo: Bool?
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
    let author: String
    let at: String
}

struct CodeStyle: Decodable, Hashable {
    let bg: String?
    let fg: String?
}

/// What the generator put in the code: {type: "url" | "wifi" | …, fields}.
struct Content: Decodable, Hashable {
    let type: String
    let fields: [String: String]
}

struct Storage: Decodable, Hashable {
    let used: Int
    let quota: Int
}

/// GET /api/codes/{id} — the code as the current person sees it. blocks == nil → closed to me.
struct CodeView: Decodable, Identifiable, Hashable {
    let id: String
    let kind: String
    let owner: String?
    let title: String?
    let short: String?
    let access: AccessLevel
    let visibility: String?
    let blocks: [Block]?
    let style: CodeStyle?
    let content: Content?
    let blocked: Bool?
    let storage: Storage?
    let requested: Bool?

    /// What is printed in the code: our short link (/K/…) or, for old codes, /c/{id}.
    func link(base: String) -> String {
        if let s = short, !s.isEmpty { return "\(base)/K/\(s)" }
        return "\(base)/c/\(id)"
    }
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
}

/// GET /api/notifications
struct Notices: Decodable {
    let unread: Int
    let due: Int
}

enum Format {
    static func bytes(_ n: Int) -> String {
        let f = ByteCountFormatter()
        f.countStyle = .file
        f.allowsNonnumericFormatting = false
        return f.string(fromByteCount: Int64(n))
    }
    static func money(_ v: Double) -> String {
        v == v.rounded() ? "$\(Int(v))" : String(format: "$%.2f", v)
    }
    static func date(_ iso: String) -> String {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        guard let d = f.date(from: iso) ?? ISO8601DateFormatter().date(from: iso) else { return iso }
        return d.formatted(date: .abbreviated, time: .omitted)
    }
}
