import Contacts
import ContactsUI
import EventKit
import EventKitUI
import SwiftUI

/// What was scanned and what you can do with it. Our links (qrspace.co/K/…, /c/…) open the code itself.
struct ScanResultView: View {
    let hit: ScanHit
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            Group {
                if case .ours(let link, _) = hit.parsed {
                    CodeDetailView(source: .link(link), fromScan: true)
                } else {
                    ScrollView { ParsedCard(parsed: hit.parsed, symbology: hit.symbology).padding(16) }
                        .background(ScreenBackground())
                }
            }
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button { dismiss() } label: { Image(systemName: "xmark") }
                        .accessibilityLabel(tr("common.close"))
                }
            }
            .navigationBarTitleDisplayMode(.inline)
        }
    }
}

/// The scan (or a code's content) with matching actions.
struct ParsedCard: View {
    let parsed: Parsed
    var symbology: Symbology = .qr
    @Environment(\.openURL) private var openURL
    @State private var copied: String?
    @State private var showPassword = false
    @State private var newContact: ContactItem?
    @State private var newEvent: EventDraft?

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            header
            details
            actions
            if let copied {
                Label(copied, systemImage: "checkmark.circle.fill")
                    .font(.system(size: 14, weight: .semibold)).foregroundStyle(Theme.ok)
                    .transition(.opacity)
                    .accessibilityAddTraits(.updatesFrequently)
            }
        }
        .animation(.easeOut(duration: 0.2), value: copied)
        .sheet(item: $newContact) { ContactSaver(contact: $0.contact).ignoresSafeArea() }
        .sheet(item: $newEvent) { EventSaver(draft: $0).ignoresSafeArea() }
    }

    // MARK: header — big type label on the black stage

    private var header: some View {
        HStack(spacing: 12) {
            Image(systemName: icon).font(.system(size: 22, weight: .bold))
                .frame(width: 48, height: 48)
                .foregroundStyle(Theme.onAccent)
                .background(Theme.accent, in: RoundedRectangle(cornerRadius: 8))
            VStack(alignment: .leading, spacing: 2) {
                Kicker(text: kindLabel, color: Theme.accent)
                Text(title).font(Theme.heading(20)).foregroundStyle(Theme.onStage).lineLimit(3).minimumScaleFactor(0.6)
                    .textSelection(.enabled)
            }
            Spacer(minLength: 0)
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.stage, in: RoundedRectangle(cornerRadius: 12))
        .accessibilityElement(children: .combine)
    }

    private var icon: String {
        switch parsed {
        case .ours: "qrcode"
        case .url: "link"
        case .wifi: "wifi"
        case .phone: "phone.fill"
        case .email: "envelope.fill"
        case .sms: "message.fill"
        case .contact: "person.crop.rectangle.fill"
        case .event: "calendar"
        case .geo: "mappin.and.ellipse"
        case .text: "text.alignleft"
        case .barcode: "barcode"
        }
    }

    private var kindLabel: String {
        switch parsed {
        case .ours: tr("result.ours")
        case .url: tr("result.link")
        case .wifi: tr("type.wifi")
        case .phone: tr("type.phone")
        case .email: tr("type.email")
        case .sms: tr("type.sms")
        case .contact: tr("type.contact")
        case .event: tr("type.event")
        case .geo: tr("type.location")
        case .text: tr("type.text")
        case .barcode(_, let s): s.name
        }
    }

    private var title: String {
        switch parsed {
        case .ours(_, let u), .url(let u): u.host ?? u.absoluteString
        case .wifi(let ssid, _, _, _): ssid
        case .phone(let n): n
        case .email(let a, _, _): a
        case .sms(let n, _): n
        case .contact(let name, let lines, _): name.isEmpty ? (lines.first ?? "—") : name
        case .event(let t, _, _, _, _): t.isEmpty ? "—" : t
        case .geo(let lat, let lon, let q): q.isEmpty ? String(format: "%.5f, %.5f", lat, lon) : q
        case .text(let t): String(t.prefix(80))
        case .barcode: tr("result.barcode")
        }
    }

    // MARK: details

    @ViewBuilder private var details: some View {
        switch parsed {
        case .ours(_, let u), .url(let u):
            CardBox { Text(u.absoluteString).font(Theme.mono(14)).foregroundStyle(Theme.ink).textSelection(.enabled) }
        case .wifi(let ssid, let pass, let sec, _):
            CardBox {
                row(tr("field.ssid"), ssid)
                Divider().overlay(Theme.line)
                if sec.lowercased() == "nopass" || pass.isEmpty {
                    Text(tr("result.noPassword")).foregroundStyle(Theme.muted)
                } else {
                    HStack {
                        VStack(alignment: .leading, spacing: 4) {
                            Kicker(text: tr("field.password"))
                            Text(showPassword ? pass : String(repeating: "•", count: min(pass.count, 14)))
                                .font(Theme.mono(17, weight: .semibold)).foregroundStyle(Theme.ink).textSelection(.enabled)
                        }
                        Spacer()
                        Button { showPassword.toggle() } label: { Image(systemName: showPassword ? "eye.slash" : "eye") }
                            .foregroundStyle(Theme.accentInk)
                            .accessibilityLabel(tr("result.showPassword"))
                    }
                    Text(sec.uppercased()).font(Theme.mono(12)).foregroundStyle(Theme.muted)
                }
            }
            Text(tr("wifiHow")).font(.system(size: 14)).foregroundStyle(Theme.muted)
        case .email(let a, let sub, let body):
            CardBox {
                row(tr("type.email"), a)
                if !sub.isEmpty { Text(sub).font(.system(size: 15, weight: .semibold)).foregroundStyle(Theme.ink) }
                if !body.isEmpty { Text(body).font(.system(size: 15)).foregroundStyle(Theme.muted) }
            }
        case .sms(let n, let body):
            CardBox {
                row(tr("type.phone"), n)
                if !body.isEmpty { Text(body).font(.system(size: 15)).foregroundStyle(Theme.ink) }
            }
        case .contact(_, let lines, _):
            if !lines.isEmpty {
                CardBox { ForEach(lines, id: \.self) { Text($0).font(.system(size: 15)).foregroundStyle(Theme.ink).textSelection(.enabled) } }
            }
        case .event(_, let start, let end, let loc, let notes):
            CardBox {
                if let start { Text(start.formatted(date: .complete, time: .shortened)).font(.system(size: 15, weight: .semibold)).foregroundStyle(Theme.ink) }
                if let end { Text("→ " + end.formatted(date: .abbreviated, time: .shortened)).font(.system(size: 14)).foregroundStyle(Theme.muted) }
                if !loc.isEmpty { Label(loc, systemImage: "mappin").font(.system(size: 15)).foregroundStyle(Theme.ink) }
                if !notes.isEmpty { Text(notes).font(.system(size: 14)).foregroundStyle(Theme.muted) }
            }
        case .geo(let lat, let lon, _):
            CardBox { Text(String(format: "%.6f, %.6f", lat, lon)).font(Theme.mono(15)).foregroundStyle(Theme.ink).textSelection(.enabled) }
        case .text(let t):
            CardBox { Text(t).font(.system(size: 16)).foregroundStyle(Theme.ink).textSelection(.enabled) }
        case .barcode(let n, let s):
            CardBox {
                Text(n).font(Theme.mono(28, weight: .bold)).foregroundStyle(Theme.ink).textSelection(.enabled)
                    .minimumScaleFactor(0.4).lineLimit(2)
                Text(s.name).font(Theme.mono(13)).foregroundStyle(Theme.muted)
            }
        case .phone:
            EmptyView()
        }
    }

    private func row(_ label: String, _ value: String) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Kicker(text: label)
            Text(value).font(.system(size: 17, weight: .semibold)).foregroundStyle(Theme.ink).textSelection(.enabled)
        }
    }

    // MARK: actions

    @ViewBuilder private var actions: some View {
        VStack(spacing: 10) {
            switch parsed {
            case .ours(_, let u), .url(let u):
                Button(tr("result.open")) { openURL(u) }.buttonStyle(.lime)
                HStack(spacing: 10) {
                    copyButton(tr("actCopyLink"), u.absoluteString)
                    ShareLink(item: u) { Text(tr("result.share")) }.buttonStyle(.plainField)
                }
            case .wifi(let ssid, let pass, let sec, _):
                // TODO(entitlement): "Join network" via NEHotspotConfiguration needs the Hotspot Configuration
                // capability on a paid Apple Developer team. Until then: copy the password and join in Settings.
                if sec.lowercased() != "nopass" && !pass.isEmpty {
                    Button(tr("actCopyPassword")) { copy(pass) }.buttonStyle(.lime)
                }
                copyButton(tr("actCopyNetwork"), ssid)
            case .phone(let n):
                Button(tr("actCall")) { open("tel:\(n.filter { $0.isNumber || $0 == "+" })") }.buttonStyle(.lime)
                HStack(spacing: 10) { copyButton(tr("actCopyNumber"), n); share(n) }
            case .email(let a, let sub, let body):
                Button(tr("actEmail")) {
                    var c = URLComponents(); c.scheme = "mailto"; c.path = a
                    c.queryItems = [URLQueryItem(name: "subject", value: sub), URLQueryItem(name: "body", value: body)].filter { !($0.value ?? "").isEmpty }
                    if let u = c.url { openURL(u) }
                }.buttonStyle(.lime)
                copyButton(tr("actCopyEmail"), a)
            case .sms(let n, let body):
                Button(tr("actSms")) {
                    let b = body.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? ""
                    open("sms:\(n)" + (body.isEmpty ? "" : "&body=\(b)"))
                }.buttonStyle(.lime)
                copyButton(tr("actCopyNumber"), n)
            case .contact(_, _, let vcard):
                Button(tr("actSaveContact")) {
                    newContact = (try? CNContactVCardSerialization.contacts(with: Data(vcard.utf8)))?.first.map { ContactItem(contact: $0) }
                }.buttonStyle(.lime)
                HStack(spacing: 10) { copyButton(tr("actCopyText"), vcard); share(vcard) }
            case .event(let t, let start, let end, let loc, let notes):
                Button(tr("actAddCalendar")) { newEvent = EventDraft(title: t, start: start, end: end, location: loc, notes: notes) }
                    .buttonStyle(.lime)
            case .geo(let lat, let lon, let q):
                Button(tr("actMap")) {
                    var c = URLComponents(string: "https://maps.apple.com/")!
                    c.queryItems = [URLQueryItem(name: "ll", value: "\(lat),\(lon)"), URLQueryItem(name: "q", value: q.isEmpty ? "\(lat),\(lon)" : q)]
                    if let u = c.url { openURL(u) }
                }.buttonStyle(.lime)
                copyButton(tr("actCopy"), "\(lat), \(lon)")
            case .text(let t):
                Button(tr("actCopyText")) { copy(t) }.buttonStyle(.lime)
                HStack(spacing: 10) { search(t); share(t) }
            case .barcode(let n, _):
                search(n, prominent: true)
                HStack(spacing: 10) { copyButton(tr("actCopyNumber"), n); share(n) }
            }
        }
    }

    private func copyButton(_ label: String, _ value: String) -> some View {
        Button(label) { copy(value) }.buttonStyle(.plainField)
    }

    private func share(_ text: String) -> some View {
        ShareLink(item: text) { Text(tr("result.share")) }.buttonStyle(.plainField)
    }

    @ViewBuilder private func search(_ q: String, prominent: Bool = false) -> some View {
        let b = Button(tr("result.searchWeb")) {
            var c = URLComponents(string: "https://www.google.com/search")!
            c.queryItems = [URLQueryItem(name: "q", value: q)]
            if let u = c.url { openURL(u) }
        }
        if prominent { b.buttonStyle(.lime) } else { b.buttonStyle(.plainField) }
    }

    private func copy(_ s: String) {
        UIPasteboard.general.string = s
        copied = tr("actCopied")
        UIAccessibility.post(notification: .announcement, argument: tr("actCopied"))
        Task { try? await Task.sleep(for: .seconds(2)); copied = nil }
    }

    private func open(_ s: String) {
        if let u = URL(string: s) { openURL(u) }
    }
}

