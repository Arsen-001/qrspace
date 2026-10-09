import SwiftUI
import UIKit

/// Site palette (src/app/globals.css): concrete, ink and acid lime; light and dark.
/// Lime is a fill for buttons and selection — as text on a light background use `accentInk`.
enum Theme {
    static let bg = dynamic(light: 0xEDEBE4, dark: 0x0B0B0C)
    static let card = dynamic(light: 0xF9F8F4, dark: 0x141416)
    static let field = dynamic(light: 0xF2F0E9, dark: 0x1B1B1E)
    static let line = dynamic(light: 0xD8D5CA, dark: 0x2B2B30)
    static let ink = dynamic(light: 0x0B0B0C, dark: 0xF3F2EC)
    static let muted = dynamic(light: 0x5D5B55, dark: 0x9C9A92)
    static let accent = Color(hex: 0xC6FF2E)
    static let onAccent = Color(hex: 0x0B0B0C)
    static let accentInk = dynamic(light: 0x0B0B0C, dark: 0xC6FF2E)
    static let ok = dynamic(light: 0x15803D, dark: 0x22C55E)
    static let warn = dynamic(light: 0xC2410C, dark: 0xFB923C)
    /// Black "stage": scanner, big code, hero blocks.
    static let stage = dynamic(light: 0x0B0B0C, dark: 0x141416)
    static let onStage = Color(hex: 0xF3F2EC)
    static let stageLine = dynamic(light: 0x2A2A2E, dark: 0x2B2B30)

    /// Wide heavy headings — the closest system match to the site's Unbounded.
    static func heading(_ size: CGFloat) -> Font {
        .system(size: size, weight: .black).width(.expanded)
    }
    static func mono(_ size: CGFloat, weight: Font.Weight = .medium) -> Font {
        .system(size: size, weight: weight, design: .monospaced)
    }

    private static func dynamic(light: UInt32, dark: UInt32) -> Color {
        Color(UIColor { $0.userInterfaceStyle == .dark ? UIColor(hex: dark) : UIColor(hex: light) })
    }
}

extension UIColor {
    convenience init(hex: UInt32, alpha: CGFloat = 1) {
        self.init(red: CGFloat((hex >> 16) & 0xFF) / 255, green: CGFloat((hex >> 8) & 0xFF) / 255,
                  blue: CGFloat(hex & 0xFF) / 255, alpha: alpha)
    }
    /// "#1b2a4a" → color (style colors from the server).
    convenience init?(css: String?) {
        guard var s = css?.trimmingCharacters(in: .whitespaces), s.hasPrefix("#") else { return nil }
        s.removeFirst()
        if s.count == 3 { s = s.map { "\($0)\($0)" }.joined() }
        guard s.count == 6, let v = UInt32(s, radix: 16) else { return nil }
        self.init(hex: v)
    }
}

extension Color {
    init(hex: UInt32) { self.init(UIColor(hex: hex)) }
}

/// Small uppercase label above a heading ("kicker").
struct Kicker: View {
    let text: String
    var color: Color = Theme.muted
    var body: some View {
        Text(text.uppercased())
            .font(.system(size: 11, weight: .bold).width(.expanded))
            .tracking(1.2)
            .foregroundStyle(color)
    }
}

/// Main button: lime fill, black text, square-ish corners like the site.
struct LimeButtonStyle: ButtonStyle {
    var prominent = true
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.system(size: 16, weight: .bold))
            .frame(maxWidth: .infinity, minHeight: 50)
            .padding(.horizontal, 14)
            .foregroundStyle(prominent ? Theme.onAccent : Theme.ink)
            .background(prominent ? Theme.accent : Theme.field, in: RoundedRectangle(cornerRadius: 6))
            .overlay(RoundedRectangle(cornerRadius: 6).stroke(prominent ? .clear : Theme.line, lineWidth: 1))
            .opacity(configuration.isPressed ? 0.75 : 1)
            .scaleEffect(configuration.isPressed ? 0.98 : 1)
    }
}

extension ButtonStyle where Self == LimeButtonStyle {
    static var lime: LimeButtonStyle { LimeButtonStyle() }
    static var plainField: LimeButtonStyle { LimeButtonStyle(prominent: false) }
}

/// Card surface.
struct CardBox<Content: View>: View {
    @ViewBuilder var content: Content
    var body: some View {
        VStack(alignment: .leading, spacing: 10) { content }
            .padding(16)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Theme.card, in: RoundedRectangle(cornerRadius: 10))
            .overlay(RoundedRectangle(cornerRadius: 10).stroke(Theme.line, lineWidth: 1))
    }
}

/// QR-module dot grid of the site background.
struct DotGrid: View {
    var color: Color = Theme.ink.opacity(0.1)
    var body: some View {
        Canvas { ctx, size in
            let step: CGFloat = 22
            var y: CGFloat = step / 2
            while y < size.height {
                var x: CGFloat = step / 2
                while x < size.width {
                    ctx.fill(Path(ellipseIn: CGRect(x: x - 1, y: y - 1, width: 2, height: 2)), with: .color(color))
                    x += step
                }
                y += step
            }
        }
        .allowsHitTesting(false)
        .accessibilityHidden(true)
    }
}

/// Screen background: concrete with dots.
struct ScreenBackground: View {
    var body: some View {
        ZStack { Theme.bg; DotGrid() }.ignoresSafeArea()
    }
}

/// Big heavy screen title.
struct ScreenTitle: View {
    let text: String
    var kicker: String? = nil
    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            if let kicker { Kicker(text: kicker) }
            Text(text)
                .font(Theme.heading(30))
                .foregroundStyle(Theme.ink)
                .minimumScaleFactor(0.6)
                .lineLimit(2)
                .accessibilityAddTraits(.isHeader)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}
