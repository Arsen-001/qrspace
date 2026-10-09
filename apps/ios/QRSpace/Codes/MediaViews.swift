import AVKit
import SwiftUI

/// Media under a code is served only with the session cookie (/api/media/…). Small in-memory cache, so the
/// dashboard and the code page don't load the same photo twice.
enum MediaCache {
    static let images: NSCache<NSURL, UIImage> = {
        let c = NSCache<NSURL, UIImage>()
        c.totalCostLimit = 60 * 1024 * 1024
        return c
    }()

    static func image(_ url: URL) async -> UIImage? {
        if let hit = images.object(forKey: url as NSURL) { return hit }
        guard let d = try? await API.shared.data(url), let img = UIImage(data: d) else { return nil }
        images.setObject(img, forKey: url as NSURL, cost: d.count)
        return img
    }
}

/// A photo, whole (fit).
struct AuthedImage: View {
    let url: URL
    @State private var image: UIImage?
    @State private var failed = false

    var body: some View {
        Group {
            if let image = image ?? MediaCache.images.object(forKey: url as NSURL) {
                Image(uiImage: image).resizable().scaledToFit().clipShape(RoundedRectangle(cornerRadius: 6))
            } else {
                RoundedRectangle(cornerRadius: 6).fill(Theme.field).frame(height: 200)
                    .overlay { if failed { Image(systemName: "photo").foregroundStyle(Theme.muted) } else { ProgressView() } }
            }
        }
        .task(id: url) {
            if let img = await MediaCache.image(url) { image = img } else { failed = true }
        }
    }
}

/// A photo cropped to a square (dashboard cards).
struct AuthedThumb: View {
    let url: URL
    @State private var image: UIImage?

    var body: some View {
        Color.white.opacity(0.06)
            .aspectRatio(1, contentMode: .fit)
            .overlay {
                if let img = image ?? MediaCache.images.object(forKey: url as NSURL) {
                    Image(uiImage: img).resizable().scaledToFill()
                }
            }
            .clipShape(RoundedRectangle(cornerRadius: 8))
            .task(id: url) { image = await MediaCache.image(url) }
            .accessibilityHidden(true)
    }
}

struct AuthedVideo: View {
    let url: URL
    @State private var player: AVPlayer?

    var body: some View {
        VideoPlayer(player: player)
            .frame(height: 240)
            .clipShape(RoundedRectangle(cornerRadius: 6))
            .onAppear {
                guard player == nil else { return }
                let asset = AVURLAsset(url: url, options: [AVURLAssetHTTPCookiesKey: API.shared.cookies])
                player = AVPlayer(playerItem: AVPlayerItem(asset: asset))
            }
            .onDisappear { player?.pause() }
    }
}
