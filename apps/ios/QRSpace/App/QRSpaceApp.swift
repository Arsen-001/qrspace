import SwiftData
import SwiftUI

@main
struct QRSpaceApp: App {
    @State private var session = Session()
    @State private var router = Router()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(session)
                .environment(router)
                .tint(Theme.accentInk)
                .task { await session.refresh(); await debugLaunch() }
                // Universal Links (https://qrspace.co/K/…, /c/…) and qrspace://… open the code here.
                .onOpenURL { router.open($0) }
                .onContinueUserActivity(NSUserActivityTypeBrowsingWeb) { a in if let u = a.webpageURL { router.open(u) } }
        }
        .modelContainer(for: ScanRecord.self)
    }

    /// Debug/QA launch arguments (simulator screenshots): `-QRDemoPerson arman`, `-QRTab codes|account|scan`,
    /// `-QROpenCode <id>`, `-QRSignOut YES`.
    @MainActor private func debugLaunch() async {
        #if DEBUG
        let d = UserDefaults.standard
        if d.bool(forKey: "QRSignOut"), session.personId != nil { await session.signOut() }
        if let p = d.string(forKey: "QRDemoPerson"), session.personId != p { try? await session.signIn(p) }
        if let t = d.string(forKey: "QRTab"), let tab = Router.Tab(rawValue: t) { router.tab = tab }
        if let id = d.string(forKey: "QROpenCode") { router.tab = .codes; try? await Task.sleep(for: .milliseconds(300)); router.openCode = id }
        #endif
    }
}

/// Which tab is open and which code to show (deep links, "Sign in" buttons).
@MainActor @Observable
final class Router {
    enum Tab: String { case scan, codes, account }
    var tab: Tab = .scan
    var openCode: String?
    var linkSheet: LinkSheet?

    struct LinkSheet: Identifiable { let id = UUID(); let link: OurLink }

    func open(_ url: URL) {
        guard let link = OurLink(url) else { return }
        linkSheet = LinkSheet(link: link)
    }
}

struct RootView: View {
    @Environment(Router.self) private var router

    var body: some View {
        @Bindable var router = router
        TabView(selection: $router.tab) {
            ScannerView(tabActive: router.tab == .scan)
                .tabItem { Label(tr("tab.scan"), systemImage: "qrcode.viewfinder") }
                .tag(Router.Tab.scan)
            CodesView()
                .tabItem { Label(tr("navCodes"), systemImage: "square.grid.2x2.fill") }
                .tag(Router.Tab.codes)
            AccountView()
                .tabItem { Label(tr("accountTitle"), systemImage: "person.crop.circle.fill") }
                .tag(Router.Tab.account)
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
