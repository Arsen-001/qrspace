import SwiftUI

/// "How it looks": ready styles, color pairs, own colors, dot and corner shapes (the site's StylePanel, the parts
/// that make sense on a phone). Previews come from the server, so they match what will be saved.
struct StylePicker: View {
    @Binding var style: QRStyle

    var body: some View {
        VStack(alignment: .leading, spacing: 20) {
            VStack(alignment: .leading, spacing: 8) {
                Kicker(text: tr("styleReady"))
                Text(tr("styleReadyHint")).font(.system(size: 13)).foregroundStyle(Theme.muted)
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 10) {
                        ForEach(QRStyle.presets) { p in
                            let on = style.matches(p)
                            Button { style = style.applying(p) } label: {
                                VStack(spacing: 6) {
                                    StylePreview(style: p.style, size: 78, debounce: .zero)
                                        .overlay(RoundedRectangle(cornerRadius: 6).stroke(on ? Theme.accent : Theme.line, lineWidth: on ? 3 : 1))
                                    Text(tr("preset.\(p.id)")).font(.system(size: 12, weight: .semibold))
                                        .foregroundStyle(on ? Theme.ink : Theme.muted).lineLimit(1)
                                }
                                .frame(width: 84)
                            }
                            .buttonStyle(.plain)
                            .accessibilityLabel(tr("preset.\(p.id)"))
                            .accessibilityAddTraits(on ? [.isSelected] : [])
                            .accessibilityIdentifier("preset-\(p.id)")
                        }
                    }
                    .padding(.vertical, 2)
                }
            }

            VStack(alignment: .leading, spacing: 8) {
                Kicker(text: tr("presets"))
                FlowRow(spacing: 10) {
                    ForEach(Array(QRStyle.colorPairs.enumerated()), id: \.offset) { _, pair in
                        let on = style.fg == pair.fg && style.bg == pair.bg
                        Button { style.setPair(fg: pair.fg, bg: pair.bg) } label: {
                            ZStack {
                                Circle().fill(Color(UIColor(css: pair.bg) ?? .white))
                                Circle().fill(Color(UIColor(css: pair.fg) ?? .black)).padding(10)
                            }
                            .frame(width: 40, height: 40)
                            .overlay(Circle().stroke(on ? Theme.accentInk : Theme.line, lineWidth: on ? 3 : 1))
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel("\(pair.fg) / \(pair.bg)")
                        .accessibilityAddTraits(on ? [.isSelected] : [])
                    }
                }
            }

            VStack(alignment: .leading, spacing: 10) {
                HStack {
                    Kicker(text: tr("colors"))
                    Spacer()
                    Button { style.setPair(fg: style.bg, bg: style.fg) } label: {
                        Label(tr("swap"), systemImage: "arrow.left.arrow.right").font(.system(size: 12, weight: .bold))
                            .padding(.horizontal, 12).frame(minHeight: 34)
                            .background(Theme.card, in: Capsule()).overlay(Capsule().stroke(Theme.line))
                    }
                    .buttonStyle(.plain)
                    .foregroundStyle(Theme.ink)
                }
                LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 10) {
                    ColorWell(label: tr("fg"), hex: style.fg) { style.setFg($0) }
                    ColorWell(label: tr("bg"), hex: style.bg) { style.bg = $0 }
                    ColorWell(label: tr("eyeColor"), hex: style.eyeColor) { v in
                        if style.eyeBallColor == style.eyeColor { style.eyeBallColor = v }
                        style.eyeColor = v
                    }
                    ColorWell(label: tr("eyeBallColor"), hex: style.eyeBallColor) { style.eyeBallColor = $0 }
                }
                if style.contrast < 2.5 {
                    Label(tr("lowContrast"), systemImage: "exclamationmark.triangle.fill")
                        .font(.system(size: 13, weight: .medium)).foregroundStyle(Theme.warn)
                        .padding(10).frame(maxWidth: .infinity, alignment: .leading)
                        .background(Theme.warn.opacity(0.1), in: RoundedRectangle(cornerRadius: 10))
                }
            }

