package co.qrspace.app

import co.qrspace.app.billing.Buy
import co.qrspace.app.billing.Products
import co.qrspace.app.billing.Products.Outcome
import co.qrspace.app.data.Look
import co.qrspace.app.data.Pricing
import co.qrspace.app.data.Storage
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Assume.assumeTrue
import org.junit.Test
import java.io.File

/** Google Play products ↔ what the server credits (POST /api/iap, src/lib/iap.ts). */
class BillingProductsTest {
    private val key = Pricing.codeKey("https://qrspace.co", Look().toJson().toString())

    @Test fun productForEachIntent() {
        assertEquals("co.qrspace.code", Products.productOf(Buy.Code(key, "simple")))
        assertEquals("co.qrspace.code", Products.productOf(Buy.Code("code:c_9xYz-1", "styled")))
        assertEquals("co.qrspace.pack5", Products.productOf(Buy.Pack("p5")))
        assertEquals("co.qrspace.pack100", Products.productOf(Buy.Pack("p100")))
        assertEquals("co.qrspace.space10.month", Products.productOf(Buy.Space("abc", "s10")))
        assertEquals("co.qrspace.space1000.month", Products.productOf(Buy.Space("abc", "s1000")))
    }

    @Test fun nothingSellsBadIntents() {
        assertNull(Products.productOf(Buy.Code(key, "gold")))
        assertNull(Products.productOf(Buy.Code("x:abc", "simple")))
        assertNull(Products.productOf(Buy.Code("g:" + "a".repeat(41), "simple")))
        assertNull(Products.productOf(Buy.Code("g:a b", "simple")))
        assertNull(Products.productOf(Buy.Pack("p7")))
        assertNull(Products.productOf(Buy.Space("abc", "s5")))
        assertNull(Products.productOf(Buy.Space("", "s10")))
    }

    @Test fun everyStoragePlanAndPackHasAProduct() {
        Storage.PLANS.forEach { assertNotNull(it.id, Products.SPACE[it.id]) }
        assertEquals(setOf("p5", "p10", "p50", "p100"), Products.PACKS.keys)
        assertEquals(Products.PACKS.keys, Products.PACK_CODES.keys)
        assertEquals(8, Products.ALL.toSet().size)
    }

    @Test fun matchesLikeTheServer() {
        assertTrue(Products.matches("co.qrspace.code", Buy.Code(key, "styled")))
        assertFalse(Products.matches("co.qrspace.code", Buy.Pack("p5")))
        assertFalse(Products.matches("co.qrspace.pack10", Buy.Pack("p5")))
        assertFalse(Products.matches("co.qrspace.space100.month", Buy.Space("abc", "s10")))
        assertFalse(Products.matches("co.qrspace.unknown", Buy.Pack("p5")))
    }

    @Test fun intentJsonIsWhatTheServerReads() {
        assertEquals("""{"kind":"code","key":"$key","tier":"simple"}""", Products.intentJson(Buy.Code(key, "simple")).toString())
        assertEquals("""{"kind":"pack","plan":"p50"}""", Products.intentJson(Buy.Pack("p50")).toString())
        assertEquals("""{"kind":"space","code":"c1","plan":"s100"}""", Products.intentJson(Buy.Space("c1", "s100")).toString())
        listOf(Buy.Code(key, "styled"), Buy.Pack("p10"), Buy.Space("c1", "s10")).forEach { b ->
            assertEquals(b, Products.fromJson(Json.parseToJsonElement(Products.intentJson(b).toString()).jsonObject))
        }
        assertNull(Products.fromJson(Json.parseToJsonElement("""{"kind":"gift"}""").jsonObject))
    }

    @Test fun tagCarriesTheIntentWithinPlaysLimit() {
        val longest = listOf(Buy.Code("code:" + "x".repeat(40), "styled"), Buy.Space("y".repeat(40), "s1000"), Buy.Pack("p100"))
        longest.forEach { b ->
            val t = Products.tag(b)
            assertNotNull(t)
            assertTrue(t!!.length <= 64)
            assertEquals(b, Products.fromTag(Products.productOf(b)!!, t))
        }
        // A pack needs no tag; a tag for another product is ignored.
        assertEquals(Buy.Pack("p50"), Products.fromTag("co.qrspace.pack50", null))
        assertNull(Products.fromTag("co.qrspace.code", null))
        assertNull(Products.fromTag("co.qrspace.pack5", "p|p10"))
        assertNull(Products.fromTag("co.qrspace.space10.month", "s|s100|abc"))
    }

    @Test fun accountIdIsSha256Hex() {
        val id = Products.accountId("arman")
        assertEquals("e644df618fef9fdd44dd7f26f1077051e49538f1b70603631cdf0de7c69fb469", id) // python hashlib
        assertEquals(64, id.length)
    }

    @Test fun serverAnswers() {
        assertEquals(Outcome.Done, Products.outcome(200))
        assertEquals(Outcome.Done, Products.outcome(409))
        listOf(null, 401, 402, 429, 500, 503).forEach { assertEquals("$it", Outcome.Retry, Products.outcome(it)) }
        listOf(400, 403, 404, 413, 422).forEach { assertEquals("$it", Outcome.Drop, Products.outcome(it)) }
    }

    /** The server's catalog (src/lib/iap.ts IAP_PRODUCTS) — same products, same grants. Skipped outside the monorepo. */
    @Test fun sameCatalogAsTheServer() {
        val f = generateSequence(File("").absoluteFile) { it.parentFile }.map { File(it, "src/lib/iap.ts") }.firstOrNull { it.isFile }
        assumeTrue("src/lib/iap.ts not found", f != null)
        val rows = Regex(""""(co\.qrspace\.[\w.]+)":\s*\{\s*kind:\s*"(\w+)"(?:,\s*plan:\s*"(\w+)")?""").findAll(f!!.readText())
            .associate { m -> m.groupValues[1] to (m.groupValues[2] to m.groupValues[3]) }
        assertEquals(Products.ALL.toSet(), rows.keys)
        rows.forEach { (pid, grant) ->
            val (kind, plan) = grant
            val b = when (kind) {
                "code" -> Buy.Code(key, "simple")
                "pack" -> Buy.Pack(plan)
                else -> Buy.Space("abc", plan)
            }
            assertTrue("$pid ↔ $kind $plan", Products.matches(pid, b))
        }
    }

    @Test fun ourKeysPassTheServersCheck() {
        assertNotNull(Products.productOf(Buy.Code(key, "simple")))
        assertNotNull(Products.productOf(Buy.Code("code:" + "k".repeat(40), "simple")))
    }
}
