import SwiftUI

/// One code as the current person sees it: the code, what's in it, and the memory (text, photos, video).
struct CodeDetailView: View {
    /// `guest` — the code as a person who isn't signed in sees it ("As others see it").
    enum Source: Hashable { case id(String), link(OurLink), guest(String) }
    enum LoadState { case loading, loaded(CodeView), failed(APIError) }

    let source: Source
    /// Opened by a scan: the server counts the visit; a link-code sends the guest straight to its target.
    var fromScan = false
    @Environment(Session.self) private var session
    @Environment(Router.self) private var router
    @Environment(\.openURL) private var openURL
    @State private var state: LoadState = .loading
    @State private var autoOpened = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                switch state {
                case .loading:
                    ProgressView().controlSize(.large).tint(Theme.accentInk).frame(maxWidth: .infinity, minHeight: 300)
                case .failed(let e):
                    failure(e)
                case .loaded(let code):
                    content(code)
                }
            }
            .padding(16)
            .frame(maxWidth: 640)
            .frame(maxWidth: .infinity)
        }
        .tabBarClearance()
        .background(ScreenBackground())
        .navigationBarTitleDisplayMode(.inline)
        .task(id: "\(source)-\(session.generation)") { await load() }
        .refreshable { await load() }
    }

    private func load() async {
        do {
            let code: CodeView
            switch source {
            case .id(let x): code = try await API.shared.code(x, visit: fromScan)
            case .link(let l): code = try await API.shared.code(try await l.codeId(), visit: fromScan)
            case .guest(let x): code = try await API.shared.codeAsGuest(x)
            }
            state = .loaded(code)
            autoOpenIfLink(code)
        } catch let e as APIError {
            state = .failed(e)
        } catch {
            state = .failed(.offline)
        }
    }

    /// Site decision (PROJECT.md, 07.10): a scanned link-code must take the person to its target, not stall in the app.
    private func autoOpenIfLink(_ code: CodeView) {
        guard fromScan, !autoOpened, code.access != .owner, code.blocked != true, let c = code.content,
              ["url", "whatsapp", "telegram", "instagram", "facebook", "tiktok", "youtube", "linkedin", "x"].contains(c.type),
              let u = URL(string: c.payload), u.scheme?.hasPrefix("http") == true else { return }
        autoOpened = true
        openURL(u)
    }

    // MARK: states

    private func failure(_ e: APIError) -> some View {
        VStack(alignment: .leading, spacing: 14) {
            ScreenTitle(text: e == .notFound ? tr("code.notFound") : tr("code.error"), kicker: tr("result.ours"))
            if e == .offline { Text(tr("common.offline")).foregroundStyle(Theme.muted) }
            if e != .notFound {
                Button(tr("common.retry")) { state = .loading; Task { await load() } }.buttonStyle(.lime)
            }
        }
    }

    @ViewBuilder private func content(_ code: CodeView) -> some View {
        hero(code)
        if code.blocked == true {
            Label(tr("closedTitle"), systemImage: "exclamationmark.octagon.fill").foregroundStyle(Theme.warn)
        }
        if code.access == .closed {
            closed(code)
        } else {
            if let c = code.content, !c.payload.isEmpty {
                Kicker(text: tr("code.whatInside"))
                ParsedCard(parsed: Parsed.parse(c.payload))
            }
            memory(code)
        }
        footer(code)
    }

    private func hero(_ code: CodeView) -> some View {
        VStack(alignment: .leading, spacing: 14) {
            if case .guest = source {
                Label(tr("dashAsGuest"), systemImage: "eye").font(.system(size: 13, weight: .bold))
                    .foregroundStyle(Theme.accent)
            }
            HStack(alignment: .top, spacing: 14) {
                CodeImage(code: code, base: session.linkBase, size: 112)
                    .accessibilityElement()
                    .accessibilityLabel(tr("codes.qrLabel", ["t": code.title ?? ""]))
                VStack(alignment: .leading, spacing: 6) {
                    Kicker(text: kindName(code.kind), color: Theme.accent)
                    Text(code.title ?? tr("closedTitle"))
                        .font(Theme.heading(22)).foregroundStyle(Theme.onStage)
                        .lineLimit(4).minimumScaleFactor(0.6)
                        .accessibilityAddTraits(.isHeader)
                }
                Spacer(minLength: 0)
            }
            HStack(spacing: 8) {
                if let owner = session.name(of: code.owner), code.access != .owner {
                    Chip(text: "\(tr("ownerLabel")): \(owner)")
                }
                if code.access != .closed { Chip(text: tr("access.\(code.access.rawValue)"), lime: code.access == .owner) }
                if let v = code.visibility, code.access == .owner { Chip(text: tr("vis.\(v)")) }
            }
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.stage, in: RoundedRectangle(cornerRadius: 14))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(Theme.stageLine))
    }

    private func closed(_ code: CodeView) -> some View {
        CardBox {
            Label(tr("closedTitle"), systemImage: "lock.fill").font(.system(size: 18, weight: .bold)).foregroundStyle(Theme.ink)
            Text(code.visibility == "me" ? tr("closedMe") : tr("closedHint")).foregroundStyle(Theme.muted)
            if session.personId == nil {
                Text(tr("code.signInToSee")).foregroundStyle(Theme.ink)
                Button(tr("login")) { router.tab = .account }.buttonStyle(.lime)
            }
        }
    }

    @ViewBuilder private func memory(_ code: CodeView) -> some View {
        let blocks = code.blocks ?? []
        if code.kind == "memory" || !blocks.isEmpty {
            HStack {
                Kicker(text: tr("tabMemory"))
                Spacer()
                if let s = code.storage {
                    Text("\(Format.bytes(s.used)) / \(Format.bytes(s.quota))").font(Theme.mono(12)).foregroundStyle(Theme.muted)
                }
            }
            if blocks.isEmpty {
                CardBox { Text(tr("memoryEmpty")).foregroundStyle(Theme.muted) }
            }
            ForEach(blocks) { b in BlockView(block: b, author: session.name(of: b.author)) }
        }
    }

    private func footer(_ code: CodeView) -> some View {
        let page = URL(string: "\(API.base.absoluteString)/c/\(code.id)")!
        let link = URL(string: code.link(base: session.linkBase)) ?? page
        return VStack(spacing: 10) {
            ShareLink(item: link) { Label(tr("result.share"), systemImage: "square.and.arrow.up") }.buttonStyle(.plainField)
            // Someone else's code: report it (App Store guideline 1.2 — people can flag what others put under codes).
            if code.access != .owner { ReportBox(id: code.id) }
            // No "Open on qrspace.co": the website sells codes, packs and space outside Apple's in-app purchase, and
            // App Review rejects links that lead there (guideline 3.1.1).
        }
        .padding(.top, 4)
    }
}

