import Foundation

/// qrspace.co API. The session is the server's `qr-session` cookie: URLSession keeps it in
/// HTTPCookieStorage.shared (persisted across launches), exactly like the browser does.
enum APIError: Error, Equatable {
    case login        // 401 — not signed in
    case bad          // 400 — the server didn't accept the data
    case payment      // 402 — no unused purchase for this code (pay first)
    case forbidden    // 403
    case notFound     // 404
    case conflict     // 409 — e.g. less space than already used, style locked
    case tooLarge     // 413 — doesn't fit into the space under the code (the server measured it)
    case limit        // 429 — daily limit
    case http(Int)
    case offline
}

final class API {
    static let shared = API()
    /// Production, or the local dev server in Debug builds (AppConfig).
    static var base: URL { AppConfig.base }
    /// Hosts whose /K/ and /c/ links are ours.
    static let productionHosts: Set<String> = ["qrspace.co", "www.qrspace.co", "qrspace-one.vercel.app"]

    /// Link bases the server reported (`base` in /api/me and /api/codes) — on a dev server that's the Mac's LAN address.
    private static let lock = NSLock()
    nonisolated(unsafe) private static var extraHosts: Set<String> = []
    static func noteBase(_ s: String?) {
        guard let h = s.flatMap(URL.init(string:))?.host?.lowercased() else { return }
        lock.lock(); extraHosts.insert(h); lock.unlock()
    }
    static func isOurHost(_ host: String?) -> Bool {
        guard let h = host?.lowercased() else { return false }
        if productionHosts.contains(h) || h == base.host?.lowercased() { return true }
        lock.lock(); defer { lock.unlock() }
        return extraHosts.contains(h)
    }

    private let session: URLSession
    private let guestSession: URLSession
    private let noRedirect: URLSession
    private let decoder = JSONDecoder()

    private init() {
        let cfg = URLSessionConfiguration.default
        cfg.httpCookieStorage = .shared
        cfg.httpShouldSetCookies = true
        cfg.httpCookieAcceptPolicy = .always
        cfg.timeoutIntervalForRequest = 20
        session = URLSession(configuration: cfg)
        noRedirect = URLSession(configuration: cfg, delegate: NoRedirect(), delegateQueue: nil)
        // "As others see it": the same request without my cookie.
        let guest = URLSessionConfiguration.ephemeral
        guest.httpShouldSetCookies = false
        guest.httpCookieAcceptPolicy = .never
        guest.timeoutIntervalForRequest = 20
        guestSession = URLSession(configuration: guest)
    }

    // MARK: who I am

    func me() async throws -> MeResponse {
        let r: MeResponse = try await get("/api/me")
        API.noteBase(r.base)
        return r
    }
    /// Demo sign-in (only while the server has DEMO_LOGIN on). nil — sign out.
    func signIn(personId: String?) async throws {
        let body: [String: Any] = ["personId": personId.map { $0 as Any } ?? NSNull()]
        _ = try await send("/api/me", method: "POST", json: body)
    }
    /// The one-time code from `qrspace://auth?token=…` (after /app/callback) → the session cookie in this URLSession.
    func exchange(token: String) async throws {
        _ = try await send("/api/auth/token", method: "POST", json: ["token": token])
    }
    func profile() async throws -> Profile { try await get("/api/profile") }
    /// Delete my account for good (codes, memory, files, purchases). Demo accounts — 403.
    func deleteAccount() async throws {
        _ = try await send("/api/profile", method: "DELETE", json: nil)
    }
    func notices() async throws -> Notices { try await get("/api/notifications") }

    // MARK: codes

