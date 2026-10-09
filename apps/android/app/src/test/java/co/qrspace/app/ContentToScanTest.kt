package co.qrspace.app

import co.qrspace.app.data.Content
import co.qrspace.app.scan.Scan
import co.qrspace.app.scan.toScan
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/** "What's in the code" from the web generator (src/lib/qr/payload.ts FIELDS) → the scan result card. */
class ContentToScanTest {
    @Test fun urlGetsScheme() {
        val s = Content("url", mapOf("url" to "qrspace.co/market")).toScan() as Scan.Link
        assertEquals("https://qrspace.co/market", s.url)
    }

    @Test fun wifi() {
        val s = Content("wifi", mapOf("ssid" to "Home", "password" to "pw", "security" to "WPA")).toScan() as Scan.Wifi
        assertEquals("Home", s.ssid)
        assertEquals("pw", s.password)
    }

    @Test fun contactName() {
        val s = Content("contact", mapOf("firstName" to "Arman", "lastName" to "P", "phone" to "+374")).toScan() as Scan.Contact
        assertEquals("Arman P", s.name)
        assertEquals(listOf("+374"), s.phones)
    }

    @Test fun whatsappAndSocial() {
        assertEquals("https://wa.me/37499123456", (Content("whatsapp", mapOf("phone" to "+374 99 123456")).toScan() as Scan.Link).url)
        assertEquals("https://instagram.com/qrspace", (Content("instagram", mapOf("username" to "@qrspace")).toScan() as Scan.Link).url)
    }

    @Test fun textAndLocation() {
        assertTrue(Content("text", mapOf("text" to "hi")).toScan() is Scan.Text)
        assertEquals("Yerevan", (Content("location", mapOf("place" to "Yerevan")).toScan() as Scan.Geo).query)
    }
}
