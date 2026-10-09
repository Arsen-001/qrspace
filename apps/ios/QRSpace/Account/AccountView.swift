import SwiftUI

/// Account (site /account): who I am, numbers, purchases, sign out. Signed out — sign-in screen.
struct AccountView: View {
    @Environment(Session.self) private var session

    var body: some View {
        NavigationStack {
            Group {
                if session.personId == nil { SignInView() } else { SignedInAccount() }
            }
            .toolbar(.hidden, for: .navigationBar)
        }
    }
}

private struct SignedInAccount: View {
    @Environment(Session.self) private var session
    @State private var profile: Profile?
    @State private var notices: Notices?
    @State private var error: APIError?
    @State private var confirmOut = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                if let p = profile {
                    hero(p)
                    stats(p)
                    purchases(p)
                    Button(tr("logout"), role: .destructive) { confirmOut = true }
                        .buttonStyle(.plainField)
                        .padding(.top, 6)
                } else if let error {
                    ScreenTitle(text: tr("accountTitle"))
                    CardBox {
                        Text(error == .offline ? tr("common.offline") : tr("code.error")).foregroundStyle(Theme.ink)
                        Button(tr("common.retry")) { Task { await load() } }.buttonStyle(.lime)
                    }
                } else {
                    ScreenTitle(text: tr("accountTitle"))
                    ProgressView().controlSize(.large).tint(Theme.accentInk).frame(maxWidth: .infinity, minHeight: 240)
                }
            }
            .padding(16)
        }
        .background(ScreenBackground())
        .refreshable { await load() }
        .task(id: session.generation) { await load() }
        .confirmationDialog(tr("account.signOutConfirm"), isPresented: $confirmOut, titleVisibility: .visible) {
            Button(tr("logout"), role: .destructive) { Task { await session.signOut() } }
        }
    }

    private func load() async {
        do {
            async let p = API.shared.profile()
            async let n = try? API.shared.notices()
            profile = try await p
            notices = await n
            error = nil
        } catch let e as APIError {
            if e == .login { await session.refresh() } else { error = e }
        } catch { self.error = .offline }
    }

    private func hero(_ p: Profile) -> some View {
        let color = UIColor(css: session.people.first { $0.id == p.id }?.color) ?? UIColor(hex: 0xC6FF2E)
        return VStack(alignment: .leading, spacing: 14) {
            Kicker(text: tr("accountTitle"), color: Theme.accent)
            HStack(spacing: 14) {
                Text(String(p.name.prefix(1)).uppercased())
                    .font(Theme.heading(26)).foregroundStyle(.white)
                    .frame(width: 64, height: 64)
                    .background(Color(color), in: RoundedRectangle(cornerRadius: 14))
                    .accessibilityHidden(true)
                VStack(alignment: .leading, spacing: 4) {
                    Text(p.name).font(Theme.heading(26)).foregroundStyle(Theme.onStage).lineLimit(2).minimumScaleFactor(0.6)
                        .accessibilityAddTraits(.isHeader)
                    Text(subtitle(p)).font(.system(size: 13)).foregroundStyle(Theme.onStage.opacity(0.65))
                }
            }
            if let n = notices, n.unread > 0 {
                Chip(text: "\(tr("account.unread")): \(n.unread)", lime: true)
            }
        }
        .padding(18)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.stage, in: RoundedRectangle(cornerRadius: 14))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(Theme.stageLine))
    }

    private func subtitle(_ p: Profile) -> String {
        var parts: [String] = []
        if let e = p.email, !e.isEmpty { parts.append(e) }
        if p.provider == "demo" { parts.append(tr("demoLoginTitle")) }
        if let s = p.since { parts.append("\(tr("accSince")) \(Format.date(s))") }
        return parts.joined(separator: " · ")
    }

    private func stats(_ p: Profile) -> some View {
        let s = p.stats
        return VStack(spacing: 12) {
            HStack(spacing: 12) {
                Stat(value: "\(p.codes)", label: tr("navCodes"))
                Stat(value: "\(s.scans30)", label: tr("accScans30"), note: tr("accScansAll", ["n": "\(s.scans)"]))
            }
            HStack(spacing: 12) {
                VStack(alignment: .leading, spacing: 8) {
                    (Text(Format.bytes(s.used)).font(Theme.heading(22)).foregroundStyle(Theme.ink)
                        + Text(" / \(Format.bytes(s.quota))").font(.system(size: 13, weight: .semibold)).foregroundStyle(Theme.muted))
                        .minimumScaleFactor(0.5).lineLimit(1)
                    Text(tr("accSpace")).font(.system(size: 12, weight: .semibold)).foregroundStyle(Theme.muted)
                    ProgressView(value: Double(s.used), total: Double(max(s.quota, 1))).tint(Theme.accentInk)
                }
                .padding(14)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(Theme.card, in: RoundedRectangle(cornerRadius: 10))
                .overlay(RoundedRectangle(cornerRadius: 10).stroke(Theme.line))
                .accessibilityElement(children: .combine)
                Stat(value: "\(s.packsLeft)", label: tr("accPacksLeft"))
            }
        }
    }

    private func purchases(_ p: Profile) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Kicker(text: tr("accPurchases"))
                Spacer()
                if p.stats.spent > 0 { Text("\(tr("accSpent")): \(Format.money(p.stats.spent))").font(.system(size: 12, weight: .semibold)).foregroundStyle(Theme.muted) }
            }
            if p.purchases.isEmpty && p.packs.isEmpty {
                CardBox { Text(tr("account.noPurchases")).foregroundStyle(Theme.muted) }
            }
            ForEach(p.packs) { pk in
                PurchaseRow(title: "\(tr("accPackItem")) · \(pk.codes) \(tr("account.qrIn"))",
                            note: tr("accPackUsed", ["used": "\(pk.used)", "codes": "\(pk.codes)"]),
                            price: Format.money(pk.price), date: pk.at)
            }
            ForEach(p.purchases) { pu in
                PurchaseRow(title: pu.tier == "simple" ? tr("tierSimple") : tr("tierStyled"),
                            note: pu.pack != nil ? tr("accFromPack") : (pu.free ? tr("free") : nil),
                            price: pu.free || pu.pack != nil ? "—" : Format.money(pu.price), date: pu.at)
            }
        }
    }
}

