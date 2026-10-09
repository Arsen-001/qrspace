package co.qrspace.app

import co.qrspace.app.data.Look
import co.qrspace.app.data.Payload
import co.qrspace.app.data.Pricing
import co.qrspace.app.data.Storage
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/** Expected values come from the site's own functions (src/lib/qr/payload.ts, src/lib/pricing.ts) run with node. */
class PayloadTest {
    private fun b(type: String, vararg f: Pair<String, String>) = Payload.build(type, mapOf(*f))

    @Test fun urlAndText() {
        assertEquals("https://qrspace.co/market", b("url", "url" to "qrspace.co/market"))
        assertEquals(" Hello, мир ", b("text", "text" to " Hello, мир "))
    }

    @Test fun wifiEscapes() {
        assertEquals("WIFI:T:WPA;S:Home\\;Net;P:p\\:a\\\"ss;;", b("wifi", "ssid" to "Home;Net", "password" to "p:a\"ss", "security" to "WPA"))
        assertEquals("WIFI:T:nopass;S:Cafe;;", b("wifi", "ssid" to "Cafe", "security" to "nopass"))
    }

    @Test fun phoneMessengers() {
        assertEquals("tel:+37491123456", b("phone", "phone" to "+374 91 12-34-56"))
        assertEquals("https://wa.me/37499123456?text=Hi%20there!%20(test)%20~ok'", b("whatsapp", "phone" to "+374 99 123456", "message" to "Hi there! (test) ~ok'"))
        assertEquals("https://t.me/qrspace", b("telegram", "username" to "@qrspace"))
        assertEquals("SMSTO:+374911:Call me", b("sms", "phone" to "+374 91 1", "message" to "Call me"))
        assertEquals("viber://chat?number=%2B374911", b("viber", "phone" to "374 91 1"))
    }

    @Test fun email() {
        assertEquals("mailto:a@b.co?subject=Hello%20world%2B1&body=Line%20%26%20more", b("email", "email" to "a@b.co", "subject" to "Hello world+1", "body" to "Line & more"))
    }

    @Test fun contactCard() {
        assertEquals(
            "BEGIN:VCARD\nVERSION:3.0\nN:P\\;K;Arman;;;\nFN:Arman P\\;K\nTEL;TYPE=CELL:+374911\nEMAIL:a@b.co\nORG:QR\\, Space\nURL:https://qrspace.co\nEND:VCARD",
            b("contact", "firstName" to "Arman", "lastName" to "P;K", "phone" to "+374 (91) 1", "email" to "a@b.co", "company" to "QR, Space", "website" to "qrspace.co"),
        )
    }

    @Test fun locationAndEvent() {
        assertEquals("https://maps.google.com/?q=40.1811,44.5136", b("location", "place" to "40.1811, 44.5136"))
        assertEquals("https://maps.google.com/?q=Yerevan%2C%20Northern%20Ave%201", b("location", "place" to "Yerevan, Northern Ave 1"))
        assertEquals(
            "BEGIN:VEVENT\nSUMMARY:Party\nDTSTART:20261010T183000\nDTEND:20261010T220000\nLOCATION:Home\nDESCRIPTION:Bring cake\nEND:VEVENT",
            b("event", "title" to "Party", "start" to "2026-10-10T18:30", "end" to "2026-10-10T22:00", "place" to "Home", "notes" to "Bring cake"),
        )
    }

    @Test fun social() {
        assertEquals("https://instagram.com/qr.space", b("instagram", "username" to "@qr.space"))
        assertEquals("https://x.com/qr", b("x", "username" to "https://x.com/qr"))
    }

    @Test fun emptyMainFieldGivesNothing() {
        assertEquals("", b("url"))
        assertEquals("", b("wifi", "security" to "WPA"))
        assertFalse(Payload.valid("phone", mapOf("phone" to "")))
        assertTrue(Payload.valid("text", mapOf("text" to "hi")))
    }

    @Test fun titles() {
        assertEquals("qrspace.co/market", Payload.titleOf("url", mapOf("url" to "https://qrspace.co/market")))
        assertEquals("Arman P;K", Payload.titleOf("contact", mapOf("firstName" to "Arman", "lastName" to "P;K")))
        assertEquals("Cafe", Payload.titleOf("wifi", mapOf("ssid" to "Cafe", "security" to "nopass")))
    }

    @Test fun priceKeyMatchesTheSite() {
        assertEquals(
            """{"fg":"#111111","bg":"#ffffff","eyeColor":"#111111","dot":"square","eye":"square","eyeBall":"auto","eyeBallColor":"#111111","gradient":null,"rotate":0,"effect":"none","texture":null,"eyeIcon":null,"logo":null,"picture":null}""",
            Look().toJson().toString(),
        )
        assertEquals("g:177jguq1xa1kwo", Pricing.codeKey("https://qrspace.co", Look().toJson().toString()))
        val sunset = Look.PRESETS.first { it.first == "gradient" }.second
        assertEquals("g:9vh9kzvltmhd", Pricing.codeKey(Payload.build("text", mapOf("text" to "Привет")), sunset.toJson().toString()))
    }

    @Test fun tiers() {
        assertEquals("simple", Pricing.tierOf(Look()))
        assertEquals("styled", Pricing.tierOf(Look.PRESETS.first { it.first == "gradient" }.second))
        assertEquals("styled", Pricing.tierOf(Look.PRESETS.first { it.first == "raised" }.second))
        assertEquals("simple", Pricing.tierOf(Look.PRESETS.first { it.first == "dots" }.second))
    }

    @Test fun roomPlans() {
        assertNull(Storage.planFor(500_000))
        assertEquals("s10", Storage.planFor(2L * 1024 * 1024)?.id)
        assertEquals("s100", Storage.planFor(230L * 1024 * 1024 / 4)?.id)
        assertEquals("s1000", Storage.planFor(230L * 1024 * 1024)?.id)
        assertNull(Storage.planFor(2L * 1024 * 1024 * 1024))
    }
}
