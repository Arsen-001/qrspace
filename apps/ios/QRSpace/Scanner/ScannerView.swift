import AVFoundation
import PhotosUI
import SwiftData
import SwiftUI

/// Main tab: our own camera scanner (QR + barcodes), torch, decode from Photos, history.
struct ScannerView: View {
    @Environment(\.modelContext) private var db
    @Environment(\.scenePhase) private var phase
    @State private var camera: CameraState = .checking
    @State private var hit: ScanHit?
    @State private var showHistory = false
    @State private var torch = false
    @State private var photo: PhotosPickerItem?
    @State private var notFound = false
    @State private var lastPayload: (String, Date)?
    var tabActive: Bool

    enum CameraState { case checking, ready, denied, none }

    private var scanning: Bool { tabActive && hit == nil && !showHistory && phase == .active }

    var body: some View {
        ZStack {
            Theme.stage.ignoresSafeArea()
            cameraLayer.ignoresSafeArea()
            if camera == .ready || Self.debugStill != nil { Viewfinder().allowsHitTesting(false) }
            VStack(spacing: 0) {
                header
                Spacer()
                if (camera == .denied || camera == .none) && Self.debugStill == nil { noCamera } else { hintPill }
                Spacer().frame(height: 18)
                controls
            }
            .padding(.horizontal, 16)
            .padding(.bottom, 12)
        }
        .environment(\.colorScheme, .dark)
        .sensoryFeedback(.success, trigger: hit?.id) { _, new in new != nil }
        .sheet(item: $hit) { h in
            ScanResultView(hit: h).presentationDetents(h.isOurs ? [.large] : [.medium, .large]).presentationDragIndicator(.visible)
        }
        .sheet(isPresented: $showHistory) { HistoryView() }
        .task { await checkCamera() }
        .task { await debugDecodeFromLaunchArgument() }
        .onChange(of: photo) { _, item in Task { await decode(item) } }
        .onChange(of: scanning) { _, on in if !on && torch { torch = false; Torch.set(false) } }
        .alert(tr("scan.notFound"), isPresented: $notFound) { Button("OK", role: .cancel) {} }
    }

    @ViewBuilder private var cameraLayer: some View {
        if let still = Self.debugStill {
            // An overlay, so the filled picture never resizes the screen's layout.
            Color.clear.overlay { Image(uiImage: still).resizable().scaledToFill() }.clipped()
        } else if camera == .ready {
            if DataScannerView.supported {
                DataScannerView(active: scanning, onHit: handle)
            } else {
                AVScannerView(active: scanning, onHit: handle)
            }
        } else {
            DotGrid(color: Theme.onStage.opacity(0.12))
        }
    }

    private var header: some View {
        HStack(alignment: .center) {
            VStack(alignment: .leading, spacing: 2) {
                Text("QR SPACE").font(Theme.heading(22)).foregroundStyle(Theme.onStage)
                Text(tr("tab.scan").uppercased())
                    .font(.system(size: 11, weight: .bold).width(.expanded)).tracking(1.4)
                    .foregroundStyle(Theme.accent)
            }
            .accessibilityElement(children: .combine)
            .accessibilityAddTraits(.isHeader)
            Spacer()
            Button { showHistory = true } label: {
                Image(systemName: "clock.arrow.circlepath").font(.system(size: 18, weight: .semibold))
                    .frame(width: 46, height: 46)
                    .background(.black.opacity(0.55), in: Circle())
                    .overlay(Circle().stroke(Theme.onStage.opacity(0.18)))
            }
            .foregroundStyle(Theme.onStage)
            .accessibilityLabel(tr("scan.history"))
        }
        .padding(.top, 8)
    }

    private var hintPill: some View {
        Text(tr("scan.hint"))
            .font(.system(size: 15, weight: .semibold))
            .multilineTextAlignment(.center)
            .foregroundStyle(Theme.onStage)
            .padding(.horizontal, 16).padding(.vertical, 10)
            .background(.black.opacity(0.6), in: Capsule())
    }

