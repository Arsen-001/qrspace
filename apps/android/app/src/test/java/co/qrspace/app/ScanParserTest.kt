package co.qrspace.app

import co.qrspace.app.scan.CodeFormat
import co.qrspace.app.scan.Scan
import co.qrspace.app.scan.ScanParser
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class ScanParserTest {
    @Test fun ourCodeLink() {
        val s = ScanParser.parse("https://qrspace.co/c/7sTB4trr") as Scan.Ours
        assertEquals("7sTB4trr", s.id)
    }

    @Test fun ourCompactShortLink() {
        val s = ScanParser.parse("HTTPS://QRSPACE.CO/K/BMTGV5") as Scan.Ours
        assertEquals("BMTGV5", s.short)
        assertEquals(null, s.id)
    }

    @Test fun ourSiteButNotCodeIsLink() {
        assertTrue(ScanParser.parse("https://qrspace.co/market") is Scan.Link)
    }

    @Test fun foreignLink() {
        val s = ScanParser.parse("www.example.com/menu") as Scan.Link
        assertEquals("https://www.example.com/menu", s.url)
    }

    @Test fun wifiWithEscapes() {
        val s = ScanParser.parse("WIFI:T:WPA;S:My\\;Net;P:pa\\:ss;H:true;;") as Scan.Wifi
        assertEquals("My;Net", s.ssid)
        assertEquals("pa:ss", s.password)
        assertEquals("WPA", s.security)
        assertTrue(s.hidden)
    }

    @Test fun wifiOpen() {
        val s = ScanParser.parse("WIFI:S:Cafe;;") as Scan.Wifi
        assertEquals("nopass", s.security)
    }

    @Test fun vcard() {
        val s = ScanParser.parse("BEGIN:VCARD\nVERSION:3.0\nN:Petrosyan;Arman\nTEL;TYPE=CELL:+37499123456\nEMAIL:a@b.am\nORG:QR Space\nEND:VCARD") as Scan.Contact
        assertEquals("Arman Petrosyan", s.name)
        assertEquals(listOf("+37499123456"), s.phones)
        assertEquals("QR Space", s.org)
    }

    @Test fun mecard() {
        val s = ScanParser.parse("MECARD:N:Doe,John;TEL:123;EMAIL:j@d.com;;") as Scan.Contact
        assertEquals("John Doe", s.name)
    }

    @Test fun smsAndMail() {
        val sms = ScanParser.parse("SMSTO:+374991:Hello: there") as Scan.Sms
        assertEquals("+374991", sms.number)
        assertEquals("Hello: there", sms.body)
        val mail = ScanParser.parse("mailto:hi@qrspace.co?subject=Hi%20there&body=x") as Scan.Email
        assertEquals("hi@qrspace.co", mail.to)
        assertEquals("Hi there", mail.subject)
    }

    @Test fun geo() {
        val g = ScanParser.parse("geo:40.1792,44.4991?q=Yerevan") as Scan.Geo
        assertEquals(40.1792, g.lat!!, 1e-6)
        assertEquals("Yerevan", g.query)
    }

    @Test fun barcode() {
        val p = ScanParser.parse("4006381333931", CodeFormat.EAN_13) as Scan.Product
        assertEquals(CodeFormat.EAN_13, p.format)
    }

    @Test fun text() {
        assertTrue(ScanParser.parse("hello world") is Scan.Text)
    }
}
