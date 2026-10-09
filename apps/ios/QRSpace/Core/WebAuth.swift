import AuthenticationServices
import UIKit
import UserNotifications

/// Sign-in through the website in the in-app browser (ASWebAuthenticationSession):
/// open `/api/auth/google?next=/app/callback` (Apple — `/api/auth/apple…`, any way — `/login?next=/app/callback`);
/// after sign-in the server redirects to `qrspace://auth?token=…` (one-time, 5 minutes); the app exchanges the token
/// for its own session cookie (POST /api/auth/token). Browser cookies never reach the app, hence the token.
@MainActor
final class WebAuth: NSObject, ASWebAuthenticationPresentationContextProviding {
    enum Way { case google, apple, site }
    enum Failure: Error { case cancelled, noToken, failed }

    static let callbackScheme = "qrspace"
    private var current: ASWebAuthenticationSession?

    static func startURL(_ way: Way, base: URL = API.base) -> URL {
        let next = "next=%2Fapp%2Fcallback"
        switch way {
        case .google: return URL(string: "\(base.absoluteString)/api/auth/google?\(next)")!
        case .apple: return URL(string: "\(base.absoluteString)/api/auth/apple?\(next)")!
        case .site: return URL(string: "\(base.absoluteString)/login?\(next)")!
        }
    }

    /// `qrspace://auth?token=…` → the token.
    nonisolated static func token(from url: URL) -> String? {
        guard url.scheme == callbackScheme, url.host == "auth" else { return nil }
        let t = URLComponents(url: url, resolvingAgainstBaseURL: false)?.queryItems?.first { $0.name == "token" }?.value
        return t.flatMap { $0.count >= 20 ? $0 : nil }
    }

    /// Runs the browser and returns the one-time token.
    func run(_ way: Way) async throws -> String {
        let url = Self.startURL(way)
        let callback: URL = try await withCheckedThrowingContinuation { cont in
            let s = ASWebAuthenticationSession(url: url, callbackURLScheme: Self.callbackScheme) { url, error in
                if let url { cont.resume(returning: url) }
                else if let e = error as? ASWebAuthenticationSessionError, e.code == .canceledLogin { cont.resume(throwing: Failure.cancelled) }
                else { cont.resume(throwing: Failure.failed) }
            }
            s.presentationContextProvider = self
            // Its own cookie jar: no "wants to use … to sign in" prompt, and every sign-in can pick another account.
            s.prefersEphemeralWebBrowserSession = true
            current = s
            if !s.start() { cont.resume(throwing: Failure.failed) }
        }
        current = nil
        guard let token = Self.token(from: callback) else { throw Failure.noToken }
        return token
    }

    nonisolated func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        MainActor.assumeIsolated {
            UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }
                .flatMap(\.windows).first { $0.isKeyWindow } ?? ASPresentationAnchor()
        }
    }
}

/// Push notifications. Registration needs APNs — the paid Apple Developer account and the `aps-environment`
/// entitlement — so it is off (`enabled = false`). The server side is wired: the token goes to POST /api/devices
/// after sign-in and is removed (DELETE) on sign-out.
/// TODO(owner): after the Apple Developer account exists — add `aps-environment` to project.yml entitlements,
/// set `enabled = true`, and the server sends APNs for the notices the site shows.
enum Push {
    static let enabled = false
    private static let key = "QRPushToken"

    /// The token this phone registered with the server (to remove it on sign-out).
    static var token: String? {
        get { UserDefaults.standard.string(forKey: key) }
        set { UserDefaults.standard.set(newValue, forKey: key) }
    }

    @MainActor static func requestRegistration() {
        guard enabled else { return }
        UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .badge, .sound]) { ok, _ in
            guard ok else { return }
            Task { @MainActor in UIApplication.shared.registerForRemoteNotifications() }
        }
    }

    /// APNs token (from the app delegate) → the server, for the person signed in now.
    static func didRegister(deviceToken: Data) async {
        await send(deviceToken.map { String(format: "%02x", $0) }.joined())
    }

    static func send(_ hex: String) async {
        do {
            try await API.shared.registerDevice(token: hex)
            token = hex
        } catch {}
    }

    /// Before sign-out (needs the session): this phone no longer gets that person's notices.
    static func unregister() async {
        guard let t = token else { return }
        try? await API.shared.unregisterDevice(token: t)
        token = nil
    }
}

final class AppDelegate: NSObject, UIApplicationDelegate {
    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        Task { await Push.didRegister(deviceToken: deviceToken) }
    }
}
