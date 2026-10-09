import PhotosUI
import SwiftUI
import UniformTypeIdentifiers

/// The memory under a code for people who can add to it (src/components/Memory.tsx): entries with edit/delete,
/// the space bar (owner can change the plan), and the composer — text, photo or video. A file that doesn't fit
/// first shows its size, the free space, the plan it needs and the price; "Pay $X and upload" buys the space and
/// uploads right away. The server measures every file itself (413 if it doesn't fit) — the app never decides.
struct MemoryEditor: View {
    @Binding var code: CodeView
    @Environment(Session.self) private var session

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            let blocks = code.blocks ?? []
            if blocks.isEmpty {
                Text(tr("memoryEmpty")).font(.system(size: 14)).foregroundStyle(Theme.muted)
            }
            ForEach(blocks) { b in
                EntryRow(block: b, author: b.author == session.personId ? tr("you") : session.name(of: b.author),
                         canChange: code.access == .owner || (code.access == .edit && b.author == session.personId),
                         code: $code)
            }
            StorageBar(code: $code)
            Composer(code: $code)
        }
    }
}

// MARK: entries

private struct EntryRow: View {
    let block: Block
    let author: String?
    let canChange: Bool
    @Binding var code: CodeView
    @State private var editing: String?
    @State private var sure = false
    @State private var busy = false
    @State private var failed = false

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            switch block.kind {
            case "photo":
                if let m = block.media { AuthedImage(url: API.shared.mediaURL(m)).accessibilityLabel(block.text.isEmpty ? tr("code.photo") : block.text) }
            case "video":
                if let m = block.media { AuthedVideo(url: API.shared.mediaURL(m)).accessibilityLabel(tr("code.video")) }
            default:
                EmptyView()
            }
            if let editing {
                TextField(tr("textPlaceholder"), text: Binding(get: { editing }, set: { self.editing = $0 }), axis: .vertical)
                    .lineLimit(2...8)
                    .textFieldStyle(BoxField())
            } else if !block.text.isEmpty {
                Text(block.text).font(.system(size: 16)).foregroundStyle(Theme.ink).textSelection(.enabled)
            }
            HStack(spacing: 4) {
                Text([author, Format.dateTime(block.at)].compactMap { $0 }.joined(separator: " · "))
                    .font(.system(size: 12)).foregroundStyle(Theme.muted)
                Spacer(minLength: 8)
                if canChange {
                    if let editing {
                        small(tr("save"), color: Theme.accentInk) { run { try await API.shared.editBlock(code.id, block: block.id, text: editing) } }
                        small(tr("cancel")) { self.editing = nil }
                    } else {
                        small(tr("edit")) { editing = block.text }
                        small(tr("delete"), color: Theme.warn) { sure = true }
                    }
                }
            }
            if failed { Text(tr("saveError")).font(.system(size: 12)).foregroundStyle(Theme.warn) }
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.card, in: RoundedRectangle(cornerRadius: 14))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(Theme.line))
        .confirmationDialog(tr("edit.confirmDelete"), isPresented: $sure, titleVisibility: .visible) {
            Button(tr("delete"), role: .destructive) { run { try await API.shared.removeBlock(code.id, block: block.id) } }
        }
    }

    private func small(_ title: String, color: Color = Theme.muted, action: @escaping () -> Void) -> some View {
        Button(title, action: action)
            .font(.system(size: 13, weight: .semibold))
            .foregroundStyle(color)
            .padding(.horizontal, 8).frame(minHeight: 36)
            .disabled(busy)
            .accessibilityLabel("\(title): \(block.text.isEmpty ? tr("code.photo") : block.text)")
    }

    private func run(_ op: @escaping () async throws -> CodeView) {
        busy = true
        failed = false
        Task {
            do { code = try await op(); editing = nil } catch { failed = true }
            busy = false
        }
    }
}

// MARK: space

/// Space under the code: "used / quota", paid until, and — for the owner — plans to switch to (monthly, demo).
private struct StorageBar: View {
    @Binding var code: CodeView
    @State private var open = false
    @State private var busy = false
    @State private var failed = false
    @State private var message: String?