    private var noCamera: some View {
        VStack(alignment: .leading, spacing: 12) {
            Image(systemName: "camera.metering.unknown").font(.system(size: 30, weight: .bold)).foregroundStyle(Theme.accent)
            Text(tr("scan.noCamera.title")).font(Theme.heading(24)).foregroundStyle(Theme.onStage)
            Text(tr("scan.noCamera.text")).font(.system(size: 16)).foregroundStyle(Theme.onStage.opacity(0.75))
            if camera == .denied {
                Button(tr("scan.openSettings")) {
                    if let u = URL(string: UIApplication.openSettingsURLString) { UIApplication.shared.open(u) }
                }
                .buttonStyle(.lime)
            }
        }
        .padding(20)
        .frame(maxWidth: 520, alignment: .leading)
        .background(Theme.stage.opacity(0.9), in: RoundedRectangle(cornerRadius: 14))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(Theme.stageLine))
    }

    private var controls: some View {
        HStack(spacing: 14) {
            PhotosPicker(selection: $photo, matching: .images) {
                Label(tr("scan.photos"), systemImage: "photo.on.rectangle")
                    .font(.system(size: 16, weight: .bold))
                    .frame(maxWidth: .infinity, minHeight: 56)
                    .foregroundStyle(Theme.onAccent)
                    .background(Theme.accent, in: RoundedRectangle(cornerRadius: 10))
            }
            if camera == .ready && Torch.available {
                Button {
                    torch.toggle()
                    Torch.set(torch)
                } label: {
                    Image(systemName: torch ? "flashlight.on.fill" : "flashlight.off.fill")
                        .font(.system(size: 22, weight: .semibold))
                        .frame(width: 56, height: 56)
                        .foregroundStyle(torch ? Theme.onAccent : Theme.onStage)
                        .background(torch ? Theme.accent : .black.opacity(0.6), in: RoundedRectangle(cornerRadius: 10))
                        .overlay(RoundedRectangle(cornerRadius: 10).stroke(Theme.onStage.opacity(0.18)))
                }
                .accessibilityLabel(tr(torch ? "scan.torchOff" : "scan.torchOn"))
            }
        }
    }

    // MARK: actions

    private func handle(_ payload: String, _ sym: Symbology) {
        guard hit == nil else { return }
        // The same code still in front of the camera right after closing the sheet — don't reopen it at once.
        if let (p, at) = lastPayload, p == payload, Date().timeIntervalSince(at) < 2.5 { return }
        lastPayload = (payload, .now)
        db.insert(ScanRecord(payload: payload, symbology: sym))
        try? db.save()
        hit = ScanHit(payload: payload, symbology: sym)
    }

    private func decode(_ item: PhotosPickerItem?) async {
        guard let item, let data = try? await item.loadTransferable(type: Data.self), let img = UIImage(data: data) else { return }
        photo = nil
        await decodeImage(img)
    }

    private func decodeImage(_ img: UIImage) async {
        if let h = await ImageDecoder.decode(img) { lastPayload = nil; handle(h.payload, h.symbology) } else { notFound = true }
    }

    private func checkCamera() async {
        guard AVCaptureDevice.default(for: .video) != nil else { camera = .none; return }
        switch AVCaptureDevice.authorizationStatus(for: .video) {
        case .authorized: camera = .ready
        case .notDetermined: camera = await AVCaptureDevice.requestAccess(for: .video) ? .ready : .denied
        default: camera = .denied
        }
    }

    /// Debug/QA (App Store screenshots — the Simulator has no camera): `-QRCameraStill /path/img.png` shows that
    /// picture where the camera picture would be. Always nil in Release.
    private static let debugStill: UIImage? = {
        #if DEBUG
        return UserDefaults.standard.string(forKey: "QRCameraStill").flatMap { UIImage(contentsOfFile: $0) }
        #else
        return nil
        #endif
    }()

    /// Debug/QA: `-QRDecodeFile /path/to/image.png` runs the Photos decode path on a file (the Simulator has no camera).
    private func debugDecodeFromLaunchArgument() async {
        #if DEBUG
        if UserDefaults.standard.bool(forKey: "QRShowHistory") { showHistory = true }
        guard let path = UserDefaults.standard.string(forKey: "QRDecodeFile"), let img = UIImage(contentsOfFile: path) else { return }
        try? await Task.sleep(for: .milliseconds(600))
        await decodeImage(img)
        #endif
    }
}

/// Lime corner brackets in the middle of the camera.
private struct Viewfinder: View {
    var body: some View {
        GeometryReader { geo in
            let side = min(geo.size.width, geo.size.height) * 0.68
            let rect = CGRect(x: (geo.size.width - side) / 2, y: (geo.size.height - side) / 2 - 20, width: side, height: side)
            ZStack {
                Path { p in
                    p.addRect(CGRect(origin: .zero, size: geo.size))
                    p.addRoundedRect(in: rect, cornerSize: CGSize(width: 18, height: 18))
                }
                .fill(.black.opacity(0.35), style: FillStyle(eoFill: true))
                Corners().stroke(Theme.accent, style: StrokeStyle(lineWidth: 6, lineCap: .round, lineJoin: .round))
                    .frame(width: side, height: side)
                    .position(x: rect.midX, y: rect.midY)
            }
        }
        .ignoresSafeArea()
        .accessibilityHidden(true)
    }

    struct Corners: Shape {
        func path(in r: CGRect) -> Path {
            let l = r.width * 0.16, rad: CGFloat = 18
            var p = Path()
            for (cx, cy, sx, sy) in [(r.minX, r.minY, 1.0, 1.0), (r.maxX, r.minY, -1.0, 1.0), (r.minX, r.maxY, 1.0, -1.0), (r.maxX, r.maxY, -1.0, -1.0)] {
                p.move(to: CGPoint(x: cx, y: cy + sy * l))
                p.addLine(to: CGPoint(x: cx, y: cy + sy * rad))
                p.addQuadCurve(to: CGPoint(x: cx + sx * rad, y: cy), control: CGPoint(x: cx, y: cy))
                p.addLine(to: CGPoint(x: cx + sx * l, y: cy))
            }
            return p
        }
    }
}
