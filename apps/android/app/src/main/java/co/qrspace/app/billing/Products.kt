package co.qrspace.app.billing

import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put
import java.security.MessageDigest

/**
 * What a Google Play purchase is for — the "intent" the server credits (POST /api/iap, src/lib/iap.ts):
 * a code by its payment key (then /api/codes/quick as before), a pack of codes, or a month of space for one code.
 */
sealed interface Buy {
    /** [key] — the payment key (`g:…` from Pricing.codeKey, or `code:{id}` for a memory code's picture). */
    data class Code(val key: String, val tier: String) : Buy
    data class Pack(val plan: String) : Buy
    data class Space(val code: String, val plan: String) : Buy
}

/**
 * Google Play one-time products (all consumable; the owner creates them in Play Console with these ids) and how they
 * map to what the server gives. Same table as the server's IAP_PRODUCTS; the server consumes a purchase after it
 * checks it with Google — the app never consumes or acknowledges.
 */
object Products {
    const val CODE = "co.qrspace.code"
    /** Pack plan (src/lib/packs.ts) → product, and how many codes it holds. */
    val PACKS: Map<String, String> = linkedMapOf(
        "p5" to "co.qrspace.pack5", "p10" to "co.qrspace.pack10", "p50" to "co.qrspace.pack50", "p100" to "co.qrspace.pack100",
    )
    val PACK_CODES: Map<String, Int> = mapOf("p5" to 5, "p10" to 10, "p50" to 50, "p100" to 100)
    /** Space plan (Storage.PLANS) → product: one month of that much space for ONE code; buyable again. */
    val SPACE: Map<String, String> = linkedMapOf(
        "s10" to "co.qrspace.space10.month", "s100" to "co.qrspace.space100.month", "s1000" to "co.qrspace.space1000.month",
    )
    val ALL: List<String> = listOf(CODE) + PACKS.values + SPACE.values

    private val TIERS = setOf("simple", "styled")
    /** The server's key check: `g:…` or `code:…`, word characters and dashes, 1–40 after the prefix. */
    private val KEY = Regex("^(g|code):[\\w-]{1,40}$")

    /** The product that pays for [b]; null — nothing in the store sells it (unknown plan, bad key or tier). */
    fun productOf(b: Buy): String? = when (b) {
        is Buy.Code -> CODE.takeIf { b.tier in TIERS && KEY.matches(b.key) }
        is Buy.Pack -> PACKS[b.plan]
        is Buy.Space -> SPACE[b.plan]?.takeIf { b.code.isNotBlank() }
    }

    /** Does this product pay for this intent — the server's matches(productId, intent). */
    fun matches(productId: String, b: Buy): Boolean = productOf(b) == productId

    /** The intent as POST /api/iap expects it. */
    fun intentJson(b: Buy): JsonObject = buildJsonObject {
        when (b) {
            is Buy.Code -> { put("kind", "code"); put("key", b.key); put("tier", b.tier) }
            is Buy.Pack -> { put("kind", "pack"); put("plan", b.plan) }
            is Buy.Space -> { put("kind", "space"); put("code", b.code); put("plan", b.plan) }
        }
    }

    fun fromJson(o: JsonObject): Buy? {
        fun s(k: String) = runCatching { o[k]?.jsonPrimitive?.contentOrNull }.getOrNull()
        return when (s("kind")) {
            "code" -> Buy.Code(s("key") ?: return null, s("tier") ?: return null)
            "pack" -> Buy.Pack(s("plan") ?: return null)
            "space" -> Buy.Space(s("code") ?: return null, s("plan") ?: return null)
            else -> null
        }
    }

    /**
     * The intent squeezed into Play's obfuscatedProfileId (at most 64 characters), stored by Google with the purchase:
     * a purchase that finishes after a reinstall or on another phone can still be sent with the right intent.
     */
    fun tag(b: Buy): String? = when (b) {
        is Buy.Code -> "c|${b.tier}|${b.key}"
        is Buy.Pack -> "p|${b.plan}"
        is Buy.Space -> "s|${b.plan}|${b.code}"
    }.takeIf { it.length <= 64 }

    /** Back from [tag]; a pack needs no tag (its product says the plan). Only intents [productId] actually pays for. */
    fun fromTag(productId: String, tag: String?): Buy? {
        val p = tag?.split('|')
        val b = when {
            p != null && p.size == 3 && p[0] == "c" -> Buy.Code(p[2], p[1])
            p != null && p.size == 3 && p[0] == "s" -> Buy.Space(p[2], p[1])
            p != null && p.size == 2 && p[0] == "p" -> Buy.Pack(p[1])
            else -> PACKS.entries.firstOrNull { it.value == productId }?.let { Buy.Pack(it.key) }
        }
        return b?.takeIf { matches(productId, it) }
    }

    /** Play's obfuscatedAccountId: SHA-256 of our user id, hex (64 characters) — never the id itself. */
    fun accountId(userId: String): String =
        MessageDigest.getInstance("SHA-256").digest(userId.toByteArray()).joinToString("") { "%02x".format(it) }

    /** What the app does with the server's answer to POST /api/iap (status; null — no answer, e.g. offline). */
    enum class Outcome {
        /** Credited now (200, the server consumed it) or before (409): forget the local intent, reload. */
        Done,
        /** Not now — send again on the next start (offline, 5xx, 401 not signed in, 402 not verified yet). */
        Retry,
        /**
         * Not for this intent (400, 422; space: 403 not your code, 404 no such code, 413 doesn't fit — checked before
         * Google, nothing consumed): show the error, forget the intent. The purchase stays unconsumed: the next purchase
         * of the same product uses it instead of charging again; unused, Google refunds it after 3 days.
         */
        Drop,
    }

    fun outcome(status: Int?): Outcome = when (status) {
        200, 409 -> Outcome.Done
        400, 403, 404, 413, 422 -> Outcome.Drop
        else -> Outcome.Retry
    }
}