    var body: some View {
        if let st = code.storage {
            let k = min(1, Double(st.used) / Double(max(st.quota, 1)))
            VStack(alignment: .leading, spacing: 10) {
                HStack(alignment: .center, spacing: 12) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(tr("storageTitle")).font(.system(size: 14, weight: .semibold)).foregroundStyle(Theme.ink)
                        Text("\(Format.bytes(st.used)) / \(Format.bytes(st.quota))" + (st.until.map { " · \(tr("storagePaidUntil")) \(Format.date($0))" } ?? ""))
                            .font(Theme.mono(12)).foregroundStyle(Theme.muted)
                    }
                    .accessibilityElement(children: .combine)
                    Spacer()
                    if code.access == .owner && StoragePlans.canChange {
                        Button { open.toggle() } label: {
                            Text(tr("storageChange")).font(.system(size: 13, weight: .heavy))
                                .padding(.horizontal, 12).frame(minHeight: 38)
                                .foregroundStyle(Theme.onStage).background(Theme.stage, in: RoundedRectangle(cornerRadius: 10))
                        }
                        .buttonStyle(.plain)
                        .accessibilityAddTraits(open ? .isSelected : [])
                    }
                }
                ProgressView(value: k).tint(k > 0.9 ? Theme.warn : Theme.accentInk)
                    .accessibilityLabel(tr("storageTitle"))
                if open && StoragePlans.canChange { plans(st) }
                if failed { Text(message ?? tr("saveError")).font(.system(size: 12)).foregroundStyle(Theme.warn) }
            }
            .padding(14)
            .background(Theme.card, in: RoundedRectangle(cornerRadius: 14))
            .overlay(RoundedRectangle(cornerRadius: 14).stroke(Theme.line))
        }
    }

    private func plans(_ st: Storage) -> some View {
        let options: [StoragePlans.Plan] = [StoragePlans.Plan(id: "free", bytes: StoragePlans.free, price: 0)] + StoragePlans.all
        return VStack(alignment: .leading, spacing: 8) {
            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 8) {
                ForEach(options) { p in
                    let now = (st.plan ?? "free") == p.id
                    let small = st.used > p.bytes
                    // Paid plans: the App Store's price for a month of this space (nil — purchases unavailable).
                    let price = p.price > 0 ? Store.shared.price(IAPProduct.space(p.id)).map(IAPText.perMonth) : nil
                    let unavailable = p.price > 0 && price == nil
                    Button { change(p.id) } label: {
                        VStack(alignment: .leading, spacing: 3) {
                            HStack {
                                Text(Format.bytes(p.bytes)).font(.system(size: 17, weight: .heavy).width(.expanded))
                                Spacer(minLength: 0)
                                if now {
                                    Text(tr("storageNow").uppercased()).font(.system(size: 9, weight: .bold))
                                        .padding(.horizontal, 6).padding(.vertical, 2)
                                        .foregroundStyle(Theme.onAccent).background(Theme.accent, in: Capsule())
                                }
                            }
                            Text(p.price > 0 ? (price ?? "—") : tr("storageFreeName"))
                                .font(Theme.mono(12)).foregroundStyle(now ? Theme.accent : Theme.muted)
                            if now && p.id != "free" {
                                Text(tr("storageRenew")).font(.system(size: 11, weight: .semibold)).underline()
                            }
                            if small { Text(tr("storageTooSmall")).font(.system(size: 11)).foregroundStyle(Theme.muted) }
                        }
                        .padding(12)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .foregroundStyle(now ? Theme.onStage : Theme.ink)
                        .background(now ? Theme.stage : Theme.field, in: RoundedRectangle(cornerRadius: 12))
                        .overlay(RoundedRectangle(cornerRadius: 12).stroke(now ? Theme.accent : Theme.line))
                        .opacity(small || unavailable ? 0.45 : 1)
                    }
                    .buttonStyle(.plain)
                    .disabled(busy || small || unavailable || (now && p.id == "free"))
                    .accessibilityLabel("\(Format.bytes(p.bytes)) — \(p.price > 0 ? (price ?? tr("iap.unavailable")) : tr("storageFreeName"))\(now ? " (\(tr("storageNow")))" : "")")
                    .accessibilityIdentifier("plan-\(p.id)")
                }
            }
            if !Store.shared.ready { PurchasesUnavailable() }
            Text(tr("storageMonthly")).font(.system(size: 12)).foregroundStyle(Theme.muted)
        }
    }

    /// "Free" — back to 1 MB (not a purchase, the server just switches). A paid plan — a month of that space for
    /// this code through Apple in-app purchase (the current plan again — one more month); the server extends it.
    private func change(_ plan: String) {
        busy = true
        failed = false
        message = nil
        Task {
            defer { busy = false }
            do {
                if plan == "free" {
                    code = try await API.shared.buyStorage(code.id, plan: plan)
                } else {
                    switch try await Store.shared.buy(.space(code: code.id, plan: plan)) {
                    case .done: code = try await API.shared.code(code.id)
                    case .cancelled: return
                    case .pending: message = tr("iap.pending"); failed = true; return
                    }
                }
                open = false
            } catch let f as Store.Failure {
                message = f.message
                failed = true
            } catch {
                failed = true
            }
        }
    }
}