func kindName(_ kind: String) -> String {
    ["memory", "car", "lost", "pet", "item", "link"].contains(kind) ? tr("tpl.\(kind)") : kind
}

struct Chip: View {
    let text: String
    var lime = false
    var body: some View {
        Text(text)
            .font(.system(size: 12, weight: .bold))
            .lineLimit(1)
            .padding(.horizontal, 10).padding(.vertical, 6)
            .foregroundStyle(lime ? Theme.onAccent : Theme.onStage)
            .background(lime ? Theme.accent : Theme.onStage.opacity(0.1), in: Capsule())
    }
}

/// QR drawn locally on its own light "plate" (quiet zone), like a sticker.
struct QRThumb: View {
    let text: String
    var fg: UIColor = .black
    var bg: UIColor = .white
    var size: CGFloat = 64

    var body: some View {
        Group {
            if let img = QRRender.image(text, fg: fg, bg: bg) {
                Image(uiImage: img).interpolation(.none).resizable().scaledToFit()
            } else {
                Color.gray
            }
        }
        .padding(size * 0.07)
        .frame(width: size, height: size)
        .background(Color(bg), in: RoundedRectangle(cornerRadius: size * 0.1))
    }
}

/// A memory record: text, photo or video, with author and date.
struct BlockView: View {
    let block: Block
    let author: String?

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            switch block.kind {
            case "photo":
                if let m = block.media { AuthedImage(url: API.shared.mediaURL(m)).accessibilityLabel(block.text.isEmpty ? tr("code.photo") : block.text) }
            case "video":
                if let m = block.media { AuthedVideo(url: API.shared.mediaURL(m)).accessibilityLabel(tr("code.video")) }
            default:
                EmptyView()
            }
            if !block.text.isEmpty {
                Text(block.text).font(.system(size: 16)).foregroundStyle(Theme.ink).textSelection(.enabled)
            }
            Text([author, Format.date(block.at)].compactMap { $0 }.joined(separator: " · "))
                .font(.system(size: 12)).foregroundStyle(Theme.muted)
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.card, in: RoundedRectangle(cornerRadius: 10))
        .overlay(RoundedRectangle(cornerRadius: 10).stroke(Theme.line))
    }
}