/// A contact to save (CNContact is Identifiable only in newer SDKs).
struct ContactItem: Identifiable {
    let id = UUID()
    let contact: CNContact
}

// MARK: - Save a contact / an event (system sheets; no permission prompt needed for these)

private struct ContactSaver: UIViewControllerRepresentable {
    let contact: CNContact
    @Environment(\.dismiss) private var dismiss

    func makeUIViewController(context: Context) -> UINavigationController {
        let vc = CNContactViewController(forNewContact: contact)
        vc.contactStore = CNContactStore()
        vc.delegate = context.coordinator
        return UINavigationController(rootViewController: vc)
    }
    func updateUIViewController(_ vc: UINavigationController, context: Context) {}
    func makeCoordinator() -> Coordinator { Coordinator { dismiss() } }

    final class Coordinator: NSObject, CNContactViewControllerDelegate {
        let done: () -> Void
        init(done: @escaping () -> Void) { self.done = done }
        func contactViewController(_ vc: CNContactViewController, didCompleteWith contact: CNContact?) { done() }
    }
}

struct EventDraft: Identifiable {
    let id = UUID()
    let title: String, start: Date?, end: Date?, location: String, notes: String
}

private struct EventSaver: UIViewControllerRepresentable {
    let draft: EventDraft
    @Environment(\.dismiss) private var dismiss

    func makeUIViewController(context: Context) -> EKEventEditViewController {
        let store = EKEventStore()
        let e = EKEvent(eventStore: store)
        e.title = draft.title
        e.startDate = draft.start ?? .now
        e.endDate = draft.end ?? e.startDate.addingTimeInterval(3600)
        e.location = draft.location.isEmpty ? nil : draft.location
        e.notes = draft.notes.isEmpty ? nil : draft.notes
        let vc = EKEventEditViewController()
        vc.eventStore = store
        vc.event = e
        vc.editViewDelegate = context.coordinator
        return vc
    }
    func updateUIViewController(_ vc: EKEventEditViewController, context: Context) {}
    func makeCoordinator() -> Coordinator { Coordinator { dismiss() } }

    final class Coordinator: NSObject, EKEventEditViewDelegate {
        let done: () -> Void
        init(done: @escaping () -> Void) { self.done = done }
        func eventEditViewController(_ c: EKEventEditViewController, didCompleteWith action: EKEventEditViewAction) { done() }
    }
}