// MARK: composer

/// Photo / video prepared for upload. Photos are shrunk on the phone to 1600 px JPEG, like the site does.
enum MediaPrep {
    static let maxPhotoSide: CGFloat = 1600
    static let videoTypes = ["mp4": "video/mp4", "m4v": "video/mp4", "mov": "video/quicktime", "webm": "video/webm"]

    static func photo(_ data: Data) -> UploadFile? {
        guard let img = UIImage(data: data) else { return nil }
        let side = max(img.size.width, img.size.height)
        let k = min(1, maxPhotoSide / max(side, 1))
        let size = CGSize(width: (img.size.width * k).rounded(), height: (img.size.height * k).rounded())
        let fmt = UIGraphicsImageRendererFormat.default()
        fmt.scale = 1
        let out = UIGraphicsImageRenderer(size: size, format: fmt).image { _ in img.draw(in: CGRect(origin: .zero, size: size)) }
        guard let jpeg = out.jpegData(compressionQuality: 0.85) else { return nil }
        let url = FileManager.default.temporaryDirectory.appendingPathComponent("photo-\(UUID().uuidString).jpg")
        guard (try? jpeg.write(to: url)) != nil else { return nil }
        return UploadFile(url: url, mime: "image/jpeg", filename: "photo.jpg", size: jpeg.count)
    }

    static func video(_ url: URL) -> UploadFile? {
        guard let mime = videoTypes[url.pathExtension.lowercased()] else { return nil }
        let size = (try? url.resourceValues(forKeys: [.fileSizeKey]).fileSize) ?? 0
        guard size > 0 else { return nil }
        return UploadFile(url: url, mime: mime, filename: url.lastPathComponent, size: size)
    }

    /// A copy in our temporary folder (picked files can vanish or need security scope).
    static func copyToTemp(_ src: URL) -> URL? {
        let scoped = src.startAccessingSecurityScopedResource()
        defer { if scoped { src.stopAccessingSecurityScopedResource() } }
        let dst = FileManager.default.temporaryDirectory.appendingPathComponent("pick-\(UUID().uuidString).\(src.pathExtension)")
        do { try FileManager.default.copyItem(at: src, to: dst) } catch { return nil }
        return dst
    }
}

/// A movie from Photos, copied to a temporary file.
struct PickedMovie: Transferable {
    let url: URL
    static var transferRepresentation: some TransferRepresentation {
        FileRepresentation(contentType: .movie) { SentTransferredFile($0.url) } importing: { received in
            let ext = received.file.pathExtension.isEmpty ? "mov" : received.file.pathExtension
            let dst = FileManager.default.temporaryDirectory.appendingPathComponent("video-\(UUID().uuidString).\(ext)")
            try FileManager.default.copyItem(at: received.file, to: dst)
            return PickedMovie(url: dst)
        }
    }
}

private struct Composer: View {
    enum Kind: String, CaseIterable { case text, photo, video }

    @Binding var code: CodeView
    @State private var kind: Kind = .text
    @State private var text = ""
    @State private var file: UploadFile?
    @State private var photoItem: PhotosPickerItem?
    @State private var videoItem: PhotosPickerItem?
    @State private var importing = false
    @State private var preparing = false
    @State private var busy = false
    @State private var progress: Double?
    @State private var error: String?
    @State private var offer: RoomOffer?
    #if DEBUG
    nonisolated(unsafe) private static var attachedOnce = false
    #endif

