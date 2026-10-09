import SwiftUI

/// Content type chips, grouped like the site (Basics / Contact / Social).
struct TypePicker: View {
    @Binding var type: String

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            ForEach(ContentTypes.groups, id: \.id) { g in
                VStack(alignment: .leading, spacing: 6) {
                    Kicker(text: tr("group.\(g.id)"))
                    FlowRow(spacing: 8) {
                        ForEach(g.types, id: \.self) { t in
                            let on = t == type
                            Button { type = t } label: {
                                Label(tr("type.\(t)"), systemImage: ContentTypes.icon(t))
                                    .font(.system(size: 14, weight: .semibold))
                                    .padding(.horizontal, 12).frame(minHeight: 40)
                                    .foregroundStyle(on ? Theme.onStage : Theme.ink)
                                    .background(on ? Theme.stage : Theme.field, in: Capsule())
                                    .overlay(Capsule().stroke(on ? Theme.accent : Theme.line, lineWidth: 1))
                            }
                            .buttonStyle(.plain)
                            .accessibilityAddTraits(on ? [.isSelected] : [])
                            .accessibilityIdentifier("type-\(t)")
                        }
                    }
                }
            }
        }
    }
}

/// The fields of one content type (FIELDS in src/lib/qr/payload.ts), labels from `field.<name>`.
struct ContentFields: View {
    let type: String
    @Binding var fields: [String: String]

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            ForEach(ContentTypes.fields[type] ?? [], id: \.self) { name in
                if name == "password" && fields["security"] == "nopass" {
                    EmptyView()
                } else {
                    field(name)
                }
            }
        }
        .onAppear(perform: defaults)
        .onChange(of: type) { _, _ in defaults() }
    }

    private func defaults() {
        if type == "wifi", (fields["security"] ?? "").isEmpty { fields["security"] = "WPA" }
        if type == "event", (fields["start"] ?? "").isEmpty {
            fields["start"] = EventDate.string(Calendar.current.date(byAdding: .hour, value: 1, to: EventDate.roundedNow()) ?? Date())
        }
    }

    private func binding(_ name: String) -> Binding<String> {
        Binding(get: { fields[name] ?? "" }, set: { fields[name] = $0 })
    }

    @ViewBuilder private func field(_ name: String) -> some View {
        let label = tr("field.\(name)")
        switch name {
        case "security":
            VStack(alignment: .leading, spacing: 6) {
                FieldLabel(text: label)
                Picker(label, selection: binding(name)) {
                    ForEach(ContentTypes.wifiSecurity, id: \.self) { Text(tr("security.\($0)")).tag($0) }
                }
                .pickerStyle(.segmented)
            }
        case "start", "end":
            DateField(label: label, value: binding(name), optional: name == "end")
        case "text", "body", "notes", "message":
            VStack(alignment: .leading, spacing: 6) {
                FieldLabel(text: label)
                TextField(label, text: binding(name), axis: .vertical)
                    .lineLimit(name == "text" ? 4...10 : 2...6)
                    .textFieldStyle(BoxField())
                    .accessibilityIdentifier("field-\(name)")
            }
        default:
            VStack(alignment: .leading, spacing: 6) {
                FieldLabel(text: label)
                TextField(label, text: binding(name))
                    .textFieldStyle(BoxField())
                    .keyboardType(keyboard(name))
                    .textInputAutocapitalization(plain(name) ? .never : .sentences)
                    .autocorrectionDisabled(plain(name))
                    .textContentType(contentType(name))
                    .accessibilityIdentifier("field-\(name)")
            }
        }
    }

    private func plain(_ n: String) -> Bool { ["url", "email", "username", "ssid", "password", "website", "phone"].contains(n) }

    private func keyboard(_ n: String) -> UIKeyboardType {
        switch n {
        case "url", "website": .URL
        case "email": .emailAddress
        case "phone": .phonePad
        default: .default
        }
    }

    private func contentType(_ n: String) -> UITextContentType? {
        switch n {
        case "url", "website": .URL
        case "email": .emailAddress
        case "phone": .telephoneNumber
        case "firstName": .givenName
        case "lastName": .familyName
        case "company": .organizationName
        default: nil
        }
    }
}

/// "2026-10-10T18:30" (the site's datetime-local value) ⇄ Date, local time.
enum EventDate {
    static func formatter() -> DateFormatter {
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_US_POSIX")
        f.dateFormat = "yyyy-MM-dd'T'HH:mm"
        return f
    }
    static func string(_ d: Date) -> String { formatter().string(from: d) }
    static func date(_ s: String) -> Date? { formatter().date(from: s) }
    static func roundedNow() -> Date {
        let cal = Calendar.current
        var c = cal.dateComponents([.year, .month, .day, .hour], from: Date())
        c.minute = 0
        return cal.date(from: c) ?? Date()
    }
}

private struct DateField: View {
    let label: String
    @Binding var value: String
    let optional: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            if optional {
                Toggle(isOn: Binding(get: { !value.isEmpty }, set: { on in
                    value = on ? EventDate.string(Calendar.current.date(byAdding: .hour, value: 2, to: EventDate.roundedNow()) ?? Date()) : ""
                })) { FieldLabel(text: label) }
                .tint(Theme.accentInk)
            } else {
                FieldLabel(text: label)
            }
            if !value.isEmpty {
                DatePicker(label, selection: Binding(get: { EventDate.date(value) ?? Date() }, set: { value = EventDate.string($0) }))
                    .labelsHidden()
            }
        }
    }
}

struct FieldLabel: View {
    let text: String
    var body: some View {
        Text(text).font(.system(size: 13, weight: .semibold)).foregroundStyle(Theme.muted)
    }
}

/// Text field on the "field" surface with a hairline, like the site's inputs.
struct BoxField: TextFieldStyle {
    func _body(configuration: TextField<Self._Label>) -> some View {
        configuration
            .font(.system(size: 16))
            .padding(.horizontal, 14).padding(.vertical, 12)
            .background(Theme.field, in: RoundedRectangle(cornerRadius: 12))
            .overlay(RoundedRectangle(cornerRadius: 12).stroke(Theme.line))
            .foregroundStyle(Theme.ink)
    }
}

/// Wrapping row of chips.
struct FlowRow: Layout {
    var spacing: CGFloat = 8

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let width = proposal.width ?? .infinity
        var x: CGFloat = 0, y: CGFloat = 0, row: CGFloat = 0, widest: CGFloat = 0
        for v in subviews {
            let s = v.sizeThatFits(.unspecified)
            if x > 0 && x + s.width > width { y += row + spacing; x = 0; row = 0 }
            x += s.width + spacing
            row = max(row, s.height)
            widest = max(widest, x - spacing)
        }
        return CGSize(width: proposal.width ?? widest, height: y + row)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        var x = bounds.minX, y = bounds.minY, row: CGFloat = 0
        for v in subviews {
            let s = v.sizeThatFits(.unspecified)
            if x > bounds.minX && x + s.width > bounds.maxX { y += row + spacing; x = bounds.minX; row = 0 }
            v.place(at: CGPoint(x: x, y: y), proposal: ProposedViewSize(s))
            x += s.width + spacing
            row = max(row, s.height)
        }
    }
}
