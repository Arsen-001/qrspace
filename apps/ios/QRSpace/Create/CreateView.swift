import SwiftUI

/// "Create a QR code" — its own page, like the site's /create: what goes in the code (or a code with memory),
/// a name, the look with a live preview from the server, then the price gate (first simple code free, from a
/// pack, or pay — demo) and the code is created.
struct CreateView: View {
    enum Mode: Hashable { case content, memory }
    struct Gate: Identifiable {
        let id = UUID()
        let quote: Quote
        let tier: Tier
        let key: String
        let content: Content
    }

    /// The new code's id → the edit page.
    let onCreated: (String) -> Void

    @Environment(Session.self) private var session
    @State private var mode: Mode = .content
    @State private var type = "url"
    @State private var fields: [String: [String: String]] = [:]
    @State private var title = ""
    @State private var style = QRStyle.default
    @State private var gate: Gate?
    @State private var gateError: String?
    @State private var busy = false
    @State private var error: String?
    @State private var askSignIn = false

    private var content: Content {
        let keys = ContentTypes.fields[type] ?? []
        return Content(type: type, fields: (fields[type] ?? [:]).filter { keys.contains($0.key) && !$0.value.trimmingCharacters(in: .whitespaces).isEmpty })
    }
    private var ready: Bool {
        mode == .content ? !content.sitePayload.isEmpty : !title.trimmingCharacters(in: .whitespaces).isEmpty
    }
    private var tier: Tier { Pricing.tier(of: style) }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                ScreenTitle(text: tr("makeTitle"))
                modePicker
                if mode == .content { contentStep } else { memoryStep }
                lookStep
                createBar
            }
            .padding(16)
            .frame(maxWidth: 720)
            .frame(maxWidth: .infinity)
        }
        .scrollDismissesKeyboard(.interactively)
        .tabBarClearance()
        .background(ScreenBackground())
        .navigationBarTitleDisplayMode(.inline)
        .sheet(item: $gate) { g in
            GateSheet(quote: g.quote, tier: g.tier, busy: busy, labels: .create, message: gateError,
                      onConfirm: { Task { await confirm(g) } }, onCancel: { gate = nil })
                .presentationDetents([.medium, .large])
                .presentationBackground(Theme.stage)
        }
        .sheet(isPresented: $askSignIn) {
            NavigationStack {
                SignInView(note: tr("create.signIn"))
                    .toolbar {
                        ToolbarItem(placement: .cancellationAction) {
                            Button { askSignIn = false } label: { Image(systemName: "xmark") }.accessibilityLabel(tr("common.close"))
                        }
                    }
            }
        }
        .onChange(of: session.personId) { _, id in
            // Signed in from the sheet — go on with creating.
            if id != nil, askSignIn { askSignIn = false; Task { await start() } }
        }
    }

    // MARK: steps

    private var modePicker: some View {
        HStack(spacing: 10) {
            ModeTile(title: tr("create.modeQR"), hint: tr("create.modeQRHint"), icon: "qrcode", on: mode == .content) { mode = .content }
            ModeTile(title: tr("memoryPromoTitle"), hint: tr("create.modeMemoryHint"), icon: "photo.on.rectangle.angled", on: mode == .memory) { mode = .memory }
        }
    }

    private var contentStep: some View {
        Step(n: 1, title: tr("step1")) {
            TypePicker(type: $type)
            Divider().overlay(Theme.line)
            ContentFields(type: type, fields: Binding(get: { fields[type] ?? [:] }, set: { fields[type] = $0 }))
            VStack(alignment: .leading, spacing: 6) {
                FieldLabel(text: tr("titleLabel"))
                TextField(content.sitePayload.isEmpty ? tr("titleLabel") : content.autoTitle, text: $title)
                    .textFieldStyle(BoxField())
                    .accessibilityIdentifier("field-codeTitle")
                Text(tr("create.titleHint")).font(.system(size: 12)).foregroundStyle(Theme.muted)
            }
        }
    }

    private var memoryStep: some View {
        Step(n: 1, title: tr("memoryPromoTitle")) {
            Text(tr("memoryPromoText")).font(.system(size: 14)).foregroundStyle(Theme.muted)
            VStack(alignment: .leading, spacing: 6) {
                FieldLabel(text: tr("newCodeTitle"))
                TextField(tr("newCodePlaceholder"), text: $title)
                    .textFieldStyle(BoxField())
                    .accessibilityIdentifier("field-codeTitle")
            }
        }
    }

    private var lookStep: some View {
        Step(n: 2, title: tr("step2")) {
            VStack(spacing: 10) {
                StylePreview(style: style, size: 240)
                    .shadow(color: .black.opacity(0.12), radius: 12, y: 6)
                    .accessibilityLabel(tr("sampleBadge"))
                HStack(spacing: 8) {
                    Circle().fill(tier == .simple ? Theme.muted : Theme.accentInk).frame(width: 8, height: 8)
                    Text(tier == .simple ? tr("tierSimple") : tr("tierStyled")).font(.system(size: 14, weight: .semibold))
                    if let price = Store.shared.price(.code) {
                        Text(price).font(.system(size: 16, weight: .heavy).width(.expanded))
                    }
                }
                .foregroundStyle(Theme.ink)
                .accessibilityElement(children: .combine)
            }
            .frame(maxWidth: .infinity)
            StylePicker(style: $style)
        }
    }

    private var createBar: some View {
        VStack(spacing: 10) {
            if let error {
                Text(error).font(.system(size: 14, weight: .medium)).foregroundStyle(Theme.warn)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
            Button { Task { await start() } } label: {
                HStack(spacing: 10) {
                    if busy { ProgressView().tint(Theme.onAccent) }
                    Text(tr("create")).font(.system(size: 18, weight: .heavy).width(.expanded))
                }
                .frame(maxWidth: .infinity, minHeight: 56)
            }
            .buttonStyle(.plain)
            .foregroundStyle(Theme.onAccent)
            .background(Theme.accent, in: RoundedRectangle(cornerRadius: 14))
            .opacity(ready && !busy ? 1 : 0.45)
            .disabled(!ready || busy)
            .accessibilityIdentifier("create-submit")
            if !ready {
                Text(mode == .content ? tr("create.fillIn") : tr("newCodeTitle"))
                    .font(.system(size: 12)).foregroundStyle(Theme.muted)
            } else if mode == .content {
                Text(tr("firstFree")).font(.system(size: 12)).foregroundStyle(Theme.muted).multilineTextAlignment(.center)
            }
        }
        .padding(.top, 4)
    }

    // MARK: actions

    private func start() async {
        error = nil
        guard session.personId != nil else { askSignIn = true; return }
        busy = true
        defer { busy = false }
        if mode == .memory {
            do {
                let c = try await API.shared.create(title: title.trimmingCharacters(in: .whitespaces), kind: "memory", style: style)
                session.codesVersion += 1
                onCreated(c.id)
            } catch { show(error) }
            return
        }
        let c = content
        let key = Pricing.codeKey(payload: c.sitePayload, styleJSON: style.json)
        do {
            let q = try await API.shared.quote(key: key, tier: tier)
            switch StoreBuild.step(for: q) {
            case .go: await finish(c, key: key)
            case .ask: gate = Gate(quote: q, tier: tier, key: key, content: c)
            case .notInApp: error = tr("store.createNotInApp")
            }
        } catch { show(error) }
    }

    /// Free first code or a code from a pack — the server records it (not a payment). Otherwise Apple in-app
    /// purchase of one code under this key; the server counts it, then the code is created as after any payment.
    private func confirm(_ g: Gate) async {
        busy = true
        gateError = nil
        defer { busy = false }
        do {
            if g.quote.free || g.quote.pack != nil {
                try await API.shared.pay(key: g.key, tier: g.tier)
            } else {
                switch try await Store.shared.buy(.code(key: g.key, tier: g.tier.rawValue)) {
                case .done: break
                case .cancelled: return
                case .pending: gate = nil; error = tr("iap.pending"); return
                }
            }
            gate = nil
            await finish(g.content, key: g.key)
        } catch let f as Store.Failure {
            gateError = f.message
        } catch { gate = nil; show(error) }
    }

    /// One purchase = one code: the server creates it only for an unused purchase of this key (402 otherwise);
    /// every purchase makes a new code, even with the same content — each code is its own (10.10.2026).
    private func finish(_ c: Content, key: String) async {
        do {
            let t = title.trimmingCharacters(in: .whitespaces)
            let r = try await API.shared.quick(content: c, style: style, key: key, title: t == c.autoTitle ? nil : t)
            session.codesVersion += 1
            onCreated(r.id)
        } catch APIError.payment {
            // The earlier purchase went to another code — ask again (the quote is honest about the price).
            if let q = try? await API.shared.quote(key: key, tier: tier), !q.paid {
                if StoreBuild.step(for: q) == .ask { gate = Gate(quote: q, tier: tier, key: key, content: c) } else { error = tr("store.createNotInApp") }
            } else {
                error = tr("saveError")
            }
        } catch { show(error) }
    }

    private func show(_ e: Error) {
        switch e as? APIError {
        case .limit: error = tr("create.limit")
        case .offline: error = tr("common.offline")
        case .login: askSignIn = true
        default: error = tr("saveError")
        }
    }
}

