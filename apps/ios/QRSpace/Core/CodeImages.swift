import CryptoKit
import SwiftUI
import UIKit

/// Drawings from the server — the exact look of a code, the same as on the site (/api/codes/{id}/image), and style
/// previews before a code exists (/api/preview). Kept in memory and on disk. A saved code's drawing is shown from the
/// cache at once and then revalidated with its ETag (`If-None-Match` → 304 — nothing to download; 200 — the look
/// changed, e.g. on the website). Offline, the views fall back to the local CoreImage drawing (QRRender).
actor DrawingStore {
    static let shared = DrawingStore()

    // NSCache is thread-safe.
    private nonisolated(unsafe) let memory: NSCache<NSString, UIImage> = {
        let c = NSCache<NSString, UIImage>()
        c.countLimit = 200
        return c
    }()
    private let dir: URL
    private var inflight: [String: Task<UIImage?, Never>] = [:]
    /// When each code drawing was last checked with the server, and for which style (a new style re-checks at once).
    private var checked: [String: (at: Date, style: String)] = [:]
    private let recheckAfter: TimeInterval = 30

    init() {
        let caches = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)[0]
        dir = caches.appendingPathComponent("drawings/\(AppConfig.label.replacingOccurrences(of: ":", with: "_"))", isDirectory: true)
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
    }

    static func codeKey(_ id: String, px: Int) -> String { "c-\(id)-\(px)" }
    static func previewKey(_ style: QRStyle, px: Int) -> String { "p-\(hash("\(style.json)|\(px)"))" }
    static func styleHash(_ code: CodeView, base: String) -> String {
        // `paid` changes the drawing too (unpaid codes come at most 256 px).
        hash("\(base)|\(code.link(base: base))|\(code.style?.raw.canonical ?? "null")|\(code.paid ?? false)")
    }

    private static func hash(_ s: String) -> String {
        SHA256.hash(data: Data(s.utf8)).prefix(10).map { String(format: "%02x", $0) }.joined()
    }

    /// Instant hit (memory only) — for the first frame, so cached codes don't flash a placeholder.
    nonisolated func cached(_ key: String) -> UIImage? { memory.object(forKey: key as NSString) }

    // MARK: saved codes

    /// What we already have (memory, then disk) — any version.
    func storedCode(_ id: String, px: Int) -> UIImage? {
        let key = Self.codeKey(id, px: px)
        if let hit = memory.object(forKey: key as NSString) { return hit }
        guard let d = try? Data(contentsOf: file(key, "png")), let img = UIImage(data: d) else { return nil }
        memory.setObject(img, forKey: key as NSString)
        return img
    }

    /// Asks the server (with the stored ETag). Returns a new image only when the drawing changed; nil — unchanged,
    /// checked a moment ago, or offline (the stored one stays).
    func revalidateCode(_ code: CodeView, base: String, px: Int) async -> UIImage? {
        let key = Self.codeKey(code.id, px: px)
        let style = Self.styleHash(code, base: base)
        if let c = checked[key], c.style == style, Date().timeIntervalSince(c.at) < recheckAfter { return nil }
        if let running = inflight[key] { return await running.value }
        let etagFile = file(key, "etag")
        let etag = FileManager.default.fileExists(atPath: file(key, "png").path) ? (try? String(contentsOf: etagFile, encoding: .utf8)) : nil
        let task = Task<UIImage?, Never> {
            guard let r = try? await API.shared.codeImage(code.id, size: px, etag: etag) else { return nil }
            switch r {
            case .notModified: return nil
            case .fresh(let data, let tag):
                guard let img = UIImage(data: data) else { return nil }
                try? data.write(to: self.file(key, "png"), options: .atomic)
                if let tag { try? tag.write(to: etagFile, atomically: true, encoding: .utf8) } else { try? FileManager.default.removeItem(at: etagFile) }
                return img
            }
        }
        inflight[key] = task
        let img = await task.value
        inflight[key] = nil
        checked[key] = (Date(), style)
        if let img { memory.setObject(img, forKey: key as NSString) }
        return img
    }

    // MARK: previews

    func preview(_ style: QRStyle, px: Int) async -> UIImage? {
        let key = Self.previewKey(style, px: px)
        if let hit = memory.object(forKey: key as NSString) { return hit }
        let f = file(key, "png")
        if let d = try? Data(contentsOf: f), let img = UIImage(data: d) {
            memory.setObject(img, forKey: key as NSString)
            return img
        }
        if let running = inflight[key] { return await running.value }
        let task = Task<UIImage?, Never> {
            guard let data = try? await API.shared.preview(style, size: px), let img = UIImage(data: data) else { return nil }
            try? data.write(to: f, options: .atomic)
            return img
        }
        inflight[key] = task
        let img = await task.value
        inflight[key] = nil
        if let img { memory.setObject(img, forKey: key as NSString) }
        return img
    }

    /// Forget everything (account deleted).
    func clear() {
        memory.removeAllObjects()
        checked = [:]
        for n in (try? FileManager.default.contentsOfDirectory(atPath: dir.path)) ?? [] {
            try? FileManager.default.removeItem(at: dir.appendingPathComponent(n))
        }
    }

    private nonisolated func file(_ key: String, _ ext: String) -> URL { dir.appendingPathComponent("\(key).\(ext)") }
}

