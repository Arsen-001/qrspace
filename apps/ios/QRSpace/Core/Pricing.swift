import Foundation

// Prices and the space under a code — ports of src/lib/pricing.ts and the storage part of src/lib/codes.ts.
// The server decides everything that costs money; the app only shows the same numbers the site shows.

enum Tier: String, Decodable { case simple, styled }

/// GET /api/purchases?key=&tier= — what downloading (in the app: creating) this code costs this person.
struct Quote: Decodable, Equatable {
    let paid: Bool
    let price: Double
    let free: Bool
    /// Can come from a pack: how many codes are left and the space under each.
    let pack: PackQuote?
    struct PackQuote: Decodable, Equatable { let left: Int; let bytes: Int }
}

enum Pricing {
    static let simpleDots: Set<String> = ["square", "rounded", "dots"]
    static let simpleEyes: Set<String> = ["square", "rounded", "circle"]
    static let simpleBalls: Set<String> = ["auto", "square", "rounded", "circle"]

    /// Colors, gradient and rotation are "simple"; other shapes and effects are "styled" (tierOf).
    static func tier(of s: QRStyle) -> Tier {
        let styled = !simpleDots.contains(s.dot) || !simpleEyes.contains(s.eye) || !simpleBalls.contains(s.eyeBall) || s.effect != "none"
        return styled ? .styled : .simple
    }

    /// The tier of a saved code's look (the server's SavedStyle; no style — the default, simple).
    static func tier(ofSaved raw: JSONValue?) -> Tier {
        guard let r = raw, case .object = r else { return .simple }
        let has = { (k: String) -> Bool in if let v = r[k], v != .null { return true } else { return false } }
        let styled = !simpleDots.contains(r["dot"]?.string ?? "square") || !simpleEyes.contains(r["eye"]?.string ?? "square")
            || !simpleBalls.contains(r["eyeBall"]?.string ?? "auto") || (r["effect"]?.string ?? "none") != "none"
            || has("texture") || has("picture") || has("eyeIcon")
        return styled ? .styled : .simple
    }

    /// The code's key for payment: what's in it and how it looks (codeKey — the same hash as the site, so a code
    /// bought on the site counts as bought in the app). JS strings are UTF-16 and Math.imul is a 32-bit multiply.
    static func codeKey(payload: String, styleJSON: String) -> String {
        var h1: UInt32 = 0x811c9dc5
        var h2: UInt32 = 0x01000193
        for c in (payload + "\u{0}" + styleJSON).utf16 {
            h1 = (h1 ^ UInt32(c)) &* 16_777_619
            h2 = (h2 ^ UInt32(c)) &* 2_246_822_519
        }
        return "g:\(String(h1, radix: 36))\(String(h2, radix: 36))"
    }
}

/// Space under a code (the owner's decisions of 08.10 and 09.10.2026): 1 MB free; more is monthly. Demo prices.
enum StoragePlans {
    struct Plan: Equatable, Identifiable { let id: String; let bytes: Int; let price: Double }

    static let free = 1024 * 1024
    static let all: [Plan] = [
        Plan(id: "s10", bytes: 10 * 1024 * 1024, price: 1),
        Plan(id: "s100", bytes: 100 * 1024 * 1024, price: 3),
        Plan(id: "s1000", bytes: 1024 * 1024 * 1024, price: 9),
    ]
    /// One file — at most the biggest space (1 GB).
    static let maxFile = 1024 * 1024 * 1024

    /// The owner can switch plans (each is a purchase) — only in builds with purchases (StoreBuild).
    static var canChange: Bool { StoreBuild.purchasesEnabled }

    /// The smallest plan this many bytes fit into; nil — fits into the free 1 MB, or more than the biggest plan.
    static func planFor(_ bytes: Int) -> Plan? {
        bytes <= free ? nil : all.first { $0.bytes >= bytes }
    }

    /// Does a new record of `need` bytes fit under the code? (No storage info — the server decides.)
    static func fits(_ storage: Storage?, need: Int) -> Bool {
        guard let s = storage else { return true }
        return s.used + need <= s.quota
    }
}

/// What the room offer shows when a file doesn't fit (Memory.tsx RoomOffer).
struct RoomOffer: Equatable {
    let need: Int
    let used: Int
    let quota: Int
    var free: Int { max(0, quota - used) }
    /// nil — more than the biggest plan holds.
    var plan: StoragePlans.Plan? { StoragePlans.planFor(used + need) }

    init?(storage: Storage?, need: Int) {
        guard let s = storage, s.used + need > s.quota else { return nil }
        self.need = need
        used = s.used
        quota = s.quota
    }
}

/// The look of a new code — the part of the site's SavedStyle the app edits (colors, shapes, presets).
/// `json` is exactly what JSON.stringify(toSaved(style)) gives on the site (same key order), for codeKey.
struct QRStyle: Equatable, Hashable {
    struct Gradient: Equatable, Hashable { var to: String; var angle: Int }

    var fg = "#111111"
    var bg = "#ffffff"
    var eyeColor = "#111111"
    var dot = "square"
    var eye = "square"
    var eyeBall = "auto"
    var eyeBallColor = "#111111"
    var gradient: Gradient? = nil
    var rotate = 0
    var effect = "none"

