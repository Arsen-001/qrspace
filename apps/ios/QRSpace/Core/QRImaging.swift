import CoreImage
import CoreImage.CIFilterBuiltins
import UIKit
import Vision

/// QR images drawn on the phone (CoreImage) — no network needed for "My codes" thumbnails.
enum QRRender {
    private static let context = CIContext()
    private static let cache = NSCache<NSString, UIImage>()

    static func image(_ text: String, fg: UIColor = .black, bg: UIColor = .white, scale: CGFloat = 12) -> UIImage? {
        let key = "\(text)|\(fg)|\(bg)|\(scale)" as NSString
        if let hit = cache.object(forKey: key) { return hit }
        let f = CIFilter.qrCodeGenerator()
        f.message = Data(text.utf8)
        f.correctionLevel = "M"
        guard let out = f.outputImage else { return nil }
        let colored = out.applyingFilter("CIFalseColor", parameters: [
            "inputColor0": CIColor(color: fg), "inputColor1": CIColor(color: bg),
        ]).transformed(by: CGAffineTransform(scaleX: scale, y: scale))
        guard let cg = context.createCGImage(colored, from: colored.extent) else { return nil }
        let img = UIImage(cgImage: cg)
        cache.setObject(img, forKey: key)
        return img
    }
}

/// Reads codes from a still image (photo picked from the library) with Vision.
enum ImageDecoder {
    struct Hit { let payload: String; let symbology: Symbology }

    static func decode(_ image: UIImage) async -> Hit? {
        guard let cg = image.cgImage ?? image.ciImage.flatMap({ CIContext().createCGImage($0, from: $0.extent) }) else { return nil }
        return await Task.detached(priority: .userInitiated) {
            let handler = VNImageRequestHandler(cgImage: cg, orientation: CGImagePropertyOrientation(image.imageOrientation))
            var req = VNDetectBarcodesRequest()
            if (try? handler.perform([req])) == nil || (req.results ?? []).isEmpty {
                // The newest revisions need the Neural Engine (missing in the Simulator) — retry with revision 1.
                req = VNDetectBarcodesRequest()
                req.revision = 1 // VNDetectBarcodesRequestRevision1 (deprecated name, still the one that runs on the CPU)
                try? handler.perform([req])
            }
            // Prefer 2D codes (a photo of a product can have both).
            let found = (req.results ?? []).compactMap { o -> Hit? in
                guard let s = o.payloadStringValue, !s.isEmpty else { return nil }
                let (sym, p) = Symbology.normalized(Symbology(vision: o.symbology), payload: s)
                return Hit(payload: p, symbology: sym)
            }
            if let hit = found.first(where: { $0.symbology.is2D }) ?? found.first { return hit }
            // Fallback for QR when Vision can't run (e.g. the Simulator without a Neural Engine).
            let det = CIDetector(ofType: CIDetectorTypeQRCode, context: nil, options: [CIDetectorAccuracy: CIDetectorAccuracyHigh])
            let feats = det?.features(in: CIImage(cgImage: cg)) as? [CIQRCodeFeature] ?? []
            return feats.compactMap(\.messageString).first.map { Hit(payload: $0, symbology: .qr) }
        }.value
    }
}

extension Symbology {
    init(vision s: VNBarcodeSymbology) {
        switch s {
        case .qr: self = .qr
        case .microQR: self = .microQR
        case .aztec: self = .aztec
        case .dataMatrix: self = .dataMatrix
        case .pdf417, .microPDF417: self = .pdf417
        case .ean13: self = .ean13
        case .ean8: self = .ean8
        case .upce: self = .upce
        case .code128: self = .code128
        case .code39, .code39Checksum, .code39FullASCII, .code39FullASCIIChecksum: self = .code39
        case .code93, .code93i: self = .code93
        case .itf14, .i2of5, .i2of5Checksum: self = .itf
        case .codabar: self = .codabar
        case .gs1DataBar, .gs1DataBarLimited, .gs1DataBarExpanded: self = .gs1
        default: self = .unknown
        }
    }
}

extension CGImagePropertyOrientation {
    init(_ o: UIImage.Orientation) {
        switch o {
        case .up: self = .up
        case .upMirrored: self = .upMirrored
        case .down: self = .down
        case .downMirrored: self = .downMirrored
        case .left: self = .left
        case .leftMirrored: self = .leftMirrored
        case .right: self = .right
        case .rightMirrored: self = .rightMirrored
        @unknown default: self = .up
        }
    }
}
