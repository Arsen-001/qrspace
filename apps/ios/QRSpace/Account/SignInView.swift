import SwiftUI

/// Sign in. Google/Apple are web OAuth on the server (/api/auth/google?next=…); until the keys exist,
/// the server's demo sign-in (POST /api/me {personId}) is the way in.
struct SignInView: View {
    @Environment(Session.self) private var session
    @State private var busy: String?
    @State private var failed = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                hero
                // TODO(oauth): open /api/auth/google?next=… and /api/auth/apple in ASWebAuthenticationSession
                // (callback scheme `qrspace`), then copy the session cookie into HTTPCookieStorage.
                // Needs the server to support an app callback — see README "Server changes".
                VStack(spacing: 10) {
                    providerButton(tr("withApple"), icon: "apple.logo")
                    providerButton(tr("withGoogle"), icon: "g.circle.fill")
                    Text(tr("providersPending")).font(.system(size: 13)).foregroundStyle(Theme.muted)
                }
                if session.demoAvailable || !session.people.isEmpty {
                    Kicker(text: tr("demoLoginTitle")).padding(.top, 8)
                    Text(tr("account.demoPick")).font(.system(size: 15)).foregroundStyle(Theme.muted)
                    ForEach(session.people.filter { $0.demo != nil }) { p in demoRow(p) }
                }
                if session.offline {
                    CardBox {
                        Text(tr("common.offline")).foregroundStyle(Theme.ink)
                        Button(tr("common.retry")) { Task { await session.refresh() } }.buttonStyle(.lime)
                    }
                }
            }
            .padding(16)
        }
        .background(ScreenBackground())
        .alert(tr("code.error"), isPresented: $failed) { Button("OK", role: .cancel) {} }
    }

    private var hero: some View {
        VStack(alignment: .leading, spacing: 12) {
            Kicker(text: tr("accountTitle"), color: Theme.accent)
            Text(tr("login")).font(Theme.heading(34)).foregroundStyle(Theme.onStage).accessibilityAddTraits(.isHeader)
            Text(tr("accLoginText")).font(.system(size: 16)).foregroundStyle(Theme.onStage.opacity(0.75))
        }
        .padding(18)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.stage, in: RoundedRectangle(cornerRadius: 14))
        .overlay(alignment: .topTrailing) {
            Image(systemName: "qrcode").font(.system(size: 54, weight: .black)).foregroundStyle(Theme.accent).padding(16)
                .accessibilityHidden(true)
        }
    }

    private func providerButton(_ title: String, icon: String) -> some View {
        Button {} label: { Label(title, systemImage: icon) }
            .buttonStyle(.plainField)
            .disabled(true)
            .opacity(0.55)
    }

    private func demoRow(_ p: Person) -> some View {
        Button {
            busy = p.id
            Task {
                do { try await session.signIn(p.id) } catch { failed = true }
                busy = nil
            }
        } label: {
            HStack(spacing: 12) {
                Text(String(p.name.text.prefix(1)))
                    .font(.system(size: 18, weight: .black)).foregroundStyle(.white)
                    .frame(width: 42, height: 42)
                    .background(Color(UIColor(css: p.color) ?? .gray), in: RoundedRectangle(cornerRadius: 8))
                VStack(alignment: .leading, spacing: 2) {
                    Text(p.name.text).font(.system(size: 16, weight: .bold)).foregroundStyle(Theme.ink)
                    if let d = p.demo { Text(d.text).font(.system(size: 13)).foregroundStyle(Theme.muted).multilineTextAlignment(.leading) }
                }
                Spacer()
                if busy == p.id { ProgressView() } else { Image(systemName: "arrow.right").foregroundStyle(Theme.accentInk) }
            }
            .padding(12)
            .background(Theme.card, in: RoundedRectangle(cornerRadius: 10))
            .overlay(RoundedRectangle(cornerRadius: 10).stroke(Theme.line))
        }
        .buttonStyle(.plain)
        .disabled(busy != nil)
        .accessibilityElement(children: .combine)
    }
}
