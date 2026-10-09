package co.qrspace.app.billing

import android.app.Activity
import android.content.Context
import android.content.ContextWrapper
import androidx.core.content.edit
import co.qrspace.app.BuildConfig
import co.qrspace.app.R
import co.qrspace.app.data.Api
import co.qrspace.app.data.ApiException
import co.qrspace.app.data.Session
import com.android.billingclient.api.BillingClient
import com.android.billingclient.api.BillingClient.BillingResponseCode
import com.android.billingclient.api.BillingClientStateListener
import com.android.billingclient.api.BillingFlowParams
import com.android.billingclient.api.BillingResult
import com.android.billingclient.api.PendingPurchasesParams
import com.android.billingclient.api.ProductDetails
import com.android.billingclient.api.Purchase
import com.android.billingclient.api.PurchasesUpdatedListener
import com.android.billingclient.api.QueryProductDetailsParams
import com.android.billingclient.api.QueryPurchasesParams
import com.android.billingclient.api.queryProductDetails
import com.android.billingclient.api.queryPurchasesAsync
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeoutOrNull
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonObject

/** How a purchase ended, for the screen that started it. */
sealed interface BuyResult {
    /** Paid and credited by the server — reload and carry on (create the code, share the picture, upload). */
    data object Done : BuyResult
    /** Google Play waits for the money (e.g. cash at a shop) — credited when it arrives (next resume / start). */
    data object Pending : BuyResult
    data object Cancelled : BuyResult
    /** No Google Play on this device, or the product isn't in the store (yet). */
    data object Unavailable : BuyResult
    /** Didn't go through; [status] — the server's answer (403 not your code, 413 doesn't fit…), null — Google or offline. */
    data class Failed(val status: Int?) : BuyResult
}

/** What to tell the person after [BuyResult]; null — nothing (done, or they cancelled). */
fun BuyResult.message(): Int? = when (this) {
    BuyResult.Done, BuyResult.Cancelled -> null
    BuyResult.Pending -> R.string.iap_pending
    BuyResult.Unavailable -> R.string.iap_unavailable
    is BuyResult.Failed -> when (status) {
        403 -> R.string.up_owner_only
        413 -> R.string.storage_full
        401 -> R.string.login_to_create
        else -> R.string.iap_failed
    }
}

/** The activity Google Play's purchase sheet opens over. */
fun Context.activity(): Activity? = generateSequence(this) { (it as? ContextWrapper)?.baseContext }.filterIsInstance<Activity>().firstOrNull()

/**
 * Google Play Billing (one-time consumable products, billing/Products.kt). Prices come from the store, localized for the
 * person. A purchase goes to the server (POST /api/iap) with what it's for; the server checks it with Google, credits
 * it once and consumes it — the app never consumes or acknowledges. Purchases the server hasn't credited yet (a payment
 * that was pending, the app closed mid-way, offline) are sent again on every resume, with the intent saved before the
 * purchase sheet opened (or the one Google keeps in obfuscatedProfileId). Without Google Play (emulator images, some
 * phones) or before the owner creates the products in Play Console — [state] Unavailable, the screens say so.
 * Debug builds with -PfakeStore=true: example prices and the site's demo payments, for testing the screens locally.
 */
class Store(private val context: Context, private val api: Api, private val session: Session) : PurchasesUpdatedListener {
    enum class State { Off, Loading, Ready, Unavailable }

    private val _state = MutableStateFlow(if (BuildConfig.PURCHASES_ENABLED) State.Loading else State.Off)
    val state: StateFlow<State> = _state

    private val _prices = MutableStateFlow<Map<String, String>>(emptyMap())
    /** productId → the store's price for this person ("$0.99", "390 ֏"). Missing — can't be bought right now. */
    val prices: StateFlow<Map<String, String>> = _prices