private struct Stat: View {
    let value: String
    let label: String
    var note: String? = nil
    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(value).font(Theme.heading(30)).foregroundStyle(Theme.ink).lineLimit(1).minimumScaleFactor(0.5)
            Text(label).font(.system(size: 12, weight: .semibold)).foregroundStyle(Theme.muted).lineLimit(2)
            if let note { Text(note).font(.system(size: 11)).foregroundStyle(Theme.muted) }
        }
        .padding(14)
        .frame(maxWidth: .infinity, minHeight: 100, alignment: .topLeading)
        .background(Theme.card, in: RoundedRectangle(cornerRadius: 10))
        .overlay(RoundedRectangle(cornerRadius: 10).stroke(Theme.line))
        .accessibilityElement(children: .combine)
    }
}

private struct PurchaseRow: View {
    let title: String
    let note: String?
    let price: String
    let date: String
    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 3) {
                Text(title).font(.system(size: 15, weight: .semibold)).foregroundStyle(Theme.ink)
                Text([note, Format.date(date)].compactMap { $0 }.joined(separator: " · ")).font(.system(size: 12)).foregroundStyle(Theme.muted)
            }
            Spacer()
            Text(price).font(Theme.mono(15, weight: .bold)).foregroundStyle(Theme.ink)
        }
        .padding(14)
        .background(Theme.card, in: RoundedRectangle(cornerRadius: 10))
        .overlay(RoundedRectangle(cornerRadius: 10).stroke(Theme.line))
        .accessibilityElement(children: .combine)
    }
}