    func codes() async throws -> CodeList {
        let r: CodeList = try await get("/api/codes")
        API.noteBase(r.base)
        return r
    }
    /// `visit: true` — this is a scan: the server writes it into the code's history (not for the owner).
    func code(_ id: String, visit: Bool = false) async throws -> CodeView {
        try await get("/api/codes/\(esc(id))" + (visit ? "?visit=1" : ""))
    }
    /// The code as a person who isn't signed in sees it ("As others see it").
    func codeAsGuest(_ id: String) async throws -> CodeView {
        try decode(try await send("/api/codes/\(esc(id))", method: "GET", json: nil, using: guestSession))
    }
    /// A code with memory (templates: memory, car, lost, pet, link).
    func create(title: String, kind: String, style: QRStyle) async throws -> CodeView {
        try decode(try await send("/api/codes", method: "POST", json: ["title": title, "kind": kind, "style": style.jsonObject]))
    }
    /// A generator code (link, Wi‑Fi, contact…): our short link + the content. `key` — the one paid in
    /// POST /api/purchases (one purchase = one code; 402 without it). The same content and look again → the same code.
    func quick(content: Content, style: QRStyle, key: String, title: String?) async throws -> QuickResult {
        var body: [String: Any] = ["content": ["type": content.type, "fields": content.fields], "style": style.jsonObject, "key": key]
        if let title, !title.isEmpty { body["title"] = title }
        return try decode(try await send("/api/codes/quick", method: "POST", json: body))
    }
    /// title, visibility, content, publicAdd… — owner only.
    func patch(_ id: String, _ body: [String: Any]) async throws -> CodeView {
        try decode(try await send("/api/codes/\(esc(id))", method: "PATCH", json: body))
    }
    func doneTask(_ id: String, task: String) async throws -> CodeView {
        try decode(try await send("/api/codes/\(esc(id))/tasks/\(esc(task))", method: "PATCH", json: ["done": true]))
    }

    // MARK: memory

    /// Text and/or a file (photo or video) as a multipart form. The body is streamed from a temporary file, so a
    /// big video never sits in memory. The server measures the real size and answers 413 if it doesn't fit.
    /// `uploaded` — the name of a video already PUT straight into storage (see `uploadURL`).
    func addBlock(_ id: String, text: String, file: UploadFile?, uploaded: String? = nil,
                  progress: (@Sendable (Double) -> Void)? = nil) async throws -> CodeView {
        var fields = ["text": text]
        if let uploaded { fields["uploaded"] = uploaded }
        let form = try Multipart.write(fields: fields, file: file)
        defer { try? FileManager.default.removeItem(at: form.url) }
        var req = request("/api/codes/\(esc(id))/blocks", method: "POST")
        req.setValue("multipart/form-data; boundary=\(form.boundary)", forHTTPHeaderField: "Content-Type")
        req.timeoutInterval = 600
        let data: Data, resp: URLResponse
        do {
            (data, resp) = try await session.upload(for: req, fromFile: form.url, delegate: UploadProgress(progress))
        } catch { throw APIError.offline }
        try check(resp)
        return try decode(data)
    }
    func editBlock(_ id: String, block: String, text: String) async throws -> CodeView {
        try decode(try await send("/api/codes/\(esc(id))/blocks/\(esc(block))", method: "PATCH", json: ["text": text]))
    }
    func removeBlock(_ id: String, block: String) async throws -> CodeView {
        try decode(try await send("/api/codes/\(esc(id))/blocks/\(esc(block))", method: "DELETE", json: nil))
    }
    /// Space under the code: a plan ("s10", "s100", "s1000") for a month, or "free" — back to 1 MB. Owner only (demo).
    func buyStorage(_ id: String, plan: String) async throws -> CodeView {
        try decode(try await send("/api/codes/\(esc(id))/storage", method: "POST", json: ["plan": plan]))
    }
    /// Permission to upload one video of exactly `size` bytes (413 — doesn't fit into the free space under the code;
    /// 400 — not a video). `direct: false` (no Blob storage, e.g. the local server) — send it in the form instead.
    func uploadURL(_ id: String, size: Int, type: String) async throws -> UploadTicket {
        try decode(try await send("/api/codes/\(esc(id))/upload-url", method: "POST", json: ["size": size, "type": type]))
    }
    /// The raw file to the storage URL from `uploadURL`, with exactly its headers.
    func put(_ ticket: UploadTicket, file: UploadFile, progress: (@Sendable (Double) -> Void)? = nil) async throws {
        guard let s = ticket.url, let url = URL(string: s) else { throw APIError.bad }
        var req = URLRequest(url: url)
        req.httpMethod = ticket.method ?? "PUT"
        for (k, v) in ticket.headers ?? [:] { req.setValue(v, forHTTPHeaderField: k) }
        req.timeoutInterval = 600
        let resp: URLResponse
        do {
            (_, resp) = try await session.upload(for: req, fromFile: file.url, delegate: UploadProgress(progress))
        } catch { throw APIError.offline }
        try check(resp)
    }