    private val details = mutableMapOf<String, ProductDetails>()
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)
    private val connecting = Mutex()
    private val sending = Mutex()
    private val intents = context.getSharedPreferences("iap-intents", Context.MODE_PRIVATE)
    @Volatile private var flow: CompletableDeferred<Pair<BillingResult, List<Purchase>>>? = null

    private val client: BillingClient by lazy {
        BillingClient.newBuilder(context)
            .setListener(this)
            .enablePendingPurchases(PendingPurchasesParams.newBuilder().enableOneTimeProducts().build())
            .enableAutoServiceReconnection()
            .build()
    }

    /** Connect, load the prices (until they load once), send purchases the server hasn't credited. Every app resume. */
    suspend fun start() {
        if (!BuildConfig.PURCHASES_ENABLED) return
        if (BuildConfig.FAKE_STORE) {
            _prices.value = FAKE_PRICES
            _state.value = State.Ready
            return
        }
        connecting.withLock {
            if (!connect()) {
                if (_prices.value.isEmpty()) _state.value = State.Unavailable
                return
            }
            if (_prices.value.isEmpty()) loadPrices()
        }
        resume()
    }

    private suspend fun connect(): Boolean {
        if (client.isReady) return true
        val done = CompletableDeferred<Boolean>()
        val started = runCatching {
            client.startConnection(object : BillingClientStateListener {
                override fun onBillingSetupFinished(r: BillingResult) {
                    done.complete(r.responseCode == BillingResponseCode.OK)
                }
                override fun onBillingServiceDisconnected() {
                    done.complete(false)
                }
            })
        }.isSuccess
        return started && (withTimeoutOrNull(10_000) { done.await() } ?: false)
    }

    private suspend fun loadPrices() {
        val params = QueryProductDetailsParams.newBuilder().setProductList(
            Products.ALL.map {
                QueryProductDetailsParams.Product.newBuilder().setProductId(it).setProductType(BillingClient.ProductType.INAPP).build()
            },
        ).build()
        val r = runCatching { client.queryProductDetails(params) }.getOrNull()
        val list = if (r?.billingResult?.responseCode == BillingResponseCode.OK) r.productDetailsList.orEmpty() else emptyList()
        details.clear()
        list.forEach { details[it.productId] = it }
        _prices.value = list.mapNotNull { d -> d.oneTimePurchaseOfferDetails?.formattedPrice?.let { d.productId to it } }.toMap()
        _state.value = if (_prices.value.isEmpty()) State.Unavailable else State.Ready
    }

    /** Buy what [b] needs: Google Play's sheet, then the server credits it. Suspends until it's over. */
    suspend fun buy(activity: Activity?, b: Buy): BuyResult {
        if (!BuildConfig.PURCHASES_ENABLED || activity == null) return BuyResult.Unavailable
        val pid = Products.productOf(b) ?: return BuyResult.Unavailable
        val me = session.me.value?.me ?: return BuyResult.Failed(401)
        if (BuildConfig.FAKE_STORE) return fakeBuy(b)
        if (!connecting.withLock { connect() }) return BuyResult.Unavailable
        // Bought before but not credited (the app closed, the server refused it for another code…): use that one.
        owned(pid, me)?.let { return reuse(it, pid, b) }
        val d = details[pid] ?: return BuyResult.Unavailable
        val offer = d.oneTimePurchaseOfferDetails ?: return BuyResult.Unavailable
        save(pid, b)
        val params = BillingFlowParams.newBuilder()
            .setProductDetailsParamsList(
                listOf(BillingFlowParams.ProductDetailsParams.newBuilder().setProductDetails(d).apply { offer.offerToken?.let { setOfferToken(it) } }.build()),
            )
            .setObfuscatedAccountId(Products.accountId(me))
            .apply { Products.tag(b)?.let { setObfuscatedProfileId(it) } }
            .build()
        val wait = CompletableDeferred<Pair<BillingResult, List<Purchase>>>()
        flow = wait
        val launched = withContext(Dispatchers.Main) { client.launchBillingFlow(activity, params) }
        val (res, list) = if (launched.responseCode == BillingResponseCode.OK) wait.await() else { flow = null; launched to emptyList() }
        return when (res.responseCode) {
            BillingResponseCode.OK -> {
                val p = list.firstOrNull { pid in it.products } ?: return BuyResult.Failed(null)
                if (p.purchaseState == Purchase.PurchaseState.PENDING) BuyResult.Pending else send(p, pid, b).first
            }
            BillingResponseCode.USER_CANCELED -> { forget(pid); BuyResult.Cancelled }
            BillingResponseCode.ITEM_ALREADY_OWNED -> owned(pid, me)?.let { reuse(it, pid, b) } ?: BuyResult.Failed(null)
            BillingResponseCode.BILLING_UNAVAILABLE, BillingResponseCode.ITEM_UNAVAILABLE,
            BillingResponseCode.FEATURE_NOT_SUPPORTED, BillingResponseCode.SERVICE_UNAVAILABLE -> { forget(pid); BuyResult.Unavailable }
            else -> BuyResult.Failed(null)
        }
    }

    /**
     * An unconsumed purchase of the same product pays for [b] instead of a new one. 409 here means the server already
     * credited that purchase to something else (and should have consumed it) — [b] is not paid, so not "done".
     */
    private suspend fun reuse(p: Purchase, pid: String, b: Buy): BuyResult = when {
        p.purchaseState == Purchase.PurchaseState.PENDING -> BuyResult.Pending
        else -> send(p, pid, b).let { (r, status) -> if (status == 409) BuyResult.Failed(409) else r }
    }

    /** This person's purchase of [pid] the server hasn't consumed yet (bought or still pending). */
    private suspend fun owned(pid: String, me: String): Purchase? = purchases().firstOrNull { p ->
        pid in p.products && !p.isAcknowledged && p.accountIdentifiers?.obfuscatedAccountId.let { it == null || it == Products.accountId(me) }
    }

    private suspend fun purchases(): List<Purchase> {
        if (!client.isReady) return emptyList()
        val r = runCatching { client.queryPurchasesAsync(QueryPurchasesParams.newBuilder().setProductType(BillingClient.ProductType.INAPP).build()) }.getOrNull()
        return if (r?.billingResult?.responseCode == BillingResponseCode.OK) r.purchasesList.orEmpty() else emptyList()
    }

    /** Purchases Google has and the server hasn't credited: a pending payment that went through, the app closed mid-way. */
    suspend fun resume() {
        if (!BuildConfig.PURCHASES_ENABLED || BuildConfig.FAKE_STORE || flow != null) return
        val me = session.me.value?.me ?: return
        var any = false
        for (p in purchases()) {
            if (p.purchaseState != Purchase.PurchaseState.PURCHASED || p.isAcknowledged) continue
            // Bought while someone else was signed in on this phone — theirs to credit.
            if (p.accountIdentifiers?.obfuscatedAccountId.let { it != null && it != Products.accountId(me) }) continue
            val pid = p.products.firstOrNull() ?: continue
            val b = saved(pid) ?: Products.fromTag(pid, p.accountIdentifiers?.obfuscatedProfileId) ?: continue
            if (send(p, pid, b).first == BuyResult.Done) any = true
        }
        if (any) session.changed()
    }

    /** POST /api/iap; the result and the server's status (null — no answer). */
    private suspend fun send(p: Purchase, pid: String, b: Buy): Pair<BuyResult, Int?> = sending.withLock {
        val status = try {
            api.iap(pid, p.purchaseToken, Products.intentJson(b))
            200
        } catch (e: ApiException) {
            e.code
        } catch (_: Exception) {
            null
        }
        val r = when (Products.outcome(status)) {
            Products.Outcome.Done -> { forget(pid); BuyResult.Done }
            Products.Outcome.Retry -> { save(pid, b); BuyResult.Failed(status) }
            Products.Outcome.Drop -> { forget(pid); BuyResult.Failed(status) }
        }
        r to status
    }

    override fun onPurchasesUpdated(result: BillingResult, purchases: List<Purchase>?) {
        val f = flow
        if (f != null) {
            flow = null
            f.complete(result to purchases.orEmpty())
        } else {
            // Not from a sheet we opened: a pending payment went through while the app is open.
            scope.launch { resume() }
        }
    }

    private fun save(pid: String, b: Buy) = intents.edit { putString(pid, Products.intentJson(b).toString()) }
    private fun forget(pid: String) = intents.edit { remove(pid) }
    private fun saved(pid: String): Buy? = intents.getString(pid, null)
        ?.let { runCatching { Products.fromJson(Json.parseToJsonElement(it).jsonObject) }.getOrNull() }
        ?.takeIf { Products.matches(pid, it) }

    /** Debug + -PfakeStore=true: the site's demo payments (no Google Play, no money) to test the screens. */
    private suspend fun fakeBuy(b: Buy): BuyResult = try {
        when (b) {
            is Buy.Code -> api.pay(b.key, b.tier)
            is Buy.Pack -> api.demoPack(b.plan)
            is Buy.Space -> api.buyStorage(b.code, b.plan)
        }
        BuyResult.Done
    } catch (e: ApiException) {
        BuyResult.Failed(e.code)
    } catch (_: Exception) {
        BuyResult.Failed(null)
    }

    private companion object {
        /** Roughly the owner's planned prices (README) — only the debug fake store shows them. */
        val FAKE_PRICES = mapOf(
            Products.CODE to "$0.99",
            "co.qrspace.pack5" to "$3.99", "co.qrspace.pack10" to "$6.99", "co.qrspace.pack50" to "$32.99", "co.qrspace.pack100" to "$59.99",
            "co.qrspace.space10.month" to "$0.99", "co.qrspace.space100.month" to "$2.99", "co.qrspace.space1000.month" to "$8.99",
        )
    }
}
