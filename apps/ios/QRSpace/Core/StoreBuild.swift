import Foundation

/// What the App Store build may show. The owner hasn't chosen yet between Apple in-app purchase and no purchases
/// in the app (guideline 3.1.1: digital goods bought inside an iOS app must use Apple IAP).
///
/// `purchasesEnabled` comes from the build setting `QR_PURCHASES_ENABLED` (project.yml, default YES), baked into
/// Info.plist as `QRPurchasesEnabled`. Build with `QR_PURCHASES_ENABLED=NO` and every buy/pay screen is gone:
/// no prices, no "Pay $X", no space plans. What stays works as before — the scanner, the free first simple code,
/// codes from packs the person already has, memory within the space the code already has, sharing, the account.
/// (This is guideline 3.1.3(f): a free companion app to a paid web service, with no purchasing and no calls to
/// action to buy elsewhere.) Debug builds can flip it with the launch argument `-QRPurchases NO|YES`.
enum StoreBuild {
    static let purchasesEnabled: Bool = {
        #if DEBUG
        if let v = UserDefaults.standard.string(forKey: "QRPurchases") { return parse(v) }
        #endif
        return parse(Bundle.main.object(forInfoDictionaryKey: "QRPurchasesEnabled") as? String)
    }()

    /// YES / NO from the build setting; anything else (or missing) — the default, enabled.
    static func parse(_ v: String?) -> Bool {
        guard let v = v?.trimmingCharacters(in: .whitespaces).lowercased(), !v.isEmpty else { return true }
        return !["no", "false", "0"].contains(v)
    }

    /// What to do after the price check (`GET /api/purchases?key=&tier=`) before creating or downloading a code.
    enum Step: Equatable {
        /// Already paid — go on.
        case go
        /// Show the gate: free first code, a code from a pack, or (purchases on) pay.
        case ask
        /// Purchases are off and this one isn't free — say it can't be done in the app; no price, no button.
        case notInApp
    }

    static func step(for q: Quote, purchases: Bool = purchasesEnabled) -> Step {
        if q.paid { return .go }
        if q.free || q.pack != nil || purchases { return .ask }
        return .notInApp
    }
}
