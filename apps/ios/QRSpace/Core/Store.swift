import Foundation
import Observation
import StoreKit

// In-app purchases with Apple (StoreKit 2) — the owner's decision of 09.10.2026. The products live in App Store
// Connect (and in QRSpace.storekit for the Simulator); the server (POST /api/iap, src/lib/iap.ts) checks Apple's
// signed transaction and grants exactly what the site's payment grants. The app finishes a transaction only after
// the server took it (200) or had taken it before (409), so an interrupted purchase is never lost.

/// The App Store products (src/lib/iap.ts IAP_PRODUCTS).
enum IAPProduct: String, CaseIterable {
    /// Consumable: one code (any look).
    case code = "co.qrspace.code"
    /// Consumables: packs of codes (src/lib/packs.ts CODE_PACKS).
    case pack5 = "co.qrspace.pack5"
    case pack10 = "co.qrspace.pack10"
    case pack50 = "co.qrspace.pack50"
    case pack100 = "co.qrspace.pack100"
    /// Non-renewing subscriptions: one month of space under ONE code; bought again — that code gets another month.
    case space10 = "co.qrspace.space10.month"
    case space100 = "co.qrspace.space100.month"
    case space1000 = "co.qrspace.space1000.month"

    static func pack(_ plan: String) -> IAPProduct? { ["p5": .pack5, "p10": .pack10, "p50": .pack50, "p100": .pack100][plan] }
    static func space(_ plan: String) -> IAPProduct? { ["s10": .space10, "s100": .space100, "s1000": .space1000][plan] }
}

/// Packs of codes as the site sells them (src/lib/packs.ts): how many codes, 1 MB under each.
enum CodePacks {
    struct Plan: Identifiable, Equatable { let id: String; let codes: Int; var product: IAPProduct { IAPProduct.pack(id)! } }
    static let all = [Plan(id: "p5", codes: 5), Plan(id: "p10", codes: 10), Plan(id: "p50", codes: 50), Plan(id: "p100", codes: 100)]
    /// The site's favourite ("Popular").
    static let best = "p50"
    static let bytesPerCode = 1024 * 1024
}

/// What a purchase is for — sent with the signed transaction; the server checks that the product matches it.
enum IAPIntent: Equatable, Codable {
    /// A code by its payment key (`g:…` for a new code, `code:<id>` for a memory code's full image) — then
    /// /api/codes/quick (or the download) goes on as after any payment.
    case code(key: String, tier: String)
    case pack(plan: String)
    case space(code: String, plan: String)

    var product: IAPProduct? {
        switch self {
        case .code: .code
        case .pack(let plan): IAPProduct.pack(plan)
        case .space(_, let plan): IAPProduct.space(plan)
        }
    }

    var json: [String: Any] {
        switch self {
        case .code(let key, let tier): ["kind": "code", "key": key, "tier": tier]
        case .pack(let plan): ["kind": "pack", "plan": plan]
        case .space(let code, let plan): ["kind": "space", "code": code, "plan": plan]
        }
    }
}

@MainActor @Observable
final class Store {
    static let shared = Store()

    enum Load: Equatable { case idle, loading, ready, failed }
    enum Outcome: Equatable { case done, cancelled, pending }
    enum Failure: Error, Equatable {
        /// The products didn't load (no App Store, not set up yet) — "Purchases unavailable".
        case unavailable
        /// StoreKit said the purchase failed.
        case store
        /// The server didn't accept it (402 not verified, 422 wrong product, 403/404/413 for space…). The
        /// transaction stays open: StoreKit offers it again on the next launch, nothing is lost.
        case server(APIError)
    }

    private(set) var load: Load = .idle
    private(set) var products: [String: Product] = [:]
    /// Bumped when a purchase finished in the background (an interrupted or approved one) — screens reload.
    private(set) var delivered = 0
    @ObservationIgnored private var updates: Task<Void, Never>?
    @ObservationIgnored private var loadRequest = 0

    /// Purchases can be made right now: the build has them and the store gave us the products.
    var ready: Bool { StoreBuild.purchasesEnabled && load == .ready }
    func product(_ p: IAPProduct) -> Product? { StoreBuild.purchasesEnabled ? products[p.rawValue] : nil }
    /// The store's own price in the person's currency ("$0.99", "990 ₽") — never our "$1".
    func price(_ p: IAPProduct?) -> String? { p.flatMap { product($0)?.displayPrice } }

    /// At launch: listen for transactions that finish outside a purchase call, load the products, and hand the
    /// server anything left unfinished last time.
    func start() {
        guard StoreBuild.purchasesEnabled, updates == nil else { return }
        updates = Task { [weak self] in
            for await result in Transaction.updates { await self?.handle(result) }
        }
        Task {
            await loadProducts()
            await deliverUnfinished()
        }
    }