    // MARK: money (demo)

    func quote(key: String, tier: Tier) async throws -> Quote {
        try await get("/api/purchases?\(query(["key": key, "tier": tier.rawValue]))")
    }
    func pay(key: String, tier: Tier) async throws {
        _ = try await send("/api/purchases", method: "POST", json: ["key": key, "tier": tier.rawValue])
    }
    func packs() async throws -> PacksState { try await get("/api/packs") }

    // MARK: drawings

    enum Drawing { case fresh(Data, etag: String?), notModified }
    /// The exact drawing of a saved code (same as the site; images embedded; texture → background color).
    /// `etag` — the version we have: 304 → `.notModified`.
    func codeImage(_ id: String, size: Int, etag: String?) async throws -> Drawing {
        var req = request("/api/codes/\(esc(id))/image?format=png&size=\(size)", method: "GET")
        req.cachePolicy = .reloadIgnoringLocalCacheData // our own cache + ETag decide
        if let etag { req.setValue(etag, forHTTPHeaderField: "If-None-Match") }
        let data: Data, resp: URLResponse
        do { (data, resp) = try await session.data(for: req) } catch { throw APIError.offline }
        let http = resp as? HTTPURLResponse
        if http?.statusCode == 304 { return .notModified }
        try check(resp)
        guard http?.value(forHTTPHeaderField: "Content-Type")?.hasPrefix("image/png") == true else { throw APIError.bad }
        return .fresh(data, etag: http?.value(forHTTPHeaderField: "ETag"))
    }
    /// A style before the code exists (a sample short link of the real length).
    func preview(_ style: QRStyle, size: Int) async throws -> Data {
        var req = request("/api/preview", method: "POST")
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.httpBody = Data("{\"style\":\(style.json),\"format\":\"png\",\"size\":\(size)}".utf8)
        return try await png(req)
    }

    // MARK: links

    /// Is this URL one of our codes? `{result: "ours", id}` — replaces reading the /K/ redirect.
    func verify(_ url: String) async throws -> VerifyResult {
        try await get("/api/verify?\(query(["u": url]))")
    }

    /// Fallback for servers without /api/verify: /K/{short} answers with a redirect to /c/{id}; read its Location.
    func resolveShortByRedirect(_ short: String) async throws -> String {
        var req = URLRequest(url: API.base.appendingPathComponent("K/\(short)"))
        req.httpMethod = "GET"
        let resp: URLResponse
        do { (_, resp) = try await noRedirect.data(for: req) } catch { throw APIError.offline }
        guard let http = resp as? HTTPURLResponse else { throw APIError.offline }
        if (300..<400).contains(http.statusCode), let loc = http.value(forHTTPHeaderField: "Location"),
           let url = URL(string: loc, relativeTo: API.base), let id = OurLink.codeId(fromPath: url.path) {
            return id
        }
        if http.statusCode == 404 { throw APIError.notFound }
        throw APIError.http(http.statusCode)
    }

    // MARK: push