    private var ready: Bool { kind == .text ? !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty : file != nil }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 10) {
                Image(systemName: "plus").font(.system(size: 14, weight: .black))
                    .frame(width: 28, height: 28).foregroundStyle(Theme.onAccent)
                    .background(Theme.accent, in: RoundedRectangle(cornerRadius: 8))
                    .accessibilityHidden(true)
                Text(tr("composerTitle")).font(.system(size: 17, weight: .heavy).width(.expanded)).foregroundStyle(Theme.ink)
                    .accessibilityAddTraits(.isHeader)
            }
            Picker(tr("composerTitle"), selection: $kind) {
                Label(tr("addText"), systemImage: "text.alignleft").tag(Kind.text)
                Label(tr("addPhoto"), systemImage: "camera").tag(Kind.photo)
                Label(tr("addVideo"), systemImage: "video").tag(Kind.video)
            }
            .pickerStyle(.segmented)
            .onChange(of: kind) { _, _ in file = nil; error = nil; offer = nil }

            if kind != .text { filePicker }

            TextField(kind == .text ? tr("textPlaceholder") : tr("captionPlaceholder"), text: $text, axis: .vertical)
                .lineLimit(kind == .text ? 4...10 : 2...5)
                .textFieldStyle(BoxField())
                .accessibilityIdentifier("composer-text")

            if let offer { RoomOfferCard(offer: offer, owner: code.access == .owner, busy: busy, onPay: payAndUpload, onCancel: { self.offer = nil }) }
            if let error { Text(error).font(.system(size: 14, weight: .medium)).foregroundStyle(Theme.warn) }

            Button { Task { await submit() } } label: {
                HStack(spacing: 8) {
                    if busy { ProgressView().tint(Theme.onAccent) }
                    Text(busy ? uploadingText : tr("save"))
                }
            }
            .buttonStyle(.lime)
            .disabled(!ready || busy || preparing)
            .opacity(!ready || busy || preparing ? 0.5 : 1)
            .accessibilityIdentifier("composer-save")
        }
        .padding(16)
        .background(Theme.card, in: RoundedRectangle(cornerRadius: 16))
        .overlay(RoundedRectangle(cornerRadius: 16).strokeBorder(Theme.line, style: StrokeStyle(lineWidth: 2, dash: [7, 5])))
        .onChange(of: photoItem) { _, item in
            guard let item else { return }
            preparing = true
            Task {
                let data = try? await item.loadTransferable(type: Data.self)
                pick(data.flatMap(MediaPrep.photo))
                photoItem = nil
                preparing = false
            }
        }
        .onChange(of: videoItem) { _, item in
            guard let item else { return }
            preparing = true
            Task {
                let movie = try? await item.loadTransferable(type: PickedMovie.self)
                pick(movie.flatMap { MediaPrep.video($0.url) })
                videoItem = nil
                preparing = false
            }
        }
        .fileImporter(isPresented: $importing, allowedContentTypes: kind == .photo ? [.image] : [.movie]) { result in
            guard case .success(let url) = result, let local = MediaPrep.copyToTemp(url) else { return }
            if kind == .photo { pick((try? Data(contentsOf: local)).flatMap(MediaPrep.photo)) } else { pick(MediaPrep.video(local)) }
        }
        .onAppear(perform: debugAttach)
    }

    private var uploadingText: String {
        if let p = progress, p < 1 { return "\(tr("uploading")) \(Int(p * 100))%" }
        return tr("uploading")
    }

    private var filePicker: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 8) {
                Group {
                    if kind == .photo {
                        PhotosPicker(selection: $photoItem, matching: .images) { Label(file == nil ? tr("upload") : tr("replace"), systemImage: "photo") }
                    } else {
                        PhotosPicker(selection: $videoItem, matching: .videos) { Label(file == nil ? tr("upload") : tr("replace"), systemImage: "video") }
                    }
                }
                .font(.system(size: 14, weight: .semibold))
                .padding(.horizontal, 14).frame(minHeight: 44)
                .foregroundStyle(Theme.ink)
                .background(Theme.field, in: RoundedRectangle(cornerRadius: 12))
                .overlay(RoundedRectangle(cornerRadius: 12).stroke(Theme.line))
                Button { importing = true } label: { Label(tr("edit.fromFiles"), systemImage: "folder") }
                    .font(.system(size: 14, weight: .semibold))
                    .padding(.horizontal, 14).frame(minHeight: 44)
                    .foregroundStyle(Theme.ink)
                    .background(Theme.field, in: RoundedRectangle(cornerRadius: 12))
                    .overlay(RoundedRectangle(cornerRadius: 12).stroke(Theme.line))
                if preparing { ProgressView() }
            }
            .buttonStyle(.plain)
            if let file {
                Label("\(file.filename) · \(Format.bytes(file.size))", systemImage: file.isVideo ? "film" : "photo")
                    .font(.system(size: 13)).foregroundStyle(Theme.muted).lineLimit(1)
                    .accessibilityIdentifier("composer-file")
            } else if kind == .video {
                Text(tr(StoreBuild.purchasesEnabled ? "videoLimit" : "store.videoLimit")).font(.system(size: 12)).foregroundStyle(Theme.muted)
            }
        }
    }

    /// A file was chosen. Videos: the size is known now — doesn't fit → the price of the space before "Save".
    private func pick(_ f: UploadFile?) {
        error = nil
        offer = nil
        guard let f else { file = nil; error = tr("uploadError"); return }
        if f.isVideo && f.size > StoragePlans.maxFile { file = nil; error = tr("videoTooBig"); return }
        file = f
        if f.isVideo { offer = RoomOffer(storage: code.storage, need: need(f)) }
    }

    private func need(_ f: UploadFile?) -> Int { (f?.size ?? 0) + text.utf8.count }

    /// `current` — the code after buying space (the new quota), otherwise as it is now.
    private func submit(current: CodeView? = nil) async {
        let cur = current ?? code
        let sentText = text, sentFile = kind == .text ? nil : file
        error = nil
        // First: how much space it needs and whether it fits; doesn't fit — show the price, don't upload.
        if let o = RoomOffer(storage: cur.storage, need: (sentFile?.size ?? 0) + sentText.utf8.count) {
            offer = o
            return
        }
        offer = nil
        busy = true
        progress = nil
        defer { busy = false; progress = nil }
        let report: @Sendable (Double) -> Void = { p in Task { @MainActor in progress = p } }
        do {
            let next: CodeView
            if let f = sentFile, f.isVideo {
                // Permission for exactly this many bytes (413 if it doesn't fit). Production: PUT straight into
                // storage, then the entry names the uploaded file; the local server takes the video in the form.
                let ticket = try await API.shared.uploadURL(code.id, size: f.size, type: f.mime)
                if ticket.direct, let name = ticket.name {
                    try await API.shared.put(ticket, file: f, progress: report)
                    next = try await API.shared.addBlock(code.id, text: sentText, file: nil, uploaded: name)
                } else {
                    next = try await API.shared.addBlock(code.id, text: sentText, file: f, progress: report)
                }
            } else {
                next = try await API.shared.addBlock(code.id, text: sentText, file: sentFile, progress: report)
            }
            code = next
            if text == sentText { text = "" }
            if file == sentFile { file = nil }
        } catch APIError.tooLarge {
            // The server measured it and it doesn't fit (someone added something meanwhile) — fresh numbers, offer.
            if let fresh = try? await API.shared.code(code.id) { code = fresh }
            offer = RoomOffer(storage: code.storage, need: (sentFile?.size ?? 0) + sentText.utf8.count)
            if offer == nil { error = tr(StoreBuild.purchasesEnabled ? "storageFull" : "store.roomNotInApp") }
        } catch APIError.offline {
            error = tr("common.offline")
        } catch {
            self.error = tr("uploadError")
        }
    }

    /// A month of the space it needs through Apple in-app purchase — then upload right away.
    private func payAndUpload(_ plan: String) {
        busy = true
        error = nil
        Task {
            do {
                switch try await Store.shared.buy(.space(code: code.id, plan: plan)) {
                case .done: break
                case .cancelled: busy = false; return
                case .pending: busy = false; error = tr("iap.pending"); return
                }
                let next = try await API.shared.code(code.id)
                code = next
                busy = false
                await submit(current: next)
            } catch let f as Store.Failure {
                self.error = f.message
                busy = false
            } catch {
                self.error = tr("uploadError")
                busy = false
            }
        }
    }

    /// QA in the Simulator (no camera roll): `-QRAttachFile /path/to/file.mp4|.jpg` picks that file once.
    private func debugAttach() {
        #if DEBUG
        guard !Self.attachedOnce, let path = UserDefaults.standard.string(forKey: "QRAttachFile") else { return }
        Self.attachedOnce = true
        let url = URL(fileURLWithPath: path)
        // Keep the file's own name (it shows under the picker, e.g. in App Store screenshots).
        let dir = FileManager.default.temporaryDirectory.appendingPathComponent("attach-\(UUID().uuidString)", isDirectory: true)
        let local = dir.appendingPathComponent(url.lastPathComponent)
        guard (try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)) != nil,
              (try? FileManager.default.copyItem(at: url, to: local)) != nil else { return }
        let video = MediaPrep.videoTypes[url.pathExtension.lowercased()] != nil
        kind = video ? .video : .photo
        // After the kind switch has reset the composer.
        Task {
            try? await Task.sleep(for: .milliseconds(400))
            pick(video ? MediaPrep.video(local) : (try? Data(contentsOf: local)).flatMap(MediaPrep.photo))
        }
        #endif
    }
}

