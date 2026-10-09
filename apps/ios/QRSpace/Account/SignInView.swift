import SwiftUI

/// Sign in. Google / Apple and "Sign in on qrspace.co" open the website in the in-app browser
/// (ASWebAuthenticationSession); it comes back with a one-time token that becomes the app's own session.
/// Google / Apple buttons appear only when the server has their keys (`providers` in /api/me). The demo person
/// picker (POST /api/me) stays while the server allows demo sign-in.
struct SignInView: View {
    /// Why we ask (e.g. "Sign in to create the code").
    var note: String? = nil

    @Environment(Session.self) private var session
    @State private var busy: String?
    @State private var failed = false
    @State private var auth = WebAuth()

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                hero
                VStack(spacing: 10) {
                    if session.providers.apple {
                        webButton(.apple, title: tr("withApple"), icon: "apple.logo", fill: .black, ink: .white)
                    }
                    if session.providers.google {
                        webButton(.google, title: tr("withGoogle"), icon: "g.circle.fill", fill: .white, ink: Color(hex: 0x1F1F1F))
                    }
                    webButton(.site, title: tr("signInOnSite", ["host": AppConfig.label]), icon: "safari", fill: Theme.accent, ink: Theme.onAccent)
                        .accessibilityIdentifier("signin-site")
                    Text(tr("signInOnSiteHint")).font(.system(size: 13)).foregroundStyle(Theme.muted)
                        .frame(maxWidth: .infinity, alignment: .leading)
                    if !session.providers.google || !session.providers.apple {
                        Text(tr("providersPending")).font(.system(size: 12)).foregroundStyle(Theme.muted)
                            .frame(maxWidth: .infinity, alignment: .leading)
                    }
                }
                if session.demoAvailable {
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
                LegalLinks()
            }
            .padding(16)
            .frame(maxWidth: 640)
            .frame(maxWidth: .infinity)
        }
        .tabBarClearance()
        .background(ScreenBackground())
        .alert(tr("loginFailed"), isPresented: $failed) { Button("OK", role: .cancel) {} }
    }

    private var hero: some View {
        VStack(alignment: .leading, spacing: 12) {
            Kicker(text: tr("accountTitle"), color: Theme.accent)
            Text(tr("login")).font(Theme.heading(34)).foregroundStyle(Theme.onStage).accessibilityAddTraits(.isHeader)
            Text(note ?? tr("accLoginText")).font(.system(size: 16)).foregroundStyle(Theme.onStage.opacity(0.75))
        }
        .padding(18)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.stage, in: RoundedRectangle(cornerRadius: 14))
        .overlay(alignment: .topTrailing) {
            Image(systemName: "qrcode").font(.system(size: 54, weight: .black)).foregroundStyle(Theme.accent).padding(16)
                .accessibilityHidden(true)
        }
    }

    private func webButton(_ way: WebAuth.Way, title: String, icon: String, fill: Color, ink: Color) -> some View {
        let id = "\(way)"
        return Button {
            busy = id
            Task {
                do {
                    let token = try await auth.run(way)
                    try await session.finishWebSignIn(token: token)
                } catch WebAuth.Failure.cancelled {
                } catch {
                    failed = true
                }
                busy = nil
            }
        } label: {
            HStack(spacing: 10) {
                if busy == id { ProgressView().tint(ink) } else { Image(systemName: icon) }
                Text(title).lineLimit(1).minimumScaleFactor(0.8)
            }
            .font(.system(size: 16, weight: .bold))
            .frame(maxWidth: .infinity, minHeight: 52)
            .foregroundStyle(ink)
            .background(fill, in: RoundedRectangle(cornerRadius: 10))
            .overlay(RoundedRectangle(cornerRadius: 10).stroke(Theme.line, lineWidth: way == .google ? 1 : 0))
        }
        .buttonStyle(.plain)
        .disabled(busy != nil)
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
        .accessibilityIdentifier("demo-\(p.id)")
    }
}
