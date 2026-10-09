import Foundation

/// Which server the app talks to. Release builds always use production; Debug builds can point at a local dev
/// server with the launch argument `-QRAPIBase http://localhost:3720` (or `defaults write co.qrspace.app QRAPIBase …`
/// in the Simulator). Test writes go to localhost only — never to production.
enum AppConfig {
    static let production = URL(string: "https://qrspace.co")!

    static let base: URL = {
        #if DEBUG
        if let s = UserDefaults.standard.string(forKey: "QRAPIBase")?.trimmingCharacters(in: .whitespaces),
           let u = URL(string: s.hasSuffix("/") ? String(s.dropLast()) : s), u.scheme?.hasPrefix("http") == true, u.host != nil {
            return u
        }
        #endif
        return production
    }()

    static var isProduction: Bool { base == production }

    /// "localhost:3720" / "qrspace.co" — shown in Debug builds so screenshots say which server they used.
    static var label: String {
        guard let h = base.host else { return base.absoluteString }
        return base.port.map { "\(h):\($0)" } ?? h
    }
}
