package co.qrspace.app.data

import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import java.net.URLEncoder

// Ports of the web's src/lib/qr/payload.ts, src/lib/pricing.ts and the storage plans of src/lib/codes.ts.
// The server re-checks everything; these only drive the forms, the price gate key and the "room" offer.

object Payload {
    /** Content types by group, in the site's order (CONTENT_GROUPS). */
    val GROUPS: List<Pair<String, List<String>>> = listOf(
        "main" to listOf("url", "text", "wifi", "contact", "location", "event"),
        "contact" to listOf("phone", "sms", "email", "whatsapp", "telegram", "viber"),
        "social" to listOf("instagram", "facebook", "tiktok", "youtube", "linkedin", "x"),
    )
    val TYPES: List<String> = GROUPS.flatMap { it.second }

    /** Fields of each type; order = order in the form (FIELDS). */
    val FIELDS: Map<String, List<String>> = mapOf(
        "url" to listOf("url"),
        "text" to listOf("text"),
        "wifi" to listOf("ssid", "password", "security"),
        "phone" to listOf("phone"),
        "whatsapp" to listOf("phone", "message"),
        "telegram" to listOf("username"),
        "email" to listOf("email", "subject", "body"),
        "contact" to listOf("firstName", "lastName", "phone", "email", "company", "website"),
        "location" to listOf("place"),
        "event" to listOf("title", "start", "end", "place", "notes"),
        "sms" to listOf("phone", "message"),
        "viber" to listOf("phone"),
        "instagram" to listOf("username"),
        "facebook" to listOf("username"),
        "tiktok" to listOf("username"),
        "youtube" to listOf("username"),
        "linkedin" to listOf("username"),
        "x" to listOf("username"),
    )

    private val SOCIAL: Map<String, (String) -> String> = mapOf(
        "instagram" to { u -> "https://instagram.com/$u" },
        "facebook" to { u -> "https://facebook.com/$u" },
        "tiktok" to { u -> "https://www.tiktok.com/@$u" },
        "youtube" to { u -> "https://youtube.com/@$u" },
        "linkedin" to { u -> "https://www.linkedin.com/in/$u" },
        "x" to { u -> "https://x.com/$u" },
    )

    private fun digits(s: String) = s.replace(Regex("[^\\d+]"), "")
    private fun wifiEscape(s: String) = s.replace(Regex("([\\\\;,:\"])"), "\\\\$1")
    private fun vcardEscape(s: String) = s.replace(Regex("([\\\\;,])"), "\\\\$1").replace("\n", "\\n")

    fun normalizeUrl(raw: String): String {
        val s = raw.trim()
        if (s.isEmpty()) return ""
        return if (Regex("^[a-z][a-z\\d+.-]*:", RegexOption.IGNORE_CASE).containsMatchIn(s)) s else "https://$s"
    }

    /** JavaScript's encodeURIComponent. */
    fun encodeURIComponent(s: String): String =
        URLEncoder.encode(s, "UTF-8").replace("+", "%20")
            .replace("%21", "!").replace("%7E", "~").replace("%27", "'").replace("%28", "(").replace("%29", ")")

    /** «2026-10-10T18:30» → «20261010T183000». */
    private fun icsDate(s: String) = s.replace(Regex("[-:]"), "").padEnd(13, '0').take(13) + "00"

