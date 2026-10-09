import SwiftData
import SwiftUI

@main
struct QRSpaceApp: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate
    @State private var session = Session()
    @State private var router = Router()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(session)
                .environment(router)
                .tint(Theme.accentInk)
                .task { Store.shared.start(); await session.refresh(); await debugLaunch() }
                // Universal Links (https://qrspace.co/K/…, /c/…), qrspace://… and the sign-in callback qrspace://auth?token=…
                .onOpenURL { url in
                    if let token = WebAuth.token(from: url) {
                        Task { try? await session.finishWebSignIn(token: token) }
                    } else {
                        router.open(url)
                    }
                }
                .onContinueUserActivity(NSUserActivityTypeBrowsingWeb) { a in if let u = a.webpageURL { router.open(u) } }
        }
        .modelContainer(for: ScanRecord.self)
    }

    /// Debug/QA launch arguments (Simulator screenshots, UI tests) — see README.
    @MainActor private func debugLaunch() async {
        #if DEBUG
        let d = UserDefaults.standard
        if d.bool(forKey: "QRSignOut"), session.personId != nil { await session.signOut() }
        if let p = d.string(forKey: "QRDemoPerson"), session.personId != p { try? await session.signIn(p) }
        if let t = d.string(forKey: "QRTab"), let tab = Router.Tab(arg: t) { router.tab = tab }
        if let id = d.string(forKey: "QROpenCode") {
            router.tab = .home
            try? await Task.sleep(for: .milliseconds(600))
            router.openCode = id
        }
        if d.bool(forKey: "QRCreate") {
            router.tab = .home
            try? await Task.sleep(for: .milliseconds(400))
            router.createNew = true
        }
        #endif
    }
}

/// Which tab is open and which code to show (deep links, "Sign in" buttons).
@MainActor @Observable
final class Router {
    enum Tab: String {
        case scan, home, account
        /// `-QRTab codes` from v1 still works.
        init?(arg: String) { self.init(rawValue: arg == "codes" ? "home" : arg) }
    }
    var tab: Tab = .scan
    var openCode: String?
    var createNew = false
    var linkSheet: LinkSheet?

    struct LinkSheet: Identifiable { let id = UUID(); let link: OurLink }

    func open(_ url: URL) {
        guard let link = OurLink(url) else { return }
        linkSheet = LinkSheet(link: link)
    }
}

struct RootView: View {
    @Environment(Router.self) private var router
    @Environment(Session.self) private var session

    var body: some View {
        @Bindable var router = router
        TabView(selection: $router.tab) {
            ScannerView(tabActive: router.tab == .scan)
                .tabItem { Label(tr("tab.scan"), systemImage: "qrcode.viewfinder") }
                .tag(Router.Tab.scan)
            HomeView()
                .tabItem { Label(tr("navCodes"), systemImage: "square.grid.2x2.fill") }
                .tag(Router.Tab.home)
            AccountView()
                .tabItem { Label(tr("accountTitle"), systemImage: "person.crop.circle.fill") }
                .tag(Router.Tab.account)
        }
        // Just signed in (not a cold launch with a saved session) → "My QR codes".
        .onChange(of: session.state) { old, new in
            if old == .signedOut, case .signedIn = new { router.tab = .home }
        }
        .sheet(item: $router.linkSheet) { s in
            NavigationStack {
                CodeDetailView(source: .link(s.link), fromScan: true)
                    .toolbar {
                        ToolbarItem(placement: .cancellationAction) {
                            Button { router.linkSheet = nil } label: { Image(systemName: "xmark") }
                                .accessibilityLabel(tr("common.close"))
                        }
                    }
            }
        }
    }
}