/// "Report this code" (src/components/ReportBox.tsx): a reason, optional details, sent to the admin. Works signed out.
struct ReportBox: View {
    static let reasons = ["phishing", "spam", "offensive", "other"]
    let id: String
    @State private var open = false
    @State private var reason = "phishing"
    @State private var text = ""
    @State private var state: Phase = .idle
    enum Phase { case idle, busy, sent, limit, error }

    var body: some View {
        if state == .sent {
            Label(tr("reportSent"), systemImage: "checkmark.circle.fill").font(.system(size: 13, weight: .semibold))
                .foregroundStyle(Theme.ok).frame(maxWidth: .infinity)
        } else if !open {
            Button(tr("reportCode")) { open = true }
                .font(.system(size: 13)).underline().foregroundStyle(Theme.muted)
                .frame(maxWidth: .infinity, minHeight: 44)
                .accessibilityIdentifier("report-open")
        } else {
            CardBox {
                Text(tr("reportCode")).font(.system(size: 15, weight: .semibold)).foregroundStyle(Theme.ink)
                FlowRow(spacing: 8) {
                    ForEach(Self.reasons, id: \.self) { r in
                        let on = reason == r
                        Button(tr("reason.\(r)")) { reason = r }
                            .font(.system(size: 13, weight: .medium))
                            .padding(.horizontal, 12).frame(minHeight: 36)
                            .foregroundStyle(on ? Theme.onAccent : Theme.ink)
                            .background(on ? Theme.accent : Theme.field, in: RoundedRectangle(cornerRadius: 10))
                            .overlay(RoundedRectangle(cornerRadius: 10).stroke(on ? Theme.accent : Theme.line))
                            .buttonStyle(.plain)
                            .accessibilityAddTraits(on ? [.isSelected] : [])
                    }
                }
                TextField(tr("reportDetails"), text: $text, axis: .vertical).lineLimit(2...5).textFieldStyle(BoxField())
                if state == .limit { Text(tr("sendLimit")).font(.system(size: 12)).foregroundStyle(Theme.warn) }
                if state == .error { Text(tr("sendError")).font(.system(size: 12)).foregroundStyle(Theme.warn) }
                HStack(spacing: 8) {
                    Button(tr("reportSend")) { send() }
                        .font(.system(size: 14, weight: .semibold))
                        .padding(.horizontal, 16).frame(minHeight: 42)
                        .foregroundStyle(.white).background(Theme.warn, in: RoundedRectangle(cornerRadius: 10))
                        .buttonStyle(.plain)
                        .disabled(state == .busy)
                    Button(tr("cancel")) { open = false }
                        .font(.system(size: 14)).foregroundStyle(Theme.muted).frame(minHeight: 42)
                }
            }
        }
    }

    private func send() {
        state = .busy
        Task {
            do {
                try await API.shared.report(id, reason: reason, text: String(text.prefix(1000)))
                state = .sent
            } catch APIError.limit {
                state = .limit
            } catch {
                state = .error
            }
        }
    }
}
