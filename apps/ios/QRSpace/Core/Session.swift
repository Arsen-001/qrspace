import Foundation
import Observation

/// Who is signed in, plus the names of people the server lets me see (for "owner" captions).
@MainActor @Observable
final class Session {
    enum State: Equatable { case unknown, signedOut, signedIn(String) }

    var state: State = .unknown
    var people: [Person] = []
    var demoAvailable = false
    var providers = Providers(google: false, apple: false)
    var offline = false
    /// The address printed in codes (`base` from the server; on a dev server — the Mac's LAN address).
    var linkBase: String = API.base.absoluteString
    /// Bumped on sign-in/out so screens reload their data.
    var generation = 0
    /// Bumped when codes change (created, edited) so the home list reloads.
    var codesVersion = 0

    var personId: String? { if case .signedIn(let id) = state { return id } else { return nil } }

    func name(of id: String?) -> String? {
        guard let id else { return nil }
        return people.first { $0.id == id }?.name.text
    }

    func refresh() async {
        do {
            let r = try await API.shared.me()
            offline = false
            people = r.people ?? []
            demoAvailable = r.demo ?? false
            providers = r.providers ?? Providers(google: false, apple: false)
            if let b = r.base, !b.isEmpty { linkBase = b }
            let next: State = r.me.map { .signedIn($0) } ?? .signedOut
            if next != state { state = next; generation += 1 }
        } catch {
            offline = true
            if state == .unknown { state = .signedOut }
        }
    }

    func signIn(_ personId: String) async throws {
        try await API.shared.signIn(personId: personId)
        await refresh()
        afterSignIn()
    }

    /// The one-time token from the website sign-in (qrspace://auth?token=…).
    func finishWebSignIn(token: String) async throws {
        try await API.shared.exchange(token: token)
        await refresh()
        guard personId != nil else { throw APIError.login }
        afterSignIn()
    }

    private func afterSignIn() {
        Push.requestRegistration()
        #if DEBUG
        // QA: check the device endpoint without APNs (`-QRFakePushToken <hex>`).
        if let fake = UserDefaults.standard.string(forKey: "QRFakePushToken") { Task { await Push.send(fake) } }
        #endif
    }

    /// Account deletion (App Store 5.1.1(v)): the server removes the person with their codes, files and phones;
    /// here we forget the session, the push token and every cached drawing and photo.
    func deleteAccount() async throws {
        try await API.shared.deleteAccount()
        Push.token = nil // the server dropped this phone together with the account
        for c in API.shared.cookies { HTTPCookieStorage.shared.deleteCookie(c) }
        await DrawingStore.shared.clear()
        MediaCache.images.removeAllObjects()
        URLCache.shared.removeAllCachedResponses()
        await refresh()
        if state != .signedOut { state = .signedOut; generation += 1 }
    }

    func signOut() async {
        await Push.unregister()
        try? await API.shared.signIn(personId: nil)
        // Drop the cookie locally too, even if the server didn't answer.
        for c in API.shared.cookies { HTTPCookieStorage.shared.deleteCookie(c) }
        await refresh()
        if state != .signedOut { state = .signedOut; generation += 1 }
    }
}