    /** The string that goes into the code, or "" when the main field is empty (buildPayload). */
    fun build(type: String, f: Map<String, String>): String {
        fun v(k: String) = (f[k] ?: "").trim()
        return when (type) {
            "sms" -> digits(v("phone")).let { n -> if (n.isEmpty()) "" else "SMSTO:$n:${v("message")}" }
            "viber" -> digits(v("phone")).let { n -> if (n.isEmpty()) "" else "viber://chat?number=" + encodeURIComponent(if (n.startsWith("+")) n else "+$n") }
            "location" -> {
                val q = v("place")
                if (q.isEmpty()) return ""
                val m = Regex("^\\s*(-?\\d+(?:\\.\\d+)?)\\s*[,;\\s]\\s*(-?\\d+(?:\\.\\d+)?)\\s*$").find(q)
                if (m != null) "https://maps.google.com/?q=${m.groupValues[1]},${m.groupValues[2]}" else "https://maps.google.com/?q=" + encodeURIComponent(q)
            }
            "event" -> {
                if (v("title").isEmpty() || v("start").isEmpty()) return ""
                listOf(
                    "BEGIN:VEVENT",
                    "SUMMARY:${vcardEscape(v("title"))}",
                    "DTSTART:${icsDate(v("start"))}",
                    v("end").takeIf { it.isNotEmpty() }?.let { "DTEND:${icsDate(it)}" },
                    v("place").takeIf { it.isNotEmpty() }?.let { "LOCATION:${vcardEscape(it)}" },
                    v("notes").takeIf { it.isNotEmpty() }?.let { "DESCRIPTION:${vcardEscape(it)}" },
                    "END:VEVENT",
                ).filterNotNull().joinToString("\n")
            }
            "instagram", "facebook", "tiktok", "youtube", "linkedin", "x" -> {
                val u = v("username")
                when {
                    u.isEmpty() -> ""
                    Regex("^https?://", RegexOption.IGNORE_CASE).containsMatchIn(u) || Regex("\\.(com|me)/", RegexOption.IGNORE_CASE).containsMatchIn(u) -> normalizeUrl(u)
                    else -> SOCIAL.getValue(type)(u.removePrefix("@"))
                }
            }
            "url" -> normalizeUrl(v("url"))
            "text" -> f["text"] ?: ""
            "wifi" -> {
                if (v("ssid").isEmpty()) return ""
                val sec = v("security").ifEmpty { "WPA" }
                val pass = if (sec == "nopass") "" else "P:${wifiEscape(f["password"] ?: "")};"
                "WIFI:T:$sec;S:${wifiEscape(f["ssid"] ?: "")};$pass;"
            }
            "phone" -> if (v("phone").isEmpty()) "" else "tel:${digits(v("phone"))}"
            "whatsapp" -> {
                val n = digits(v("phone")).removePrefix("+")
                when {
                    n.isEmpty() -> ""
                    v("message").isNotEmpty() -> "https://wa.me/$n?text=" + encodeURIComponent(v("message"))
                    else -> "https://wa.me/$n"
                }
            }
            "telegram" -> {
                val u = v("username").removePrefix("@").replace(Regex("^https?://t\\.me/"), "")
                if (u.isEmpty()) "" else "https://t.me/$u"
            }
            "email" -> {
                if (v("email").isEmpty()) return ""
                // URLSearchParams: form encoding (space → +), then the site turns + into %20.
                val q = listOfNotNull(
                    v("subject").takeIf { it.isNotEmpty() }?.let { "subject=" + URLEncoder.encode(it, "UTF-8") },
                    v("body").takeIf { it.isNotEmpty() }?.let { "body=" + URLEncoder.encode(it, "UTF-8") },
                ).joinToString("&").replace("+", "%20")
                "mailto:${v("email")}" + if (q.isNotEmpty()) "?$q" else ""
            }
            "contact" -> {
                if (v("firstName").isEmpty() && v("lastName").isEmpty() && v("phone").isEmpty()) return ""
                listOf(
                    "BEGIN:VCARD",
                    "VERSION:3.0",
                    "N:${vcardEscape(v("lastName"))};${vcardEscape(v("firstName"))};;;",
                    "FN:" + vcardEscape(listOf(v("firstName"), v("lastName")).filter { it.isNotEmpty() }.joinToString(" ")),
                    v("phone").takeIf { it.isNotEmpty() }?.let { "TEL;TYPE=CELL:${digits(it)}" },
                    v("email").takeIf { it.isNotEmpty() }?.let { "EMAIL:$it" },
                    v("company").takeIf { it.isNotEmpty() }?.let { "ORG:${vcardEscape(it)}" },
                    v("website").takeIf { it.isNotEmpty() }?.let { "URL:${normalizeUrl(it)}" },
                    "END:VCARD",
                ).filterNotNull().joinToString("\n")
            }
            else -> ""
        }
    }