    /// Ask the store for the products (again). The newest request wins — an older one still waiting is ignored.
    func loadProducts() async {
        guard StoreBuild.purchasesEnabled else { return }
        loadRequest += 1
        let request = loadRequest
        if load != .ready { load = .loading }
        do {
            var list = try await Product.products(for: IAPProduct.allCases.map(\.rawValue))
            if list.isEmpty { // the store can answer empty right after launch (a cold Simulator, a flaky network) — once more
                try await Task.sleep(for: .seconds(2))
                list = try await Product.products(for: IAPProduct.allCases.map(\.rawValue))
            }
            guard request == loadRequest else { return }
            if !list.isEmpty { products = Dictionary(uniqueKeysWithValues: list.map { ($0.id, $0) }) }
            load = products.isEmpty ? .failed : .ready
        } catch {
            guard request == loadRequest else { return }
            if products.isEmpty { load = .failed }
        }
    }

    /// Unfinished transactions (the app was closed mid-purchase, Ask to Buy approved later, the server was down).
    func deliverUnfinished() async {
        for await result in Transaction.unfinished { await handle(result) }
    }

    /// Buy through Apple, then let the server grant it. `.done` — the server has it (the screen reloads).
    func buy(_ intent: IAPIntent) async throws -> Outcome {
        guard let id = intent.product, let product = product(id) else { throw Failure.unavailable }
        let token = UUID()
        Intents.save(intent, for: token)
        let result: Product.PurchaseResult
        do {
            result = try await product.purchase(options: [.appAccountToken(token)])
        } catch {
            Intents.remove(token)
            throw Failure.store
        }
        switch result {
        case .success(let verification):
            try await deliver(verification, intent: intent)
            return .done
        case .pending:
            return .pending // Ask to Buy / a bank check: Transaction.updates brings it later
        case .userCancelled:
            Intents.remove(token)
            return .cancelled
        @unknown default:
            Intents.remove(token)
            return .cancelled
        }
    }

    /// Server first, then finish — only after 200 (granted now) or 409 (granted before).
    private func deliver(_ verification: VerificationResult<Transaction>, intent: IAPIntent) async throws {
        let tx = verification.unsafePayloadValue
        do {
            try await API.shared.iap(jws: verification.jwsRepresentation, intent: intent)
        } catch APIError.conflict {
            // Already counted — just close it.
        } catch let e as APIError {
            throw Failure.server(e)
        }
        await tx.finish()
        if let t = tx.appAccountToken { Intents.remove(t) }
    }

    private func handle(_ verification: VerificationResult<Transaction>) async {
        let tx = verification.unsafePayloadValue
        if tx.revocationDate != nil { await tx.finish(); return } // refunded by Apple — nothing to grant
        // What it was for: saved when buying; a pack can be told by the product alone. Unknown (another phone,
        // a reinstall) — leave it open; it comes back on every launch until a server can place it.
        let intent = tx.appAccountToken.flatMap(Intents.load) ?? IAPIntent.fallback(for: tx.productID)
        guard let intent else { return }
        do {
            try await deliver(verification, intent: intent)
            delivered += 1
        } catch {}
    }

    /// Intents of purchases in flight, by the transaction's appAccountToken (a fresh UUID per purchase).
    private enum Intents {
        static let key = "QRIAPIntents"
        static func all() -> [String: IAPIntent] {
            guard let d = UserDefaults.standard.data(forKey: key) else { return [:] }
            return (try? JSONDecoder().decode([String: IAPIntent].self, from: d)) ?? [:]
        }
        static func write(_ m: [String: IAPIntent]) {
            UserDefaults.standard.set(try? JSONEncoder().encode(m), forKey: key)
        }
        static func save(_ i: IAPIntent, for t: UUID) { var m = all(); m[t.uuidString] = i; write(m) }
        static func load(_ t: UUID) -> IAPIntent? { all()[t.uuidString] }
        static func remove(_ t: UUID) { var m = all(); m[t.uuidString] = nil; write(m) }
    }
}

extension IAPIntent {
    /// Without a saved intent only a pack is unambiguous.
    static func fallback(for productID: String) -> IAPIntent? {
        guard let p = IAPProduct(rawValue: productID) else { return nil }
        switch p {
        case .pack5: return .pack(plan: "p5")
        case .pack10: return .pack(plan: "p10")
        case .pack50: return .pack(plan: "p50")
        case .pack100: return .pack(plan: "p100")
        default: return nil
        }
    }
}

extension Store.Failure {
    /// What to tell the person.
    var message: String {
        switch self {
        case .unavailable: tr("iap.unavailable")
        case .store: tr("buyError")
        case .server(.offline): tr("common.offline")
        case .server(.tooLarge): tr("storageTooSmall")
        case .server: tr("iap.serverError")
        }
    }
}

/// "Pay {price} …" labels and the "/ month" price of a space plan, from the store's own prices.
enum IAPText {
    static func perMonth(_ price: String) -> String { "\(price) / \(tr("storageMonth"))" }
}