    func registerDevice(token: String) async throws {
        _ = try await send("/api/devices", method: "POST", json: ["token": token, "platform": "ios"])
    }
    func unregisterDevice(token: String) async throws {
        _ = try await send("/api/devices", method: "DELETE", json: ["token": token])
    }

    // MARK: media

    func mediaURL(_ name: String) -> URL { API.base.appendingPathComponent("api/media/\(name)") }

    /// Cookies for AVPlayer (it doesn't read HTTPCookieStorage by itself).
    var cookies: [HTTPCookie] { HTTPCookieStorage.shared.cookies(for: API.base) ?? [] }

    func data(_ url: URL) async throws -> Data {
        let data: Data, resp: URLResponse
        do { (data, resp) = try await session.data(from: url) } catch { throw APIError.offline }
        try check(resp)
        return data
    }

    // MARK: plumbing

    private func esc(_ s: String) -> String {
        s.addingPercentEncoding(withAllowedCharacters: CharacterSet.urlPathAllowed.subtracting(CharacterSet(charactersIn: "/"))) ?? s
    }

    private func query(_ items: [String: String]) -> String {
        var c = URLComponents()
        c.queryItems = items.sorted { $0.key < $1.key }.map { URLQueryItem(name: $0.key, value: $0.value) }
        // URLComponents leaves "+" as is, which a server reads as a space.
        return (c.percentEncodedQuery ?? "").replacingOccurrences(of: "+", with: "%2B")
    }

    private func request(_ path: String, method: String) -> URLRequest {
        var req = URLRequest(url: URL(string: path, relativeTo: API.base)!)
        req.httpMethod = method
        req.setValue("application/json", forHTTPHeaderField: "Accept")
        return req
    }

    private func get<T: Decodable>(_ path: String) async throws -> T {
        try decode(try await send(path, method: "GET", json: nil))
    }

    private func decode<T: Decodable>(_ data: Data) throws -> T {
        do { return try decoder.decode(T.self, from: data) } catch { throw APIError.bad }
    }

    @discardableResult
    private func send(_ path: String, method: String, json: [String: Any]?, using: URLSession? = nil) async throws -> Data {
        var req = request(path, method: method)
        if let json {
            req.setValue("application/json", forHTTPHeaderField: "Content-Type")
            req.httpBody = try JSONSerialization.data(withJSONObject: json)
        }
        let data: Data, resp: URLResponse
        do { (data, resp) = try await (using ?? session).data(for: req) } catch { throw APIError.offline }
        try check(resp)
        return data
    }

    private func png(_ req: URLRequest) async throws -> Data {
        let data: Data, resp: URLResponse
        do { (data, resp) = try await session.data(for: req) } catch { throw APIError.offline }
        try check(resp)
        // Without `sharp` the server answers SVG — the app then draws the code itself.
        guard (resp as? HTTPURLResponse)?.value(forHTTPHeaderField: "Content-Type")?.hasPrefix("image/png") == true else {
            throw APIError.bad
        }
        return data
    }

    private func check(_ resp: URLResponse) throws {
        guard let http = resp as? HTTPURLResponse else { throw APIError.offline }
        switch http.statusCode {
        case 200..<300: return
        case 400: throw APIError.bad
        case 402: throw APIError.payment
        case 401: throw APIError.login
        case 403: throw APIError.forbidden
        case 404: throw APIError.notFound
        case 409: throw APIError.conflict
        case 413: throw APIError.tooLarge
        case 429: throw APIError.limit
        default: throw APIError.http(http.statusCode)
        }
    }
}

private final class NoRedirect: NSObject, URLSessionTaskDelegate {
    func urlSession(_ session: URLSession, task: URLSessionTask, willPerformHTTPRedirection response: HTTPURLResponse,
                    newRequest request: URLRequest) async -> URLRequest? { nil }
}