    /** Would the server accept this content (cleanContent)? Text, Wi‑Fi, contact, event — any payload; the rest need a safe link. */
    fun valid(type: String, f: Map<String, String>): Boolean {
        val p = build(type, f)
        if (p.isEmpty()) return false
        if (type in setOf("text", "wifi", "contact", "event")) return true
        return p.startsWith("SMSTO:") || Regex("^(https?:|tel:|mailto:|viber:)", RegexOption.IGNORE_CASE).containsMatchIn(p)
    }

    /** Only this type's non-empty fields — what the server keeps. */
    fun clean(type: String, f: Map<String, String>): Map<String, String> =
        FIELDS[type].orEmpty().mapNotNull { k -> f[k]?.takeIf { it.isNotBlank() }?.let { k to it } }.toMap()

    /** The code's name in "My codes" (titleOfContent). */
    fun titleOf(type: String, f: Map<String, String>): String {
        val main = when (type) {
            "contact" -> listOf(f["firstName"], f["lastName"]).filter { !it.isNullOrEmpty() }.joinToString(" ").ifEmpty { f["phone"] ?: "" }
            "event" -> f["title"]
            "wifi" -> f["ssid"]
            else -> f["url"] ?: f["phone"] ?: f["email"] ?: f["username"] ?: f["place"] ?: f["text"] ?: ""
        } ?: ""
        return main.replace(Regex("^https?://", RegexOption.IGNORE_CASE), "").replace(Regex("\\s+"), " ").trim().take(60).ifEmpty { type }
    }

    /** The main value shown under a code on the dashboard: the first filled field. */
    fun mainValue(c: Content): String = FIELDS[c.type].orEmpty().firstNotNullOfOrNull { k -> c.fields[k]?.takeIf { it.isNotBlank() } } ?: ""
}

/** A code's look as the site saves it (SavedStyle) — only what the app lets you choose; no textures, pictures or logos. */
data class Look(
    val fg: String = "#111111",
    val bg: String = "#ffffff",
    val eyeColor: String = "#111111",
    val dot: String = "square",
    val eye: String = "square",
    val eyeBall: String = "auto",
    val eyeBallColor: String = "#111111",
    val gradientTo: String? = null,
    val gradientAngle: Int = 45,
    val effect: String = "none",
) {
    /** Same keys in the same order as the site's toSaved(DEFAULT_STYLE ∪ changes) — so the price key matches the web's. */
    fun toJson(): JsonObject = buildJsonObject {
        put("fg", fg); put("bg", bg); put("eyeColor", eyeColor)
        put("dot", dot); put("eye", eye); put("eyeBall", eyeBall); put("eyeBallColor", eyeBallColor)
        if (gradientTo != null) put("gradient", buildJsonObject { put("to", gradientTo); put("angle", gradientAngle) }) else put("gradient", JsonNull)
        put("rotate", 0); put("effect", effect)
        put("texture", JsonNull); put("eyeIcon", JsonNull); put("logo", JsonNull); put("picture", JsonNull)
    }

    /** New dot colour: corners follow it (like picking colours on the site). */
    fun withFg(c: String) = copy(fg = c, eyeColor = c, eyeBallColor = c)

    companion object {
        val DOTS = listOf("square", "rounded", "dots", "diamond", "star", "heart", "plus", "liquid", "leaf", "circuit")
        val EYES = listOf("square", "rounded", "circle", "leaf", "drop", "dropOut", "octagon", "mixed", "dotted", "chip", "ornate")

        private fun p(id: String, fg: String, bg: String, dot: String, eye: String, ball: String, ballColor: String = fg, gradient: String? = null, effect: String = "none") =
            id to Look(fg, bg, fg, dot, eye, ball, ballColor, gradient, 45, effect)

        /** Ready-made styles (src/lib/qr/presets.ts). */
        val PRESETS: List<Pair<String, Look>> = listOf(
            p("classic", "#111111", "#ffffff", "square", "square", "auto"),
            p("soft", "#1b2a4a", "#ffffff", "rounded", "rounded", "auto"),
            p("dots", "#4c1d95", "#f7f3ff", "dots", "circle", "circle"),
            p("lime", "#0b0b0c", "#c6ff2e", "rounded", "drop", "drop"),
            p("night", "#f3f2ec", "#0b0b0c", "liquid", "rounded", "rounded", ballColor = "#c6ff2e"),
            p("hearts", "#9b1b2a", "#fff5f5", "heart", "circle", "circle"),
            p("stars", "#151a3d", "#ffffff", "star", "octagon", "star", ballColor = "#5b2a86"),
            p("circuit", "#0b5132", "#e6f4ea", "circuit", "chip", "square"),
            p("gradient", "#7a1f2b", "#ffffff", "diamond", "leaf", "leaf", gradient = "#2e3fd6"),
            p("raised", "#111111", "#f3efe6", "rounded", "rounded", "auto", effect = "raised"),
        )

        /** Colour pairs (StylePanel PRESETS): dots on background. */
        val PAIRS = listOf(
            "#111111" to "#ffffff", "#1b2a4a" to "#ffffff", "#7a1f2b" to "#fff8f0", "#14532d" to "#f2fbf4",
            "#4c1d95" to "#f7f3ff", "#ffffff" to "#111111", "#0b5132" to "#e6f4ea",
        )
        val FG = listOf("#111111", "#1b2a4a", "#2e3fd6", "#7a1f2b", "#9b1b2a", "#14532d", "#4c1d95", "#c2410c", "#ffffff")
        val BG = listOf("#ffffff", "#f3efe6", "#fff8f0", "#f7f3ff", "#e6f4ea", "#c6ff2e", "#111111", "#0b0b0c")
    }
}