/// "The file doesn't fit under the code": file size, free space, the plan it needs and its price, "Pay $X and
/// upload". Not the owner — only the owner can buy space. More than the biggest plan — pick a smaller file.
struct RoomOfferCard: View {
    static let anchor = "room-offer"
    let offer: RoomOffer
    let owner: Bool
    let busy: Bool
    let onPay: (String) -> Void
    let onCancel: () -> Void
    @Environment(\.reveal) private var reveal

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(tr("upTooBigTitle")).font(.system(size: 17, weight: .heavy).width(.expanded))
            Text(tr("upSizes", ["file": Format.bytes(offer.need), "free": Format.bytes(offer.free), "quota": Format.bytes(offer.quota)]))
                .font(Theme.mono(12)).foregroundStyle(Theme.onStage.opacity(0.7))
                .accessibilityIdentifier("room-sizes")
            if !StoreBuild.purchasesEnabled {
                // No purchases in this build: the sizes and what to do — no plan, no price, no button to buy.
                Text(tr(offer.plan == nil ? "upMax" : "store.roomNotInApp", ["max": Format.bytes(StoragePlans.all.last!.bytes)]))
                    .font(.system(size: 14)).foregroundStyle(Theme.onStage.opacity(0.85))
                    .accessibilityIdentifier("room-not-in-app")
                Button(tr("cancel"), action: onCancel)
                    .font(.system(size: 14, weight: .medium)).foregroundStyle(Theme.onStage.opacity(0.7))
                    .frame(minHeight: 44)
            } else if let plan = offer.plan {
                if owner, let price = Store.shared.price(IAPProduct.space(plan.id)) {
                    Text(tr("iap.need", ["size": Format.bytes(plan.bytes), "price": price]))
                        .font(.system(size: 14))
                    HStack(spacing: 8) {
                        Button { onPay(plan.id) } label: {
                            HStack(spacing: 8) {
                                if busy { ProgressView().tint(Theme.onAccent) }
                                Text(tr("iap.payUpload", ["price": price])).font(.system(size: 15, weight: .heavy))
                            }
                            .padding(.horizontal, 16).frame(minHeight: 46)
                            .foregroundStyle(Theme.onAccent).background(Theme.accent, in: RoundedRectangle(cornerRadius: 12))
                        }
                        .buttonStyle(.plain)
                        .disabled(busy)
                        .accessibilityIdentifier("room-pay")
                        Button(tr("cancel"), action: onCancel)
                            .font(.system(size: 14, weight: .medium)).foregroundStyle(Theme.onStage.opacity(0.7))
                            .padding(.horizontal, 10).frame(minHeight: 46)
                    }
                } else if owner {
                    PurchasesUnavailable(onStage: true)
                    Button(tr("cancel"), action: onCancel)
                        .font(.system(size: 14, weight: .medium)).foregroundStyle(Theme.onStage.opacity(0.7))
                        .frame(minHeight: 44)
                } else {
                    Text(tr("upOwnerOnly")).font(.system(size: 14)).foregroundStyle(Theme.onStage.opacity(0.85))
                }
            } else {
                Text(tr("upMax", ["max": Format.bytes(StoragePlans.all.last!.bytes)])).font(.system(size: 14))
                    .foregroundStyle(Theme.onStage.opacity(0.85))
            }
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .foregroundStyle(Theme.onStage)
        .background(Theme.stage, in: RoundedRectangle(cornerRadius: 16))
        .accessibilityElement(children: .contain)
        .id(Self.anchor)
        // Appears below the composer, often under the tab bar — bring the "Pay and upload" button into view.
        .onAppear { show() }
        .onChange(of: offer) { _, _ in show() }
    }

    private func show() {
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.25) { reveal?(Self.anchor) }
    }
}