            ShapeGrid(title: tr("dots"), options: QRStyle.dots, value: style.dot, name: { tr("dot.\($0)") },
                      icon: dotIcon) { style.dot = $0 }
            ShapeGrid(title: tr("eyes"), options: QRStyle.eyes, value: style.eye, name: { tr("eye.\($0)") },
                      icon: eyeIcon) { style.eye = $0 }
        }
    }

    private func dotIcon(_ id: String) -> String {
        switch id {
        case "square": "square.grid.3x3.fill"
        case "rounded": "square.grid.2x2.fill"
        case "dots": "circle.grid.3x3.fill"
        case "diamond": "diamond.fill"
        case "star": "star.fill"
        case "heart": "heart.fill"
        case "plus": "plus"
        case "liquid": "drop.fill"
        case "leaf": "leaf.fill"
        case "circuit": "cpu"
        default: "square"
        }
    }

    private func eyeIcon(_ id: String) -> String {
        switch id {
        case "square": "square"
        case "rounded": "app"
        case "circle": "circle"
        case "leaf": "leaf"
        case "drop", "dropOut": "drop"
        case "octagon": "octagon"
        case "mixed": "circle.square"
        case "dotted": "circle.dotted"
        case "chip": "cpu"
        case "ornate": "seal"
        default: "square"
        }
    }
}

/// A color with the system picker; "#rrggbb" in and out.
private struct ColorWell: View {
    let label: String
    let hex: String
    let set: (String) -> Void

    var body: some View {
        ColorPicker(selection: Binding(get: { Color(UIColor(css: hex) ?? .black) }, set: { set($0.hex) }), supportsOpacity: false) {
            VStack(alignment: .leading, spacing: 2) {
                Text(label).font(.system(size: 13, weight: .semibold)).foregroundStyle(Theme.ink)
                Text(hex.uppercased()).font(Theme.mono(11)).foregroundStyle(Theme.muted)
            }
        }
        .padding(.horizontal, 12).padding(.vertical, 8)
        .background(Theme.field, in: RoundedRectangle(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(Theme.line))
    }
}

private struct ShapeGrid: View {
    let title: String
    let options: [String]
    let value: String
    let name: (String) -> String
    let icon: (String) -> String
    let pick: (String) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Kicker(text: title)
            LazyVGrid(columns: [GridItem(.adaptive(minimum: 84), spacing: 8)], spacing: 8) {
                ForEach(options, id: \.self) { id in
                    let on = id == value
                    Button { pick(id) } label: {
                        VStack(spacing: 6) {
                            Image(systemName: icon(id)).font(.system(size: 20, weight: .bold))
                                .foregroundStyle(on ? Theme.accent : Theme.ink)
                            Text(name(id)).font(.system(size: 11, weight: .semibold)).lineLimit(1).minimumScaleFactor(0.7)
                                .foregroundStyle(on ? Theme.onStage : Theme.ink)
                        }
                        .frame(maxWidth: .infinity, minHeight: 64)
                        .background(on ? Theme.stage : Theme.card, in: RoundedRectangle(cornerRadius: 14))
                        .overlay(RoundedRectangle(cornerRadius: 14).stroke(on ? Theme.accent.opacity(0.7) : Theme.line))
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel(name(id))
                    .accessibilityAddTraits(on ? [.isSelected] : [])
                }
            }
        }
    }
}

extension Color {
    /// "#rrggbb" (sRGB).
    var hex: String {
        let c = UIColor(self)
        var r: CGFloat = 0, g: CGFloat = 0, b: CGFloat = 0, a: CGFloat = 0
        c.getRed(&r, green: &g, blue: &b, alpha: &a)
        let v = { (x: CGFloat) in Int((min(max(x, 0), 1) * 255).rounded()) }
        return String(format: "#%02x%02x%02x", v(r), v(g), v(b))
    }
}