private struct ModeTile: View {
    let title: String
    let hint: String
    let icon: String
    let on: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(alignment: .leading, spacing: 8) {
                Image(systemName: icon).font(.system(size: 20, weight: .bold))
                    .foregroundStyle(on ? Theme.onAccent : Theme.ink)
                    .frame(width: 40, height: 40)
                    .background(on ? Theme.accent : Theme.field, in: RoundedRectangle(cornerRadius: 10))
                Text(title).font(.system(size: 15, weight: .heavy).width(.expanded))
                    .foregroundStyle(on ? Theme.onStage : Theme.ink).lineLimit(2).minimumScaleFactor(0.8)
                Text(hint).font(.system(size: 12)).foregroundStyle(on ? Theme.onStage.opacity(0.7) : Theme.muted)
                    .lineLimit(3).fixedSize(horizontal: false, vertical: true)
                Spacer(minLength: 0)
            }
            .padding(14)
            .frame(maxWidth: .infinity, minHeight: 150, alignment: .topLeading)
            .background(on ? Theme.stage : Theme.card, in: RoundedRectangle(cornerRadius: 18))
            .overlay(RoundedRectangle(cornerRadius: 18).stroke(on ? Theme.accent.opacity(0.7) : Theme.line))
        }
        .buttonStyle(.plain)
        .accessibilityElement(children: .combine)
        .accessibilityAddTraits(on ? [.isButton, .isSelected] : .isButton)
    }
}

