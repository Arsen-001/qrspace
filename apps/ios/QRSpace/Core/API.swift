import Foundation

/// qrspace.co API. The session is the server's `qr-session` cookie: URLSession keeps it in
/// HTTPCookieStorage.shared (persisted across launches), exactly like the browser does.
enum APIError: Error, Equatable {
    case login        // 401 — not signed in
    case notFound     // 404
    case http(Int)
    case offline
}

final class API {
    static let shared = API()
    static let base = URL(string: "https://qrspace.co")!
    /// Hosts whose /K/ and /c/ links are ours.
    static let hosts: Set<String> = ["qrspace.co", "www.qrspace.co", "qrspace-one.vercel.app"]

    private let session: URLSession
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
    }

    // MARK: endpoints

    func me() async throws -> MeResponse { try await get("/api/me") }
    /// Demo sign-in (only while the server has DEMO_LOGIN on). nil — sign out.
    func signIn(personId: String?) async throws {
        let body: [String: Any] = ["personId": personId.map { $0 as Any } ?? NSNull()]
        _ = try await send("/api/me", method: "POST", json: body)
    }
    func codes() async throws -> CodeList { try await get("/api/codes") }
    /// `visit: true` — this is a scan: the server writes it into the code's history (not for the owner).
    func code(_ id: String, visit: Bool) async throws -> CodeView {
        try await get("/api/codes/\(id.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? id)" + (visit ? "?visit=1" : ""))
    }
    func profile() async throws -> Profile { try await get("/api/profile") }
    func notices() async throws -> Notices { try await get("/api/notifications") }

    func mediaURL(_ name: String) -> URL { API.base.appendingPathComponent("api/media/\(name)") }

    /// Cookies for AVPlayer (it doesn't read HTTPCookieStorage by itself).
    var cookies: [HTTPCookie] { HTTPCookieStorage.shared.cookies(for: API.base) ?? [] }

    func data(_ url: URL) async throws -> Data {
        let (data, resp) = try await session.data(from: url)
        try check(resp)
        return data
    }

    /// /K/{short} → code id. The server answers with a redirect to /c/{id} (src/app/K/[s]/page.tsx);
    /// we read its Location instead of following it.
    func resolveShort(_ short: String) async throws -> String {
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

    // MARK: plumbing

    private func get<T: Decodable>(_ path: String) async throws -> T {
        let data = try await send(path, method: "GET", json: nil)
        return try decoder.decode(T.self, from: data)
    }

    @discardableResult
    private func send(_ path: String, method: String, json: [String: Any]?) async throws -> Data {
        var req = URLRequest(url: URL(string: path, relativeTo: API.base)!)
        req.httpMethod = method
        req.setValue("application/json", forHTTPHeaderField: "Accept")
        if let json {
            req.setValue("application/json", forHTTPHeaderField: "Content-Type")
            req.httpBody = try JSONSerialization.data(withJSONObject: json)
        }
        let data: Data, resp: URLResponse
        do { (data, resp) = try await session.data(for: req) } catch { throw APIError.offline }
        try check(resp)
        return data
    }

    private func check(_ resp: URLResponse) throws {
        guard let http = resp as? HTTPURLResponse else { throw APIError.offline }
        switch http.statusCode {
        case 200..<300: return
        case 401: throw APIError.login
        case 404: throw APIError.notFound
        default: throw APIError.http(http.statusCode)
        }
    }
}

private final class NoRedirect: NSObject, URLSessionTaskDelegate {
    func urlSession(_ session: URLSession, task: URLSessionTask, willPerformHTTPRedirection response: HTTPURLResponse,
                    newRequest request: URLRequest) async -> URLRequest? { nil }
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
        guard let scheme = url.scheme?.lowercased(), scheme == "https" || scheme == "http",
              let host = url.host?.lowercased(), API.hosts.contains(host) else { return nil }
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

    /// The code id, asking the server for short links.
    func codeId() async throws -> String {
        switch self {
        case .code(let id): return id
        case .short(let s): return try await API.shared.resolveShort(s)
        }
    }
}
