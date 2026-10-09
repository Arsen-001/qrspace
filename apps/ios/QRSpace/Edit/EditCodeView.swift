import SwiftUI

/// Editing one code — its own page (the site's /codes/{id}): name, what's in the code, who sees it, and the memory
/// (entries, adding text/photo/video, space). People who may only add to someone else's code see the memory part.
struct EditCodeView: View {
    let id: String
    var onGuest: (() -> Void)? = nil

    @Environment(Session.self) private var session
    @State private var code: CodeView?
    @State private var error: APIError?
    @State private var titleDraft = ""
    @State private var contentDraft: [String: String] = [:]
    @State private var saving: String?
    @State private var saved: String?
    @State private var failed: String?
    @State private var download: DownloadGate?
    @State private var downloading = false
    @State private var downloadFailed = false
    @State private var shareFile: ShareFile?

    struct DownloadGate: Identifiable { let id = UUID(); let quote: Quote; let tier: Tier; let key: String }
    struct ShareFile: Identifiable { let id = UUID(); let url: URL }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                if let code {
                    hero(code)
                    if code.access == .owner {
                        titleSection(code)
                        if let c = code.content { contentSection(c) }
                        visibilitySection(code)
                    }
                    if code.canAdd {
                        Kicker(text: tr("tabMemory")).padding(.top, 4)
                        MemoryEditor(code: Binding(get: { self.code ?? code }, set: { self.code = $0; session.codesVersion += 1 }))
                    }
                    footer(code)
                } else if let error {
                    CardBox {
                        Text(error == .offline ? tr("common.offline") : error == .notFound ? tr("code.notFound") : tr("code.error"))
                            .foregroundStyle(Theme.ink)
                        if error != .notFound {
                            Button(tr("common.retry")) { Task { await load() } }.buttonStyle(.lime)
                        }
                    }
                } else {
                    ProgressView().controlSize(.large).tint(Theme.accentInk).frame(maxWidth: .infinity, minHeight: 300)
                }
            }
            .padding(16)
            .frame(maxWidth: 720)
            .frame(maxWidth: .infinity)
        }
        .scrollDismissesKeyboard(.interactively)
        .background(ScreenBackground())
        .navigationTitle(tr("edit"))
        .navigationBarTitleDisplayMode(.inline)
        .task(id: "\(id)-\(session.generation)") { await load() }
        .refreshable { await load() }
        .sheet(item: $download) { g in
            GateSheet(quote: g.quote, tier: g.tier, busy: downloading, labels: .download,
                      onConfirm: { confirmDownload(g) }, onCancel: { download = nil })
                .presentationDetents([.medium, .large])
                .presentationBackground(Theme.stage)
        }
        .sheet(item: $shareFile) { f in ActivityView(items: [f.url]).ignoresSafeArea() }
    }

    private func load() async {
        do {
            let c = try await API.shared.code(id)
            code = c
            titleDraft = c.title ?? ""
            contentDraft = c.content?.fields ?? [:]
            error = nil
        } catch let e as APIError {
            if e == .login { await session.refresh() }
            error = e
        } catch { self.error = .offline }
    }

    // MARK: sections

    private func hero(_ code: CodeView) -> some View {
        HStack(alignment: .top, spacing: 14) {
            CodeImage(code: code, base: session.linkBase, size: 112)
                .accessibilityElement()
                .accessibilityLabel(tr("codes.qrLabel", ["t": code.title ?? ""]))
            VStack(alignment: .leading, spacing: 6) {
                Kicker(text: code.content.map { tr("type.\($0.type)") } ?? kindName(code.kind), color: Theme.accent)
                Text(code.title ?? tr("codes.untitled")).font(Theme.heading(20)).foregroundStyle(Theme.onStage)
                    .lineLimit(3).minimumScaleFactor(0.6).accessibilityAddTraits(.isHeader)
                if let st = code.stats {
                    (Text("\(st.total)").font(Theme.heading(20)) + Text(" \(tr("scansCount").lowercased())").font(.system(size: 13)))
                        .foregroundStyle(Theme.onStage)
                    Text(tr("dashWeek", ["n": "\(st.week)"])).font(.system(size: 12, weight: st.week > 0 ? .bold : .regular))
                        .foregroundStyle(st.week > 0 ? Theme.accent : Theme.onStage.opacity(0.5))
                }
            }
            Spacer(minLength: 0)
        }
        .padding(16)
        .background(Theme.stage, in: RoundedRectangle(cornerRadius: 18))
        .overlay(RoundedRectangle(cornerRadius: 18).stroke(Theme.stageLine))
    }

    private func titleSection(_ code: CodeView) -> some View {
        let changed = titleDraft.trimmingCharacters(in: .whitespaces) != (code.title ?? "") && !titleDraft.trimmingCharacters(in: .whitespaces).isEmpty
        return CardBox {
            FieldLabel(text: tr("titleLabel"))
            TextField(tr("titleLabel"), text: $titleDraft)
                .textFieldStyle(BoxField())
                .submitLabel(.done)
                .onSubmit { if changed { save("title", ["title": titleDraft.trimmingCharacters(in: .whitespaces)]) } }
                .accessibilityIdentifier("edit-title")
            HStack {
                status("title")
                Spacer()
                if changed {
                    saveButton("title") { save("title", ["title": titleDraft.trimmingCharacters(in: .whitespaces)]) }
                        .accessibilityIdentifier("edit-title-save")
                }
            }
        }
    }

    private func contentSection(_ c: Content) -> some View {
        let draft = Content(type: c.type, fields: contentDraft.filter { !$0.value.trimmingCharacters(in: .whitespaces).isEmpty })
        let changed = draft.fields != c.fields
        return CardBox {
            HStack(spacing: 10) {
                Image(systemName: ContentTypes.icon(c.type)).font(.system(size: 15, weight: .bold))
                    .frame(width: 32, height: 32).foregroundStyle(Theme.onAccent)
                    .background(Theme.accent, in: RoundedRectangle(cornerRadius: 9))
                VStack(alignment: .leading, spacing: 1) {
                    Text(tr("step1")).font(.system(size: 16, weight: .heavy).width(.expanded)).foregroundStyle(Theme.ink)
                    Text(tr("type.\(c.type)")).font(.system(size: 12)).foregroundStyle(Theme.muted)
                }
            }
            ContentFields(type: c.type, fields: $contentDraft)
            HStack {
                status("content")
                Spacer()
                if changed {
                    saveButton("content") { save("content", ["content": ["type": c.type, "fields": draft.fields]]) }
                        .disabled(draft.sitePayload.isEmpty)
                }
            }
        }
    }

    private func visibilitySection(_ code: CodeView) -> some View {
        CardBox {
            Text(tr("visTitle")).font(.system(size: 16, weight: .heavy).width(.expanded)).foregroundStyle(Theme.ink)
                .accessibilityAddTraits(.isHeader)
            ForEach(["all", "contacts", "people", "me"], id: \.self) { v in
                let on = code.visibility == v
                Button { if !on { save("vis", ["visibility": v]) } } label: {
                    HStack(alignment: .top, spacing: 12) {
                        Image(systemName: on ? "largecircle.fill.circle" : "circle")
                            .font(.system(size: 20)).foregroundStyle(on ? Theme.accentInk : Theme.muted)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(tr("vis.\(v)")).font(.system(size: 15, weight: .semibold)).foregroundStyle(Theme.ink)
                            Text(tr("visHint.\(v)")).font(.system(size: 12)).foregroundStyle(Theme.muted)
                                .multilineTextAlignment(.leading)
                        }
                        Spacer(minLength: 0)
                    }
                    .padding(.vertical, 6)
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .disabled(saving == "vis")
                .accessibilityElement(children: .combine)
                .accessibilityAddTraits(on ? [.isButton, .isSelected] : .isButton)
            }
            status("vis")
        }
    }

    private func footer(_ code: CodeView) -> some View {
        let link = URL(string: code.link(base: session.linkBase)) ?? API.base
        return VStack(spacing: 10) {
            if code.access == .owner {
                Button { startDownload(code) } label: {
                    HStack(spacing: 8) {
                        if downloading && download == nil { ProgressView() } else { Image(systemName: "arrow.down.to.line") }
                        Text("\(tr("download")) PNG")
                    }
                }
                .buttonStyle(.lime)
                .disabled(downloading)
                .accessibilityIdentifier("download-png")
                if downloadFailed { Text(tr("saveError")).font(.system(size: 13)).foregroundStyle(Theme.warn) }
            }
            if let onGuest {
                Button(action: onGuest) { Label(tr("dashAsGuest"), systemImage: "eye") }.buttonStyle(.plainField)
            }
            ShareLink(item: link) { Label(tr("result.share"), systemImage: "square.and.arrow.up") }.buttonStyle(.plainField)
        }
        .padding(.top, 4)
    }

    // MARK: download (full size only once the code is paid)

    /// Generator codes and market editions are paid already. A memory code is paid at download, like on the site:
    /// the gate with the key `code:<id>` (first simple code free, a pack, or $1 — demo), then the 1024 px drawing.
    private func startDownload(_ code: CodeView) {
        downloading = true
        downloadFailed = false
        Task {
            defer { downloading = false }
            // `paid` from the server; an older server — generator codes and editions count as paid.
            if !(code.paid ?? (code.content != nil || code.edition != nil)) {
                let key = "code:\(code.id)", tier = Pricing.tier(ofSaved: code.style?.raw)
                do {
                    let q = try await API.shared.quote(key: key, tier: tier)
                    if !q.paid { download = DownloadGate(quote: q, tier: tier, key: key); return }
                } catch { downloadFailed = true; return }
            }
            await fetchFull(code)
        }
    }

    private func confirmDownload(_ g: DownloadGate) {
        downloading = true
        Task {
            do {
                try await API.shared.pay(key: g.key, tier: g.tier)
                download = nil
                if let code { await fetchFull(code) }
                await load() // now `paid` — the drawing re-checks at full size
            } catch {
                download = nil
                downloadFailed = true
            }
            downloading = false
        }
    }

    /// The full-size drawing as a PNG file — Save Image, Print, AirDrop… from the share sheet.
    private func fetchFull(_ code: CodeView) async {
        guard case .fresh(let data, _)? = try? await API.shared.codeImage(code.id, size: 1024, etag: nil) else {
            downloadFailed = true
            return
        }
        let url = FileManager.default.temporaryDirectory.appendingPathComponent("qr-\(code.id).png")
        do { try data.write(to: url, options: .atomic) } catch { downloadFailed = true; return }
        shareFile = ShareFile(url: url)
    }

    // MARK: saving

    @ViewBuilder private func status(_ what: String) -> some View {
        if saving == what {
            ProgressView().controlSize(.small)
        } else if failed == what {
            Text(tr("saveError")).font(.system(size: 12, weight: .medium)).foregroundStyle(Theme.warn)
        } else if saved == what {
            Label(tr("saved"), systemImage: "checkmark.circle.fill").font(.system(size: 12, weight: .semibold)).foregroundStyle(Theme.ok)
        }
    }

    private func saveButton(_ what: String, action: @escaping () -> Void) -> some View {
        Button(tr("save"), action: action)
            .font(.system(size: 14, weight: .heavy))
            .padding(.horizontal, 16).frame(minHeight: 40)
            .foregroundStyle(Theme.onAccent)
            .background(Theme.accent, in: RoundedRectangle(cornerRadius: 10))
            .buttonStyle(.plain)
            .disabled(saving != nil)
    }

    private func save(_ what: String, _ body: [String: Any]) {
        saving = what
        failed = nil
        saved = nil
        Task {
            do {
                let c = try await API.shared.patch(id, body)
                code = c
                titleDraft = c.title ?? ""
                contentDraft = c.content?.fields ?? [:]
                saved = what
                session.codesVersion += 1
            } catch {
                failed = what
            }
            saving = nil
        }
    }
}

/// The system share sheet.
struct ActivityView: UIViewControllerRepresentable {
    let items: [Any]
    func makeUIViewController(context: Context) -> UIActivityViewController {
        UIActivityViewController(activityItems: items, applicationActivities: nil)
    }
    func updateUIViewController(_ vc: UIActivityViewController, context: Context) {}
}
