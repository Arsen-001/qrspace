package co.qrspace.app.scan

import java.net.URI
import java.net.URLDecoder

/** Symbology of a scanned code (our own enum so the parser has no Android/ML Kit dependency). */
enum class CodeFormat(val label: String, val linear: Boolean) {
    QR("QR", false),
    AZTEC("Aztec", false),
    DATA_MATRIX("Data Matrix", false),
    PDF417("PDF417", false),
    EAN_13("EAN-13", true),
    EAN_8("EAN-8", true),
    UPC_A("UPC-A", true),
    UPC_E("UPC-E", true),
    CODE_128("Code 128", true),
    CODE_39("Code 39", true),
    CODE_93("Code 93", true),
    ITF("ITF", true),
    CODABAR("Codabar", true),
    UNKNOWN("?", false),
}

/** What a scanned value means and which actions it gets. */
sealed interface Scan {
    val raw: String

    /** Our printed code: https://qrspace.co/c/{id} or /K/{short}. */
    data class Ours(override val raw: String, val id: String?, val short: String?) : Scan
    data class Link(override val raw: String, val url: String) : Scan
    data class Wifi(override val raw: String, val ssid: String, val password: String, val security: String, val hidden: Boolean) : Scan
    data class Phone(override val raw: String, val number: String) : Scan
    data class Email(override val raw: String, val to: String, val subject: String, val body: String) : Scan
    data class Sms(override val raw: String, val number: String, val body: String) : Scan
    data class Contact(
        override val raw: String,
        val name: String,
        val phones: List<String>,
        val emails: List<String>,
        val org: String,
        val url: String,
    ) : Scan
    data class Geo(override val raw: String, val lat: Double?, val lon: Double?, val query: String) : Scan
    data class Event(override val raw: String, val title: String, val start: String, val place: String) : Scan
    data class Text(override val raw: String) : Scan
    /** 1D barcode (product number, ticket, parcel…). */
    data class Product(override val raw: String, val format: CodeFormat) : Scan
}

object ScanParser {
    /** Hosts that serve our codes. qrspace-one.vercel.app printed codes on 08.10.2026, before the domain. */
    val OUR_HOSTS = setOf("qrspace.co", "www.qrspace.co", "qrspace-one.vercel.app")
    private val OUR_PATH = Regex("^/(c|K|k)/([A-Za-z0-9]+)/?$")

    fun parse(raw: String, format: CodeFormat = CodeFormat.QR): Scan {
        val s = raw.trim()
        ours(s)?.let { return it }
        if (format.linear && !looksLikeUrl(s)) return Scan.Product(s, format)
        val upper = s.uppercase()
        return when {
            upper.startsWith("WIFI:") -> wifi(s)
            upper.startsWith("BEGIN:VCARD") -> vcard(s)
            upper.startsWith("MECARD:") -> mecard(s)
            upper.startsWith("BEGIN:VEVENT") || upper.startsWith("BEGIN:VCALENDAR") -> event(s)
            upper.startsWith("TEL:") -> Scan.Phone(s, s.substring(4).trim())
            upper.startsWith("MAILTO:") -> mailto(s)
            upper.startsWith("MATMSG:") -> matmsg(s)
            upper.startsWith("SMSTO:") || upper.startsWith("MMSTO:") -> smsto(s)
            upper.startsWith("SMS:") -> smsUri(s)
            upper.startsWith("GEO:") -> geo(s)
            looksLikeUrl(s) -> Scan.Link(s, normalizeUrl(s))
            else -> Scan.Text(s)
        }
    }

    /** Our link → code id (/c/) or short number (/K/). Case-insensitive host: compact codes are all caps. */
    fun ours(s: String): Scan.Ours? {
        if (!Regex("^https?://", RegexOption.IGNORE_CASE).containsMatchIn(s)) return null
        val uri = runCatching { URI(s) }.getOrNull() ?: return null
        val host = uri.host?.lowercase() ?: return null
        if (host !in OUR_HOSTS) return null
        val m = OUR_PATH.find(uri.rawPath ?: "") ?: return null
        val (kind, value) = m.destructured
        return if (kind == "c") Scan.Ours(s, id = value, short = null) else Scan.Ours(s, id = null, short = value.uppercase())
    }

    private fun looksLikeUrl(s: String) =
        Regex("^https?://\\S+$", RegexOption.IGNORE_CASE).matches(s) || Regex("^www\\.[^\\s/]+\\.[a-z]{2,}(/\\S*)?$", RegexOption.IGNORE_CASE).matches(s)

    private fun normalizeUrl(s: String) = if (Regex("^https?://", RegexOption.IGNORE_CASE).containsMatchIn(s)) s else "https://$s"

    /** Splits "K:v;K:v;;" honoring backslash escapes (Wi-Fi and MECARD). */
    private fun fields(body: String): List<Pair<String, String>> {
        val out = mutableListOf<Pair<String, String>>()
        val cur = StringBuilder()
        var i = 0
        fun flush() {
            val part = cur.toString()
            cur.clear()
            val colon = indexOfUnescaped(part, ':')
            if (colon > 0) out += part.substring(0, colon).uppercase() to unescape(part.substring(colon + 1))
        }
        while (i < body.length) {
            val c = body[i]
            if (c == '\\' && i + 1 < body.length) {
                cur.append(c).append(body[i + 1])
                i += 2
                continue
            }
            if (c == ';') flush() else cur.append(c)
            i++
        }
        if (cur.isNotEmpty()) flush()
        return out
    }

