// Draws the app icon (1024×1024 PNG): black stage, lime QR finder eyes, module dots.
// No alpha channel — App Store Connect rejects an app icon with one (the stage fills every pixel anyway).
// Run: swift scripts/make-icon.swift QRSpace/Resources/Assets.xcassets/AppIcon.appiconset/icon-1024.png
import AppKit
import ImageIO
import UniformTypeIdentifiers

let size = 1024
let out = CommandLine.arguments.dropFirst().first ?? "icon-1024.png"
let cg = CGContext(data: nil, width: size, height: size, bitsPerComponent: 8, bytesPerRow: 0,
                   space: CGColorSpace(name: CGColorSpace.sRGB)!, bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue)!
NSGraphicsContext.saveGraphicsState()
NSGraphicsContext.current = NSGraphicsContext(cgContext: cg, flipped: false)
let stage = NSColor(srgbRed: 0x0B / 255, green: 0x0B / 255, blue: 0x0C / 255, alpha: 1)
let lime = NSColor(srgbRed: 0xC6 / 255, green: 1, blue: 0x2E / 255, alpha: 1)
let dim = NSColor(srgbRed: 0xF3 / 255, green: 0xF2 / 255, blue: 0xEC / 255, alpha: 0.16)
stage.setFill()
NSRect(x: 0, y: 0, width: size, height: size).fill()

let o: CGFloat = 160         // outer margin
let g = (CGFloat(size) - 2 * o) / 11   // module of an 11×11 grid inside the margins
func eye2(_ cx: Int, _ cy: Int) {
    let x = o + CGFloat(cx) * g, y = o + CGFloat(cy) * g
    lime.setFill()
    NSBezierPath(roundedRect: NSRect(x: x, y: y, width: 4 * g, height: 4 * g), xRadius: 1.2 * g, yRadius: 1.2 * g).fill()
    stage.setFill()
    NSBezierPath(roundedRect: NSRect(x: x + 0.7 * g, y: y + 0.7 * g, width: 2.6 * g, height: 2.6 * g), xRadius: 0.8 * g, yRadius: 0.8 * g).fill()
    lime.setFill()
    NSBezierPath(roundedRect: NSRect(x: x + 1.3 * g, y: y + 1.3 * g, width: 1.4 * g, height: 1.4 * g), xRadius: 0.45 * g, yRadius: 0.45 * g).fill()
}
eye2(0, 7); eye2(7, 7); eye2(0, 0)
// Module dots in the free area; a few lit in lime — "space" under the code.
let lit: Set<String> = ["8,1", "9,2", "10,0", "6,4", "8,4", "10,3", "5,9", "5,7", "9,5"]
for cy in 0..<11 { for cx in 0..<11 {
    let inEye = (cx < 4 && cy < 4) || (cx < 4 && cy >= 7) || (cx >= 7 && cy >= 7)
    let gap = (cx == 4 && (cy < 4 || cy >= 7)) || (cy == 4 && (cx < 4)) || (cy == 6 && (cx < 4 || cx >= 7)) || (cx == 6 && cy >= 7)
    if inEye || gap { continue }
    let on = lit.contains("\(cx),\(cy)")
    (on ? lime : dim).setFill()
    let r: CGFloat = on ? 0.42 * g : 0.22 * g
    let c = NSPoint(x: o + (CGFloat(cx) + 0.5) * g, y: o + (CGFloat(cy) + 0.5) * g)
    NSBezierPath(ovalIn: NSRect(x: c.x - r, y: c.y - r, width: 2 * r, height: 2 * r)).fill()
}}
NSGraphicsContext.restoreGraphicsState()
let dest = CGImageDestinationCreateWithURL(URL(fileURLWithPath: out) as CFURL, UTType.png.identifier as CFString, 1, nil)!
CGImageDestinationAddImage(dest, cg.makeImage()!, nil)
precondition(CGImageDestinationFinalize(dest), "couldn't write \(out)")
print("wrote \(out)")
