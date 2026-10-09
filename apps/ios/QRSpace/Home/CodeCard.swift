import SwiftUI

/// One of my codes on the home dashboard (src/components/HomeDashboard.tsx CodeCard): a dark card with its own
/// ON/OFF switch — off shows the code, on shows what's under it (what a person sees after scanning); scans big:
/// total, this week, and 30 thin day bars; "Edit" and "As others see it".
struct CodeCard: View {
    let code: CodeView
    let base: String
    let onEdit: () -> Void
    let onGuest: () -> Void
    @State private var open = false

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            header
            HStack(alignment: .center, spacing: 12) {
                VStack(spacing: 6) {
                    Text(tr("dashUnderShort").uppercased())
                        .font(Theme.mono(9, weight: .bold)).tracking(0.6)
                        .foregroundStyle(open ? Theme.accent : Theme.onStage.opacity(0.5))
                        .multilineTextAlignment(.center)
                        .frame(width: 52)
                        .accessibilityHidden(true)
                    FlipSwitch(on: $open, label: "\(tr("heroSwitch")): \(code.title ?? "")")
                    Text("QR").font(Theme.mono(9, weight: .bold)).tracking(1)
                        .foregroundStyle(open ? Theme.onStage.opacity(0.5) : Theme.onStage)
                        .accessibilityHidden(true)
                }
                GeometryReader { geo in
                    let side = geo.size.width
                    ZStack {
                        UnderCode(code: code)
                            .frame(width: side, height: side)
                            .accessibilityHidden(!open)
                        CodeImage(code: code, base: base, size: side, corner: 16)
                            .opacity(code.blocked == true ? 0.4 : 1)
                            .clipShape(TopReveal(hidden: open ? 1 : 0))
                            .accessibilityHidden(open)
                            .accessibilityLabel(tr("codes.qrLabel", ["t": code.title ?? ""]))
                    }
                    .background(Color.white.opacity(0.03), in: RoundedRectangle(cornerRadius: 16))
                    .overlay(RoundedRectangle(cornerRadius: 16).stroke(Theme.stageLine))
                }
                .aspectRatio(1, contentMode: .fit)
            }
            .padding(.top, 14)

            scans.padding(.top, 14)

            HStack(spacing: 8) {
                Button(action: onEdit) {
                    Text(tr("edit")).font(.system(size: 15, weight: .heavy).width(.expanded))
                        .frame(maxWidth: .infinity, minHeight: 44)
                        .foregroundStyle(Theme.onAccent)
                        .background(Theme.accent, in: RoundedRectangle(cornerRadius: 12))
                }
                .accessibilityLabel("\(tr("edit")): \(code.title ?? "")")
                Button(action: onGuest) {
                    Text(tr("dashAsGuest")).font(.system(size: 14, weight: .semibold))
                        .frame(maxWidth: .infinity, minHeight: 44)
                        .foregroundStyle(Theme.onStage)
                        .overlay(RoundedRectangle(cornerRadius: 12).stroke(Theme.stageLine))
                }
                .accessibilityLabel("\(tr("dashAsGuest")): \(code.title ?? "")")
                .accessibilityIdentifier("card-guest")
            }
            .buttonStyle(.plain)
            .padding(.top, 14)
        }
        .padding(16)
        .background(Theme.stage, in: RoundedRectangle(cornerRadius: 24))
        .overlay(RoundedRectangle(cornerRadius: 24).stroke(Theme.stageLine))
        .shadow(color: .black.opacity(0.25), radius: 18, y: 12)
        .animation(.timingCurve(0.65, 0, 0.35, 1, duration: 0.7), value: open)
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(alignment: .top, spacing: 10) {
                Button(action: onEdit) {
                    Text(code.title ?? tr("codes.untitled"))
                        .font(.system(size: 19, weight: .heavy).width(.expanded))
                        .foregroundStyle(Theme.onStage)
                        .lineLimit(2)
                        .multilineTextAlignment(.leading)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
                .buttonStyle(.plain)
                .accessibilityAddTraits(.isHeader)
                if code.unread > 0 {
                    Text("\(code.unread)").font(.system(size: 12, weight: .bold))
                        .frame(minWidth: 24, minHeight: 24).padding(.horizontal, 4)
                        .foregroundStyle(.white)
                        .background(Theme.warn, in: Capsule())
                        .accessibilityLabel(tr("account.unread") + ": \(code.unread)")
                }
            }
            HStack(spacing: 6) {
                if let v = code.visibility { Chip(text: tr("vis.\(v)")) }
                if let c = code.content { Chip(text: tr("type.\(c.type)")) } else { Chip(text: kindName(code.kind)) }
                if code.lost == true { Chip(text: tr("lostMode"), lime: true) }
            }
        }
    }

    private var scans: some View {
        let total = code.stats?.total ?? 0
        let week = code.stats?.week ?? 0
        return HStack(alignment: .bottom, spacing: 12) {
            VStack(alignment: .leading, spacing: 4) {
                HStack(alignment: .firstTextBaseline, spacing: 6) {
                    Text("\(total)").font(Theme.heading(34)).foregroundStyle(Theme.onStage)
                    Text(tr("scansCount").lowercased()).font(.system(size: 14)).foregroundStyle(Theme.onStage.opacity(0.7))
                }
                Text(tr("dashWeek", ["n": "\(week)"]))
                    .font(.system(size: 12, weight: week > 0 ? .bold : .regular))
                    .foregroundStyle(week > 0 ? Theme.accent : Theme.onStage.opacity(0.5))
            }
            .accessibilityElement(children: .combine)
            Spacer(minLength: 0)
            if let days = code.stats?.days { Spark(days: days) }
        }
    }
}

