import Foundation
import Observation

/// Who is signed in, plus the names of people the server lets me see (for "owner" captions).
@MainActor @Observable
final class Session {
    enum State: Equatable { case unknown, signedOut, signedIn(String) }

    var state: State = .unknown
    var people: [Person] = []
    var demoAvailable = false
    var offline = false
    /// Bumped on sign-in/out so screens reload their data.
    var generation = 0

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
    }

    func signOut() async {
        try? await API.shared.signIn(personId: nil)
        // Drop the cookie locally too, even if the server didn't answer.
        for c in API.shared.cookies { HTTPCookieStorage.shared.deleteCookie(c) }
        await refresh()
        if state != .signedOut { state = .signedOut; generation += 1 }
    }
}
