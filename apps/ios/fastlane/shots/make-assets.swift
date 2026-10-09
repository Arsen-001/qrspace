// Pictures for the App Store screenshots (the Simulator has no camera and no photos):
//   still.png — what the camera "sees": a Wi‑Fi QR code on a card, on a dark table (also decoded for the result);
//   photo.jpg — an illustration for a memory entry (Ararat at sunset), uploaded under a temporary demo code.
// Run: swift fastlane/shots/make-assets.swift .testdata   (from apps/ios; .testdata is gitignored)
import AppKit
import CoreImage
import CoreImage.CIFilterBuiltins
import ImageIO
import UniformTypeIdentifiers

let outDir = URL(fileURLWithPath: CommandLine.arguments.dropFirst().first ?? ".testdata", isDirectory: true)
try? FileManager.default.createDirectory(at: outDir, withIntermediateDirectories: true)
let srgb = CGColorSpace(name: CGColorSpace.sRGB)!

func context(_ w: Int, _ h: Int) -> CGContext {
    CGContext(data: nil, width: w, height: h, bitsPerComponent: 8, bytesPerRow: 0, space: srgb,
              bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue)!
}

func save(_ cg: CGContext, _ name: String, _ type: UTType, quality: Double = 0.9) {
    let url = outDir.appendingPathComponent(name)
    let dest = CGImageDestinationCreateWithURL(url as CFURL, type.identifier as CFString, 1, nil)!
    CGImageDestinationAddImage(dest, cg.makeImage()!, [kCGImageDestinationLossyCompressionQuality: quality] as CFDictionary)
    precondition(CGImageDestinationFinalize(dest))
    print("wrote \(url.path)")
}

func color(_ hex: UInt32, _ a: CGFloat = 1) -> CGColor {
    CGColor(srgbRed: CGFloat((hex >> 16) & 0xFF) / 255, green: CGFloat((hex >> 8) & 0xFF) / 255, blue: CGFloat(hex & 0xFF) / 255, alpha: a)
}

func blob(_ c: CGContext, x: CGFloat, y: CGFloat, r: CGFloat, _ col: UInt32, _ a: CGFloat) {
    let g = CGGradient(colorsSpace: srgb, colors: [color(col, a), color(col, 0)] as CFArray, locations: [0, 1])!
    c.drawRadialGradient(g, startCenter: CGPoint(x: x, y: y), startRadius: 0, endCenter: CGPoint(x: x, y: y), endRadius: r, options: [])
}

// MARK: still.png — 1320×2868 (iPhone Pro Max), aspect-filled by the app; the card sits where the viewfinder is.

do {
    let w = 1320, h = 2868
    let c = context(w, h)
    c.setFillColor(color(0x15140F)); c.fill(CGRect(x: 0, y: 0, width: w, height: h))
    // A dim wooden table with warm café light.
    blob(c, x: 260, y: 2300, r: 900, 0x6B4A2B, 0.55)
    blob(c, x: 1150, y: 700, r: 1000, 0x3A2A1C, 0.7)
    blob(c, x: 1000, y: 2500, r: 500, 0xC6FF2E, 0.10)
    blob(c, x: 200, y: 500, r: 420, 0xF4B860, 0.16)
    // The card: the viewfinder is a square of 68% width centred 20 pt (60 px) above the middle (CG y is up).
    let side: CGFloat = CGFloat(w) * 0.56
    let cx = CGFloat(w) / 2, cy = CGFloat(h) / 2 + 60
    let card = CGRect(x: cx - side / 2, y: cy - side / 2, width: side, height: side)
    c.saveGState()
    c.setShadow(offset: CGSize(width: 0, height: -24), blur: 60, color: color(0x000000, 0.6))
    c.setFillColor(color(0xFBF8F1))
    c.addPath(CGPath(roundedRect: card, cornerWidth: 44, cornerHeight: 44, transform: nil)); c.fillPath()
    c.restoreGState()
    let qr = CIFilter.qrCodeGenerator()
    qr.message = Data("WIFI:T:WPA;S:Ararat Cafe;P:apricot-2026;;".utf8)
    qr.correctionLevel = "M"
    let ci = qr.outputImage!
    let qrImage = CIContext().createCGImage(ci, from: ci.extent)!
    c.interpolationQuality = .none
    c.draw(qrImage, in: card.insetBy(dx: side * 0.1, dy: side * 0.1))
    save(c, "still.png", .png)
}