    static let `default` = QRStyle()

    var json: String {
        let g = gradient.map { "{\"to\":\"\($0.to)\",\"angle\":\($0.angle)}" } ?? "null"
        return "{\"fg\":\"\(fg)\",\"bg\":\"\(bg)\",\"eyeColor\":\"\(eyeColor)\",\"dot\":\"\(dot)\",\"eye\":\"\(eye)\","
            + "\"eyeBall\":\"\(eyeBall)\",\"eyeBallColor\":\"\(eyeBallColor)\",\"gradient\":\(g),\"rotate\":\(rotate),"
            + "\"effect\":\"\(effect)\",\"texture\":null,\"eyeIcon\":null,\"logo\":null,\"picture\":null}"
    }

    var jsonObject: [String: Any] {
        (try? JSONSerialization.jsonObject(with: Data(json.utf8))) as? [String: Any] ?? [:]
    }

    /// Change the dot color; corners that followed it follow again (StylePanel).
    mutating func setFg(_ v: String) {
        if eyeBallColor == eyeColor { eyeBallColor = eyeColor == fg ? v : eyeColor }
        if eyeColor == fg { eyeColor = v }
        fg = v
    }

    /// A color pair from the presets / swap: dots, corners and centers in one color.
    mutating func setPair(fg: String, bg: String) {
        self.fg = fg
        self.bg = bg
        eyeColor = fg
        eyeBallColor = fg
    }

    /// Ready styles (src/lib/qr/presets.ts STYLE_PRESETS); names are `preset.<id>` in the dictionaries.
    struct Preset: Identifiable { let id: String; let style: QRStyle }
    static let presets: [Preset] = {
        func p(_ id: String, _ fg: String, _ bg: String, _ dot: String, _ eye: String, _ ball: String,
               ballColor: String? = nil, gradient: Gradient? = nil, effect: String = "none") -> Preset {
            Preset(id: id, style: QRStyle(fg: fg, bg: bg, eyeColor: fg, dot: dot, eye: eye, eyeBall: ball,
                                          eyeBallColor: ballColor ?? fg, gradient: gradient, rotate: 0, effect: effect))
        }
        return [
            p("classic", "#111111", "#ffffff", "square", "square", "auto"),
            p("soft", "#1b2a4a", "#ffffff", "rounded", "rounded", "auto"),
            p("dots", "#4c1d95", "#f7f3ff", "dots", "circle", "circle"),
            p("lime", "#0b0b0c", "#c6ff2e", "rounded", "drop", "drop"),
            p("night", "#f3f2ec", "#0b0b0c", "liquid", "rounded", "rounded", ballColor: "#c6ff2e"),
            p("hearts", "#9b1b2a", "#fff5f5", "heart", "circle", "circle"),
            p("stars", "#151a3d", "#ffffff", "star", "octagon", "star", ballColor: "#5b2a86"),
            p("circuit", "#0b5132", "#e6f4ea", "circuit", "chip", "square"),
            p("gradient", "#7a1f2b", "#ffffff", "diamond", "leaf", "leaf", gradient: Gradient(to: "#2e3fd6", angle: 45)),
            p("raised", "#111111", "#f3efe6", "rounded", "rounded", "auto", effect: "raised"),
        ]
    }()

    /// Keep rotation; take the preset's colors, shapes, gradient and effect.
    func applying(_ p: Preset) -> QRStyle { var s = p.style; s.rotate = rotate; return s }
    func matches(_ p: Preset) -> Bool { applying(p) == self }

    /// Color pairs (StylePanel PRESETS).
    static let colorPairs: [(fg: String, bg: String)] = [
        ("#111111", "#ffffff"), ("#1b2a4a", "#ffffff"), ("#7a1f2b", "#fff8f0"), ("#14532d", "#f2fbf4"),
        ("#4c1d95", "#f7f3ff"), ("#ffffff", "#111111"), ("#0b5132", "#e6f4ea"),
    ]
    static let dots = ["square", "rounded", "dots", "diamond", "star", "heart", "plus", "liquid", "leaf", "circuit"]
    static let eyes = ["square", "rounded", "circle", "leaf", "drop", "dropOut", "octagon", "mixed", "dotted", "chip", "ornate"]

    /// Contrast of dots and background (WCAG ratio). Below 2.5 phones may not read it.
    var contrast: Double {
        func lum(_ hex: String) -> Double {
            let v = UInt32(hex.dropFirst(), radix: 16) ?? 0
            func ch(_ x: UInt32) -> Double {
                let c = Double(x) / 255
                return c <= 0.03928 ? c / 12.92 : pow((c + 0.055) / 1.055, 2.4)
            }
            return 0.2126 * ch((v >> 16) & 0xFF) + 0.7152 * ch((v >> 8) & 0xFF) + 0.0722 * ch(v & 0xFF)
        }
        let a = lum(fg), b = lum(bg)
        return (max(a, b) + 0.05) / (min(a, b) + 0.05)
    }
}