/// A numbered step card (the site's StepBadge + heading).
struct Step<Inner: View>: View {
    let n: Int
    let title: String
    @ViewBuilder var content: Inner

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(spacing: 10) {
                Text("\(n)").font(.system(size: 14, weight: .black))
                    .frame(width: 28, height: 28)
                    .foregroundStyle(Theme.onAccent)
                    .background(Theme.accent, in: RoundedRectangle(cornerRadius: 8))
                    .accessibilityHidden(true)
                Text(title).font(.system(size: 18, weight: .heavy).width(.expanded)).foregroundStyle(Theme.ink)
                    .accessibilityAddTraits(.isHeader)
            }
            content
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.card, in: RoundedRectangle(cornerRadius: 18))
        .overlay(RoundedRectangle(cornerRadius: 18).stroke(Theme.line))
    }
}

/// The price gate (Preview.tsx): free first simple code, a code from a pack, or pay. Payment is a demo — the sheet
/// says so. Used before creating a code and before downloading a memory code's full-size image.
struct GateSheet: View {
    struct Labels {
        let free: String
        let pack: String
        let pay: (String) -> String
        /// `pay` gets the store's own price ("$0.99", "990 ₽").
        static var create: Labels { Labels(free: tr("gate.free"), pack: tr("gate.pack"), pay: { tr("iap.payCreate", ["price": $0]) }) }
        static var download: Labels { Labels(free: tr("downloadFree"), pack: tr("packDownload"), pay: { "\(tr("payAndDownload")) — \($0)" }) }
    }

    let quote: Quote
    let tier: Tier
    let busy: Bool
    let labels: Labels
    /// A failed purchase ("Purchases unavailable", "Couldn't buy…").
    var message: String? = nil
    let onConfirm: () -> Void
    let onCancel: () -> Void

    /// One code in the App Store, in the person's currency; nil — purchases off or the products didn't load.
    private var payPrice: String? { Store.shared.price(.code) }
    private var canConfirm: Bool { StoreBuild.step(for: quote) == .ask && (quote.free || quote.pack != nil || payPrice != nil) }