// MARK: photo.jpg — 1600×1200 illustration: Ararat (Masis and Sis) at sunset over the valley.

do {
    let w = 1600, h = 1200
    let c = context(w, h)
    let sky = CGGradient(colorsSpace: srgb, colors: [color(0x2B2D6E), color(0xC0507A), color(0xF59E5B), color(0xFCD58A)] as CFArray,
                         locations: [0, 0.45, 0.78, 1])!
    c.drawLinearGradient(sky, start: CGPoint(x: 0, y: CGFloat(h)), end: CGPoint(x: 0, y: CGFloat(h) * 0.35), options: [.drawsAfterEndLocation, .drawsBeforeStartLocation])
    blob(c, x: 1180, y: 520, r: 260, 0xFFF1C1, 0.9) // the sun behind the mountain
    func mountain(_ pts: [(CGFloat, CGFloat)], _ col: CGColor) {
        c.beginPath(); c.move(to: CGPoint(x: 0, y: 0))
        for (x, y) in pts { c.addLine(to: CGPoint(x: x, y: y)) }
        c.addLine(to: CGPoint(x: CGFloat(w), y: 0)); c.closePath(); c.setFillColor(col); c.fillPath()
    }
    // Masis (big) and Sis (small), purple in the haze, with snow caps.
    mountain([(0, 330), (260, 380), (560, 520), (820, 860), (900, 905), (980, 860), (1180, 640), (1260, 600), (1330, 650), (1600, 470)], color(0x5B4A86))
    c.beginPath()
    c.move(to: CGPoint(x: 735, y: 760)); c.addLine(to: CGPoint(x: 820, y: 860)); c.addLine(to: CGPoint(x: 900, y: 905))
    c.addLine(to: CGPoint(x: 980, y: 860)); c.addLine(to: CGPoint(x: 1060, y: 770)); c.addLine(to: CGPoint(x: 1000, y: 790))
    c.addLine(to: CGPoint(x: 950, y: 760)); c.addLine(to: CGPoint(x: 900, y: 800)); c.addLine(to: CGPoint(x: 840, y: 765))
    c.addLine(to: CGPoint(x: 790, y: 790)); c.closePath(); c.setFillColor(color(0xF4EEF8)); c.fillPath()
    c.beginPath()
    c.move(to: CGPoint(x: 1215, y: 615)); c.addLine(to: CGPoint(x: 1260, y: 600)); c.addLine(to: CGPoint(x: 1300, y: 625))
    c.addLine(to: CGPoint(x: 1270, y: 618)); c.addLine(to: CGPoint(x: 1245, y: 628)); c.closePath(); c.fillPath()
    // Valley hills and apricot trees.
    mountain([(0, 300), (300, 360), (700, 290), (1100, 340), (1600, 260)], color(0x2E3B2A))
    mountain([(0, 180), (420, 230), (900, 170), (1300, 215), (1600, 160)], color(0x1E2A1C))
    for (x, y, r) in [(180.0, 250.0, 46.0), (260, 240, 38), (1240, 230, 50), (1330, 222, 40), (640, 210, 36)] {
        c.setFillColor(color(0x223219)); c.fillEllipse(in: CGRect(x: x - r, y: y - r * 0.4, width: r * 2, height: r * 1.6))
        c.setFillColor(color(0xF59E5B, 0.85))
        for k in 0..<5 { c.fillEllipse(in: CGRect(x: x - r * 0.6 + Double(k) * r * 0.3, y: y + Double(k % 2) * r * 0.4, width: 9, height: 9)) }
    }
    save(c, "photo.jpg", .jpeg, quality: 0.86)
}