    private fun indexOfUnescaped(s: String, ch: Char): Int {
        var i = 0
        while (i < s.length) {
            if (s[i] == '\\') { i += 2; continue }
            if (s[i] == ch) return i
            i++
        }
        return -1
    }

    private fun unescape(s: String): String {
        val b = StringBuilder()
        var i = 0
        while (i < s.length) {
            if (s[i] == '\\' && i + 1 < s.length) { b.append(s[i + 1]); i += 2 } else { b.append(s[i]); i++ }
        }
        return b.toString()
    }

    private fun wifi(s: String): Scan {
        val f = fields(s.substring(5)).toMap()
        val sec = (f["T"] ?: "").ifBlank { if (f["P"].isNullOrEmpty()) "nopass" else "WPA" }
        return Scan.Wifi(s, f["S"] ?: "", f["P"] ?: "", sec, f["H"].equals("true", ignoreCase = true))
    }

    private fun mecard(s: String): Scan {
        val f = fields(s.substring(7))
        val n = f.firstOrNull { it.first == "N" }?.second ?: ""
        // MECARD name is "Last,First".
        val name = n.split(',').map { it.trim() }.filter { it.isNotEmpty() }.reversed().joinToString(" ")
        return Scan.Contact(
            s, name,
            f.filter { it.first == "TEL" }.map { it.second },
            f.filter { it.first == "EMAIL" }.map { it.second },
            f.firstOrNull { it.first == "ORG" }?.second ?: "",
            f.firstOrNull { it.first == "URL" }?.second ?: "",
        )
    }

    /** vCard lines; unfolds continuation lines; property name before ';' params and ':'. */
    private fun vcardLines(s: String): List<Pair<String, String>> {
        val unfolded = s.replace("\r\n", "\n").replace(Regex("\n[ \t]"), "")
        return unfolded.split('\n').mapNotNull { line ->
            val colon = line.indexOf(':')
            if (colon <= 0) null else line.substring(0, colon).substringBefore(';').uppercase().substringAfter('.') to
                line.substring(colon + 1).replace("\\n", "\n").replace("\\,", ",").replace("\\;", ";").trim()
        }
    }

    private fun vcard(s: String): Scan {
        val l = vcardLines(s)
        val fn = l.firstOrNull { it.first == "FN" }?.second
        val n = l.firstOrNull { it.first == "N" }?.second?.split(';')?.let { p -> listOfNotNull(p.getOrNull(1), p.getOrNull(0)).filter { it.isNotBlank() }.joinToString(" ") }
        return Scan.Contact(
            s, fn?.takeIf { it.isNotBlank() } ?: n ?: "",
            l.filter { it.first == "TEL" }.map { it.second },
            l.filter { it.first == "EMAIL" }.map { it.second },
            l.firstOrNull { it.first == "ORG" }?.second?.replace(';', ' ')?.trim() ?: "",
            l.firstOrNull { it.first == "URL" }?.second ?: "",
        )
    }

    private fun event(s: String): Scan {
        val l = vcardLines(s)
        return Scan.Event(s, l.firstOrNull { it.first == "SUMMARY" }?.second ?: "", l.firstOrNull { it.first == "DTSTART" }?.second ?: "", l.firstOrNull { it.first == "LOCATION" }?.second ?: "")
    }

    private fun decode(s: String) = runCatching { URLDecoder.decode(s.replace("+", "%2B"), "UTF-8") }.getOrDefault(s)

    private fun query(q: String?): Map<String, String> =
        q.orEmpty().split('&').filter { it.contains('=') }.associate { it.substringBefore('=').lowercase() to decode(it.substringAfter('=')) }

    private fun mailto(s: String): Scan {
        val rest = s.substring(7)
        val q = query(rest.substringAfter('?', ""))
        return Scan.Email(s, decode(rest.substringBefore('?')), q["subject"] ?: "", q["body"] ?: "")
    }

    private fun matmsg(s: String): Scan {
        val f = fields(s.substring(7)).toMap()
        return Scan.Email(s, f["TO"] ?: "", f["SUB"] ?: "", f["BODY"] ?: "")
    }

    private fun smsto(s: String): Scan {
        val rest = s.substring(6)
        return Scan.Sms(s, rest.substringBefore(':').trim(), rest.substringAfter(':', ""))
    }

    private fun smsUri(s: String): Scan {
        val rest = s.substring(4)
        return Scan.Sms(s, decode(rest.substringBefore('?')).trim(), query(rest.substringAfter('?', ""))["body"] ?: "")
    }

    private fun geo(s: String): Scan {
        val rest = s.substring(4)
        val coords = rest.substringBefore('?').substringBefore(';').split(',')
        val lat = coords.getOrNull(0)?.trim()?.toDoubleOrNull()
        val lon = coords.getOrNull(1)?.trim()?.toDoubleOrNull()
        return Scan.Geo(s, lat, lon, query(rest.substringAfter('?', ""))["q"] ?: "")
    }
}