    var body: some View {
        let q = quote
        VStack(alignment: .leading, spacing: 16) {
            HStack {
                HStack(spacing: 8) {
                    Circle().fill(tier == .simple ? Theme.onStage.opacity(0.5) : Theme.accent).frame(width: 8, height: 8)
                    Text(tier == .simple ? tr("tierSimple") : tr("tierStyled")).font(.system(size: 15, weight: .semibold))
                }
                Spacer()
                if let payPrice {
                    Text(payPrice).font(.system(size: 18, weight: .heavy).width(.expanded))
                }
            }
            .padding(.horizontal, 14).frame(minHeight: 48)
            .overlay(RoundedRectangle(cornerRadius: 12).stroke(Theme.stageLine))
            .accessibilityElement(children: .combine)

            if let pack = q.pack {
                Text(tr("packFrom")).font(.system(size: 20, weight: .heavy).width(.expanded))
                Text("\(tr("packLeft")): \(pack.left) · \(Format.bytes(pack.bytes)) \(tr("packRoom"))")
                    .font(Theme.mono(13)).foregroundStyle(Theme.onStage.opacity(0.7))
            } else if q.free {
                Text(tr("freeFirst")).font(.system(size: 20, weight: .heavy).width(.expanded))
            } else if StoreBuild.purchasesEnabled {
                if let payPrice {
                    Text("\(tr("payTitle")): \(payPrice)").font(.system(size: 22, weight: .heavy).width(.expanded))
                } else {
                    PurchasesUnavailable(onStage: true)
                }
            } else {
                // Callers don't open the gate for this (StoreBuild.step → .notInApp); never show a price anyway.
                Text(tr("store.createNotInApp")).font(.system(size: 17, weight: .semibold))
            }

            if let message {
                Text(message).font(.system(size: 14, weight: .medium)).foregroundStyle(Theme.warn)
                    .accessibilityIdentifier("gate-message")
            }

            if canConfirm {
                Button(action: onConfirm) {
                    HStack(spacing: 10) {
                        if busy { ProgressView().tint(Theme.onAccent) }
                        Text(q.pack != nil ? labels.pack : q.free ? labels.free : labels.pay(payPrice ?? ""))
                            .font(.system(size: 17, weight: .heavy))
                    }
                    .frame(maxWidth: .infinity, minHeight: 54)
                }
                .buttonStyle(.plain)
                .foregroundStyle(Theme.onAccent)
                .background(Theme.accent, in: RoundedRectangle(cornerRadius: 14))
                .disabled(busy)
                .accessibilityIdentifier("gate-confirm")
            }

            Button(tr("cancel"), action: onCancel)
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(Theme.onStage.opacity(0.7))
                .frame(maxWidth: .infinity, minHeight: 44)
            Text(tr("firstFree")).font(.system(size: 12)).foregroundStyle(Theme.onStage.opacity(0.55))
            Spacer(minLength: 0)
        }
        .padding(20)
        .foregroundStyle(Theme.onStage)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .background(Theme.stage)
        .accessibilityElement(children: .contain)
        .accessibilityLabel(tr("payTitle"))
    }
}

/// "Purchases unavailable" — the build has purchases but the App Store didn't give us the products (no network,
/// not set up in App Store Connect yet, a device with purchases blocked). "Try again" asks the store once more.
struct PurchasesUnavailable: View {
    var onStage = false
    var body: some View {
        // Still asking the store — a spinner, not "unavailable".
        if Store.shared.load == .loading || Store.shared.load == .idle {
            ProgressView().tint(onStage ? Theme.onStage : Theme.ink).frame(maxWidth: .infinity, minHeight: 44)
        } else {
            unavailable
        }
    }

    private var unavailable: some View {
        VStack(alignment: .leading, spacing: 8) {
            Label(tr("iap.unavailable"), systemImage: "exclamationmark.triangle")
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(onStage ? Theme.onStage : Theme.ink)
            Button(tr("common.retry")) { Task { await Store.shared.loadProducts() } }
                .font(.system(size: 14, weight: .bold))
                .foregroundStyle(onStage ? Theme.accent : Theme.accentInk)
                .disabled(Store.shared.load == .loading)
        }
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("iap-unavailable")
    }
}