object Pricing {
    private val SIMPLE_DOTS = setOf("square", "rounded", "dots")
    private val SIMPLE_EYES = setOf("square", "rounded", "circle")
    private val SIMPLE_BALLS = setOf("auto", "square", "rounded", "circle")

    /** Colours, gradient — simple; other shapes and effects — styled (tierOf). Both cost $1; the first simple one is free. */
    fun tierOf(l: Look): String =
        if (l.dot !in SIMPLE_DOTS || l.eye !in SIMPLE_EYES || l.eyeBall !in SIMPLE_BALLS || l.effect != "none") "styled" else "simple"

    fun tierOf(s: SavedStyle?): String =
        if (s == null) "simple"
        else if (s.dot !in SIMPLE_DOTS || s.eye !in SIMPLE_EYES || s.eyeBall !in SIMPLE_BALLS || s.texture != null || s.effect != "none" || s.picture != null || s.eyeIcon != null) "styled"
        else "simple"

    const val PRICE = 1.0

    /** The code's payment key — same hash as the site's codeKey(payload, style). */
    fun codeKey(payload: String, styleJson: String): String {
        val str = payload + "\u0000" + styleJson
        var h1 = 0x811c9dc5.toInt()
        var h2 = 0x01000193
        for (ch in str) {
            val c = ch.code
            h1 = (h1 xor c) * 16777619
            h2 = (h2 xor c) * 2246822519L.toInt()
        }
        return "g:" + Integer.toUnsignedString(h1, 36) + Integer.toUnsignedString(h2, 36)
    }
}

/** Space under a code (src/lib/codes.ts): 1 MB free, more is monthly. Demo prices. */
object Storage {
    const val FREE = 1024L * 1024
    const val MAX_FILE = 1024L * 1024 * 1024
    data class Plan(val id: String, val bytes: Long, val price: Double)
    val PLANS = listOf(Plan("s10", 10L * 1024 * 1024, 1.0), Plan("s100", 100L * 1024 * 1024, 3.0), Plan("s1000", 1024L * 1024 * 1024, 9.0))

    /** The smallest plan this many bytes fit in; null — fits in the free 1 MB, or bigger than the biggest plan. */
    fun planFor(bytes: Long): Plan? = if (bytes <= FREE) null else PLANS.firstOrNull { it.bytes >= bytes }
}
