import AVFoundation
import SwiftUI
import VisionKit
import Vision

/// Symbologies we look for: QR and the common 1D/2D barcodes.
enum ScanKinds {
    static let vision: [VNBarcodeSymbology] = [
        .qr, .microQR, .aztec, .dataMatrix, .pdf417, .microPDF417,
        .ean13, .ean8, .upce, .code128, .code39, .code39Checksum, .code39FullASCII, .code93, .code93i,
        .itf14, .i2of5, .codabar, .gs1DataBar, .gs1DataBarExpanded, .gs1DataBarLimited,
    ]
    static let metadata: [AVMetadataObject.ObjectType] = [
        .qr, .aztec, .dataMatrix, .pdf417, .ean13, .ean8, .upce, .code128, .code39, .code39Mod43, .code93,
        .interleaved2of5, .itf14, .codabar, .gs1DataBar, .gs1DataBarExpanded, .gs1DataBarLimited, .microQR,
    ]

    static func symbology(_ t: AVMetadataObject.ObjectType) -> Symbology {
        switch t {
        case .qr: .qr
        case .microQR: .microQR
        case .aztec: .aztec
        case .dataMatrix: .dataMatrix
        case .pdf417: .pdf417
        case .ean13: .ean13
        case .ean8: .ean8
        case .upce: .upce
        case .code128: .code128
        case .code39, .code39Mod43: .code39
        case .code93: .code93
        case .interleaved2of5, .itf14: .itf
        case .codabar: .codabar
        case .gs1DataBar, .gs1DataBarExpanded, .gs1DataBarLimited: .gs1
        default: .unknown
        }
    }
}

/// Flashlight of the back camera; works while either scanner runs.
enum Torch {
    static var available: Bool { AVCaptureDevice.default(for: .video)?.hasTorch ?? false }
    static func set(_ on: Bool) {
        guard let d = AVCaptureDevice.default(for: .video), d.hasTorch, (try? d.lockForConfiguration()) != nil else { return }
        if on { try? d.setTorchModeOn(level: AVCaptureDevice.maxAvailableTorchLevel) } else { d.torchMode = .off }
        d.unlockForConfiguration()
    }
}

// MARK: - VisionKit (iPhone XS and newer)

struct DataScannerView: UIViewControllerRepresentable {
    var active: Bool
    var onHit: (String, Symbology) -> Void

    static var supported: Bool { DataScannerViewController.isSupported && DataScannerViewController.isAvailable }

    func makeUIViewController(context: Context) -> DataScannerViewController {
        let vc = DataScannerViewController(
            recognizedDataTypes: [.barcode(symbologies: ScanKinds.vision)],
            qualityLevel: .balanced, recognizesMultipleItems: false, isHighFrameRateTrackingEnabled: false,
            isPinchToZoomEnabled: true, isGuidanceEnabled: false, isHighlightingEnabled: true)
        vc.delegate = context.coordinator
        return vc
    }

    func updateUIViewController(_ vc: DataScannerViewController, context: Context) {
        context.coordinator.onHit = onHit
        if active, !vc.isScanning { try? vc.startScanning() }
        if !active, vc.isScanning { vc.stopScanning() }
    }

    static func dismantleUIViewController(_ vc: DataScannerViewController, coordinator: Coordinator) {
        vc.stopScanning()
    }

    func makeCoordinator() -> Coordinator { Coordinator(onHit: onHit) }

    final class Coordinator: NSObject, DataScannerViewControllerDelegate {
        var onHit: (String, Symbology) -> Void
        init(onHit: @escaping (String, Symbology) -> Void) { self.onHit = onHit }

        func dataScanner(_ s: DataScannerViewController, didAdd added: [RecognizedItem], allItems: [RecognizedItem]) {
            report(added)
        }
        func dataScanner(_ s: DataScannerViewController, didTapOn item: RecognizedItem) { report([item]) }

        private func report(_ items: [RecognizedItem]) {
            for item in items {
                if case .barcode(let b) = item, let p = b.payloadStringValue, !p.isEmpty {
                    let (sym, payload) = Symbology.normalized(Symbology(vision: b.observation.symbology), payload: p)
                    onHit(payload, sym)
                    return
                }
            }
        }
    }
}

// MARK: - AVFoundation fallback (older phones, or VisionKit unavailable)

struct AVScannerView: UIViewControllerRepresentable {
    var active: Bool
    var onHit: (String, Symbology) -> Void

    func makeUIViewController(context: Context) -> AVScannerController { AVScannerController() }
    func updateUIViewController(_ vc: AVScannerController, context: Context) {
        vc.onHit = onHit
        vc.setActive(active)
    }
}

final class AVScannerController: UIViewController, AVCaptureMetadataOutputObjectsDelegate {
    var onHit: ((String, Symbology) -> Void)?
    private let session = AVCaptureSession()
    private let queue = DispatchQueue(label: "co.qrspace.camera")
    private var preview: AVCaptureVideoPreviewLayer?
    private var configured = false
    private var wantActive = true

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .black
        queue.async { [weak self] in self?.configure() }
    }

    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        preview?.frame = view.bounds
    }

    private func configure() {
        guard let device = AVCaptureDevice.default(for: .video), let input = try? AVCaptureDeviceInput(device: device),
              session.canAddInput(input) else { return }
        session.beginConfiguration()
        session.addInput(input)
        let out = AVCaptureMetadataOutput()
        if session.canAddOutput(out) {
            session.addOutput(out)
            out.setMetadataObjectsDelegate(self, queue: .main)
            out.metadataObjectTypes = ScanKinds.metadata.filter { out.availableMetadataObjectTypes.contains($0) }
        }
        session.commitConfiguration()
        DispatchQueue.main.async { [weak self] in
            guard let self else { return }
            configured = true
            let layer = AVCaptureVideoPreviewLayer(session: session)
            layer.videoGravity = .resizeAspectFill
            layer.frame = view.bounds
            view.layer.addSublayer(layer)
            preview = layer
            setActive(wantActive)
        }
    }

    func setActive(_ on: Bool) {
        wantActive = on
        guard configured else { return }
        queue.async { [session] in
            if on, !session.isRunning { session.startRunning() }
            if !on, session.isRunning { session.stopRunning() }
        }
    }

    override func viewWillDisappear(_ animated: Bool) {
        super.viewWillDisappear(animated)
        queue.async { [session] in session.stopRunning() }
    }

    func metadataOutput(_ output: AVCaptureMetadataOutput, didOutput objects: [AVMetadataObject], from connection: AVCaptureConnection) {
        guard wantActive, let o = objects.first as? AVMetadataMachineReadableCodeObject, let s = o.stringValue, !s.isEmpty else { return }
        let (sym, payload) = Symbology.normalized(ScanKinds.symbology(o.type), payload: s)
        onHit?(payload, sym)
    }
}