/// What a person sees after scanning, in short: the content (type and main value) or the memory
/// (records, photos, first text).
struct UnderCode: View {
    let code: CodeView

    var body: some View {
        Group {
            if let c = code.content {
                VStack(alignment: .leading, spacing: 12) {
                    HStack(spacing: 8) {
                        Image(systemName: ContentTypes.icon(c.type)).font(.system(size: 16, weight: .bold))
                            .frame(width: 36, height: 36)
                            .foregroundStyle(Theme.onAccent)
                            .background(Theme.accent, in: RoundedRectangle(cornerRadius: 10))
                        Text(tr("type.\(c.type)").uppercased()).font(Theme.mono(10, weight: .bold)).tracking(1.2)
                            .foregroundStyle(Theme.onStage.opacity(0.6))
                    }
                    Text(c.mainValue.isEmpty ? tr("notSetUp") : c.mainValue)
                        .font(.system(size: 18, weight: .heavy).width(.expanded))
                        .foregroundStyle(Theme.onStage)
                        .lineLimit(4).minimumScaleFactor(0.7)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
                .padding(14)
            } else {
                memory
            }
        }
        .accessibilityElement(children: .combine)
    }

    @ViewBuilder private var memory: some View {
        let blocks = code.blocks ?? []
        let photos = blocks.filter { $0.kind == "photo" && $0.media != nil }.prefix(3)
        let text = blocks.first { $0.kind == "text" && !$0.text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }?.text
        if blocks.isEmpty {
            VStack(spacing: 6) {
                Text(code.kind == "link" ? tr("notSetUp") : tr("dashEmptyMemory"))
                    .font(.system(size: 16, weight: .heavy).width(.expanded)).foregroundStyle(Theme.onStage)
                Text(tr("dashEmptyMemoryHint")).font(.system(size: 12)).foregroundStyle(Theme.onStage.opacity(0.6))
            }
            .multilineTextAlignment(.center)
            .padding(14)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        } else {
            VStack(alignment: .leading, spacing: 10) {
                Label("\(tr("records")): \(blocks.count)", systemImage: "square.stack.fill")
                    .font(Theme.mono(10, weight: .bold)).tracking(1)
                    .foregroundStyle(Theme.onStage.opacity(0.6))
                if !photos.isEmpty {
                    HStack(spacing: 6) {
                        ForEach(Array(photos)) { b in AuthedThumb(url: API.shared.mediaURL(b.media!)) }
                        ForEach(0..<(3 - photos.count), id: \.self) { _ in Color.clear.aspectRatio(1, contentMode: .fit) }
                    }
                }
                if let text {
                    Text(text).font(.system(size: 14)).foregroundStyle(Theme.onStage.opacity(0.85)).lineLimit(photos.isEmpty ? 6 : 3)
                }
                Spacer(minLength: 0)
            }
            .padding(14)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        }
    }
}

/// The code slides away upward (a clip from the bottom edge), revealing what's under it.
struct TopReveal: Shape {
    var hidden: CGFloat
    var animatableData: CGFloat {
        get { hidden }
        set { hidden = newValue }
    }
    func path(in r: CGRect) -> Path {
        Path(CGRect(x: r.minX, y: r.minY, width: r.width, height: r.height * (1 - hidden)))
    }
}

/// Small vertical switch with ON / OFF on the knob — like the big one on the site's first screen.
struct FlipSwitch: View {
    @Binding var on: Bool
    let label: String

    var body: some View {
        Button { on.toggle() } label: {
            ZStack(alignment: .top) {
                Capsule().fill(on ? Theme.accent.opacity(0.2) : Color.white.opacity(0.05))
                Capsule().stroke(on ? Theme.accent : Theme.stageLine, lineWidth: 1)
                Text(on ? "ON" : "OFF")
                    .font(Theme.mono(9, weight: .bold))
                    .foregroundStyle(on ? Theme.onAccent : Theme.stage)
                    .frame(width: 32, height: 32)
                    .background(on ? Theme.accent : Theme.onStage, in: Circle())
                    .shadow(color: .black.opacity(0.35), radius: 6, y: 3)
                    .offset(y: on ? 4 : 128 - 36)
            }
            .frame(width: 40, height: 128)
            .contentShape(Capsule())
        }
        .buttonStyle(.plain)
        .sensoryFeedback(.selection, trigger: on)
        .accessibilityLabel(label)
        .accessibilityValue(on ? "ON" : "OFF")
        .accessibilityAddTraits(.isToggle)
        .accessibilityIdentifier("flip-switch")
    }
}

/// Scans per day for the last 30 days — thin bars.
struct Spark: View {
    let days: [Int]
    var body: some View {
        let last = Array(days.suffix(30))
        let top = max(1, last.max() ?? 1)
        HStack(alignment: .bottom, spacing: 2) {
            ForEach(Array(last.enumerated()), id: \.offset) { _, d in
                RoundedRectangle(cornerRadius: 1)
                    .fill(d > 0 ? Theme.accent : Color.white.opacity(0.15))
                    .frame(width: 3, height: max(3, CGFloat(d) / CGFloat(top) * 26))
            }
        }
        .frame(height: 26, alignment: .bottom)
        .accessibilityElement()
        .accessibilityLabel(tr("statsChart"))
        .accessibilityValue(last.map(String.init).joined(separator: ", "))
    }
}