/// Pixel size for a point size, in steps (256 / 512 / 1024) so the same file serves several screens.
func drawingPixels(_ points: CGFloat) -> Int {
    let px = points * UIScreen.main.scale
    return px <= 256 ? 256 : px <= 512 ? 512 : 1024
}

/// A saved code drawn by the server, on its own background "plate". Offline and never loaded — drawn on the phone.
struct CodeImage: View {
    let code: CodeView
    let base: String
    var size: CGFloat = 120
    var corner: CGFloat? = nil

    @State private var image: UIImage?
    @State private var failed = false

    private var px: Int { drawingPixels(size) }
    private var bg: UIColor { UIColor(css: code.style?.bg) ?? .white }

    var body: some View {
        Group {
            if let img = image ?? DrawingStore.shared.cached(DrawingStore.codeKey(code.id, px: px)) {
                Image(uiImage: img).resizable().interpolation(.high).scaledToFit()
                    .padding(size * 0.03)
            } else if failed {
                QRThumb(text: code.link(base: base), fg: UIColor(css: code.style?.fg) ?? .black, bg: bg, size: size)
            } else {
                Color(bg).overlay { ProgressView().tint(.gray) }
            }
        }
        .frame(width: size, height: size)
        .background(Color(bg), in: RoundedRectangle(cornerRadius: corner ?? size * 0.08))
        .clipShape(RoundedRectangle(cornerRadius: corner ?? size * 0.08))
        .task(id: "\(code.id)-\(px)-\(DrawingStore.styleHash(code, base: base))") {
            failed = false
            if let stored = await DrawingStore.shared.storedCode(code.id, px: px) { image = stored }
            if let fresh = await DrawingStore.shared.revalidateCode(code, base: base, px: px) { image = fresh }
            failed = image == nil
        }
    }
}

/// A style preview before the code exists (/api/preview), debounced. Offline — a local drawing of the sample link
/// in the chosen colors.
struct StylePreview: View {
    let style: QRStyle
    var size: CGFloat = 260
    /// Wait before asking the server (live preview while picking colors).
    var debounce: Duration = .milliseconds(300)

    @State private var shown: UIImage?
    @State private var failed = false
    @State private var loading = false

    var body: some View {
        let bg = UIColor(css: style.bg) ?? .white
        ZStack {
            Color(bg)
            if let shown {
                Image(uiImage: shown).resizable().interpolation(.high).scaledToFit().padding(size * 0.03)
            } else if failed {
                QRThumb(text: "\(API.base.absoluteString.uppercased())/K/XXXXXX", fg: UIColor(css: style.fg) ?? .black, bg: bg, size: size)
            }
            if loading && shown == nil { ProgressView().tint(.gray) }
        }
        .frame(width: size, height: size)
        .clipShape(RoundedRectangle(cornerRadius: size * 0.06))
        .task(id: style) {
            let px = drawingPixels(size)
            if let hit = DrawingStore.shared.cached(DrawingStore.previewKey(style, px: px)) { shown = hit; failed = false; return }
            loading = true
            defer { loading = false }
            do { try await Task.sleep(for: debounce) } catch { return }
            if let img = await DrawingStore.shared.preview(style, px: px) {
                guard !Task.isCancelled else { return }
                shown = img
                failed = false
            } else if !Task.isCancelled {
                shown = nil
                failed = true
            }
        }
    }
}