/// Upload progress (0…1) for the multipart form.
private final class UploadProgress: NSObject, URLSessionTaskDelegate {
    let onProgress: (@Sendable (Double) -> Void)?
    init(_ p: (@Sendable (Double) -> Void)?) { onProgress = p }
    func urlSession(_ session: URLSession, task: URLSessionTask, didSendBodyData bytesSent: Int64, totalBytesSent: Int64,
                    totalBytesExpectedToSend: Int64) {
        guard totalBytesExpectedToSend > 0 else { return }
        onProgress?(Double(totalBytesSent) / Double(totalBytesExpectedToSend))
    }
}

/// A file for the memory form: a photo (already shrunk to JPEG) or a video file.
struct UploadFile: Equatable {
    let url: URL
    let mime: String
    let filename: String
    let size: Int
    var isVideo: Bool { mime.hasPrefix("video/") }
}

/// multipart/form-data written to a temporary file (fields first, then the file, streamed in 1 MB chunks).
enum Multipart {
    struct Form { let url: URL; let boundary: String }

    static func write(fields: [String: String], file: UploadFile?, boundary: String = "QRSpace-\(UUID().uuidString)") throws -> Form {
        let url = FileManager.default.temporaryDirectory.appendingPathComponent("form-\(UUID().uuidString)")
        FileManager.default.createFile(atPath: url.path, contents: nil)
        let out = try FileHandle(forWritingTo: url)
        defer { try? out.close() }
        func put(_ s: String) throws { try out.write(contentsOf: Data(s.utf8)) }
        for (k, v) in fields.sorted(by: { $0.key < $1.key }) {
            try put("--\(boundary)\r\nContent-Disposition: form-data; name=\"\(k)\"\r\n\r\n\(v)\r\n")
        }
        if let file {
            let name = file.filename.replacingOccurrences(of: "\"", with: "")
            try put("--\(boundary)\r\nContent-Disposition: form-data; name=\"file\"; filename=\"\(name)\"\r\nContent-Type: \(file.mime)\r\n\r\n")
            let input = try FileHandle(forReadingFrom: file.url)
            defer { try? input.close() }
            while let chunk = try input.read(upToCount: 1 << 20), !chunk.isEmpty { try out.write(contentsOf: chunk) }
            try put("\r\n")
        }
        try put("--\(boundary)--\r\n")
        return Form(url: url, boundary: boundary)
    }
}

/// Our links inside QR codes: https://qrspace.co/K/{short} or /c/{id}.
enum OurLink: Hashable {
    case short(String)
    case code(String)

    init?(_ url: URL) {
        if url.scheme == "qrspace" {
            // qrspace://c/{id} or qrspace://K/{short}
            let parts = [url.host ?? ""] + url.pathComponents.filter { $0 != "/" }
            self.init(parts: parts)
            return
        }
        guard let scheme = url.scheme?.lowercased(), scheme == "https" || scheme == "http", API.isOurHost(url.host) else { return nil }
        self.init(parts: url.pathComponents.filter { $0 != "/" })
    }

    private init?(parts: [String]) {
        guard parts.count == 2, !parts[1].isEmpty else { return nil }
        switch parts[0] {
        case "K", "k": self = .short(parts[1])
        case "c": self = .code(parts[1])
        default: return nil
        }
    }

    static func codeId(fromPath path: String) -> String? {
        let p = path.split(separator: "/").map(String.init)
        return p.count == 2 && p[0] == "c" ? p[1] : nil
    }

    /// The code id. Short links go through /api/verify; reading the /K/ redirect is only a fallback for a server
    /// without that endpoint.
    func codeId() async throws -> String {
        switch self {
        case .code(let id): return id
        case .short(let s):
            let r: VerifyResult
            do {
                r = try await API.shared.verify("\(API.base.absoluteString)/K/\(s)")
            } catch APIError.offline {
                throw APIError.offline
            } catch {
                return try await API.shared.resolveShortByRedirect(s)
            }
            if r.result == "ours", let id = r.id { return id }
            throw APIError.notFound
        }
    }
}
