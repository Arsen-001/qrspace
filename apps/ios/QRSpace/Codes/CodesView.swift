import SwiftUI

/// "My codes": my codes and codes others opened to me, QR drawn on the phone.
struct CodesView: View {
    @Environment(Session.self) private var session
    @Environment(Router.self) private var router
    @State private var list: CodeList?
    @State private var error: APIError?
    @State private var path: [CodeDetailView.Source] = []

    var body: some View {
        NavigationStack(path: $path) {
            ScrollView {
                VStack(alignment: .leading, spacing: 14) {
                    ScreenTitle(text: tr("navCodes"), kicker: "QR Space")
                    if session.personId == nil {
                        signedOut
                    } else if let list {
                        if list.mine.isEmpty { CardBox { Text(tr("emptyCodes")).foregroundStyle(Theme.muted) } }
                        grid(list.mine, base: list.base)
                        if !list.shared.isEmpty {
                            Kicker(text: tr("sharedTitle")).padding(.top, 10)
                            grid(list.shared, base: list.base)
                        }
                    } else if let error {
                        CardBox {
                            Text(error == .offline ? tr("common.offline") : tr("code.error")).foregroundStyle(Theme.ink)
                            Button(tr("common.retry")) { Task { await load() } }.buttonStyle(.lime)
                        }
                    } else {
                        ProgressView().controlSize(.large).tint(Theme.accentInk).frame(maxWidth: .infinity, minHeight: 240)
                    }
                }
                .padding(16)
            }
            .background(ScreenBackground())
            .refreshable { await load() }
            .navigationDestination(for: CodeDetailView.Source.self) { CodeDetailView(source: $0) }
            .toolbar(.hidden, for: .navigationBar)
        }
        .task(id: session.generation) { await load() }
        .onChange(of: router.openCode) { _, id in
            if let id { path = [.id(id)]; router.openCode = nil }
        }
    }

    private var signedOut: some View {
        CardBox {
            Text(tr("accLoginText")).font(.system(size: 16)).foregroundStyle(Theme.ink)
            Button(tr("login")) { router.tab = .account }.buttonStyle(.lime)
        }
    }

    private func grid(_ codes: [CodeView], base: String) -> some View {
        LazyVGrid(columns: [GridItem(.adaptive(minimum: 158), spacing: 12)], spacing: 12) {
            ForEach(codes) { c in
                NavigationLink(value: CodeDetailView.Source.id(c.id)) { CodeTile(code: c, base: base) }
                    .buttonStyle(.plain)
            }
        }
    }

    private func load() async {
        guard session.personId != nil else { list = nil; return }
        do { list = try await API.shared.codes(); error = nil } catch let e as APIError {
            if e == .login { await session.refresh() } else { error = e }
        } catch { self.error = .offline }
    }
}

private struct CodeTile: View {
    let code: CodeView
    let base: String

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            QRThumb(text: code.link(base: base), fg: UIColor(css: code.style?.fg) ?? .black, bg: UIColor(css: code.style?.bg) ?? .white, size: 92)
                .accessibilityHidden(true)
            Kicker(text: kindName(code.kind), color: Theme.accent)
            Text(code.title ?? tr("codes.untitled"))
                .font(.system(size: 16, weight: .heavy).width(.expanded))
                .foregroundStyle(Theme.onStage)
                .lineLimit(2, reservesSpace: true)
                .multilineTextAlignment(.leading)
            HStack(spacing: 6) {
                Image(systemName: "text.bubble").font(.system(size: 11))
                Text("\((code.blocks ?? []).count)")
                if let s = code.short, !s.isEmpty { Spacer(); Text(s).font(Theme.mono(11)) }
            }
            .font(.system(size: 12, weight: .semibold))
            .foregroundStyle(Theme.onStage.opacity(0.6))
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.stage, in: RoundedRectangle(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(Theme.stageLine))
        .contentShape(Rectangle())
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(code.title ?? tr("codes.untitled")), \(kindName(code.kind))")
        .accessibilityAddTraits(.isButton)
    }
}
