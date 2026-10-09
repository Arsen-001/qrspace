package co.qrspace.app.scan

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import co.qrspace.app.R
import co.qrspace.app.data.Content
import co.qrspace.app.ui.BtnKind
import co.qrspace.app.ui.Glyphs
import co.qrspace.app.ui.Kicker
import co.qrspace.app.ui.LocalQr
import co.qrspace.app.ui.QButton
import co.qrspace.app.ui.RadiusSm
import co.qrspace.app.ui.Type

private data class Act(val label: String, val icon: ImageVector, val primary: Boolean = false, val run: () -> Unit)

/** Content of a QR Space code ("what's in the code" from the generator) → the same result card as a scan. */
fun Content.toScan(): Scan {
    val f = fields
    fun g(k: String) = f[k].orEmpty().trim()
    val digits = g("phone").replace(Regex("[^\\d+]"), "")
    return when (type) {
        "url" -> g("url").let { Scan.Link(it, if (Regex("^[a-z][a-z\\d+.-]*:", RegexOption.IGNORE_CASE).containsMatchIn(it)) it else "https://$it") }
        "wifi" -> Scan.Wifi("", g("ssid"), g("password"), g("security").ifEmpty { "WPA" }, false)
        "phone" -> Scan.Phone(g("phone"), g("phone"))
        "sms" -> Scan.Sms(g("phone"), g("phone"), g("message"))
        "email" -> Scan.Email(g("email"), g("email"), g("subject"), g("body"))
        "contact" -> Scan.Contact("", listOf(g("firstName"), g("lastName")).filter { it.isNotEmpty() }.joinToString(" "), listOfNotNull(g("phone").ifEmpty { null }), listOfNotNull(g("email").ifEmpty { null }), g("company"), g("website"))
        "location" -> Scan.Geo(g("place"), null, null, g("place"))
        "event" -> Scan.Event(g("title"), g("title"), g("start").replace("-", "").replace(":", "").let { if (it.contains('T')) it + "00" else it }, g("place"))
        "whatsapp" -> "https://wa.me/${digits.trimStart('+')}".let { Scan.Link(it, it) }
        "telegram" -> "https://t.me/${g("username").trimStart('@')}".let { Scan.Link(it, it) }
        "viber" -> "viber://chat?number=${digits}".let { Scan.Link(it, it) }
        "instagram" -> "https://instagram.com/${g("username").trimStart('@')}".let { Scan.Link(it, it) }
        "facebook" -> "https://facebook.com/${g("username")}".let { Scan.Link(it, it) }
        "tiktok" -> "https://www.tiktok.com/@${g("username").trimStart('@')}".let { Scan.Link(it, it) }
        "youtube" -> "https://youtube.com/@${g("username").trimStart('@')}".let { Scan.Link(it, it) }
        "linkedin" -> "https://www.linkedin.com/in/${g("username")}".let { Scan.Link(it, it) }
        "x" -> "https://x.com/${g("username").trimStart('@')}".let { Scan.Link(it, it) }
        else -> Scan.Text(g("text"))
    }
}

@Composable
fun scanLabel(s: Scan): String = when (s) {
    is Scan.Ours -> stringResource(R.string.result_ours)
    is Scan.Link -> stringResource(R.string.type_url)
    is Scan.Wifi -> stringResource(R.string.type_wifi)
    is Scan.Phone -> stringResource(R.string.type_phone)
    is Scan.Email -> stringResource(R.string.type_email)
    is Scan.Sms -> stringResource(R.string.type_sms)
    is Scan.Contact -> stringResource(R.string.type_contact)
    is Scan.Geo -> stringResource(R.string.type_location)
    is Scan.Event -> stringResource(R.string.type_event)
    is Scan.Text -> stringResource(R.string.type_text)
    is Scan.Product -> stringResource(R.string.result_barcode)
}

fun scanIcon(s: Scan): ImageVector = when (s) {
    is Scan.Ours -> Glyphs.Qr
    is Scan.Link -> Glyphs.Link
    is Scan.Wifi -> Glyphs.Wifi
    is Scan.Phone -> Glyphs.Phone
    is Scan.Email -> Glyphs.Mail
    is Scan.Sms -> Glyphs.Sms
    is Scan.Contact -> Glyphs.Person
    is Scan.Geo -> Glyphs.Pin
    is Scan.Event -> Glyphs.Calendar
    is Scan.Text -> Glyphs.Text
    is Scan.Product -> Glyphs.Barcode
}

/** One-line title for lists (history). */
fun scanTitle(s: Scan): String = when (s) {
    is Scan.Ours -> s.raw
    is Scan.Link -> s.url
    is Scan.Wifi -> s.ssid
    is Scan.Phone -> s.number
    is Scan.Email -> s.to
    is Scan.Sms -> s.number
    is Scan.Contact -> s.name.ifEmpty { s.phones.firstOrNull() ?: s.emails.firstOrNull() ?: "" }
    is Scan.Geo -> s.query.ifEmpty { "${s.lat}, ${s.lon}" }
    is Scan.Event -> s.title
    is Scan.Text -> s.raw
    is Scan.Product -> s.raw
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun ResultCard(scan: Scan, format: CodeFormat, modifier: Modifier = Modifier, showKicker: Boolean = true) {
    val ctx = LocalContext.current
    val c = LocalQr.current
    val copy = stringResource(R.string.copy)
    val share = stringResource(R.string.share)
    val acts = mutableListOf<Act>()
    var mono = false
    val rows = mutableListOf<Pair<String, String>>()
    val title: String

    when (scan) {
        is Scan.Ours, is Scan.Link -> {
            val url = if (scan is Scan.Link) scan.url else scan.raw
            title = url
            acts += Act(stringResource(R.string.act_open_site), Glyphs.Open, true) { Actions.open(ctx, url) }
            acts += Act(stringResource(R.string.act_copy_link), Glyphs.Copy) { Actions.copy(ctx, url) }
            acts += Act(share, Glyphs.Share) { Actions.share(ctx, url) }
        }
        is Scan.Wifi -> {
            title = scan.ssid
            if (scan.password.isNotEmpty()) rows += stringResource(R.string.field_password) to scan.password
            rows += stringResource(R.string.field_security) to if (scan.security.equals("nopass", true)) stringResource(R.string.wifi_open) else scan.security
            acts += Act(stringResource(R.string.wifi_join), Glyphs.Wifi, true) { Actions.joinWifi(ctx, scan) }
            if (scan.password.isNotEmpty()) acts += Act(stringResource(R.string.act_copy_password), Glyphs.Copy) { Actions.copy(ctx, scan.password, sensitive = true) }
            acts += Act(stringResource(R.string.act_copy_network), Glyphs.Copy) { Actions.copy(ctx, scan.ssid) }
        }
        is Scan.Phone -> {
            title = scan.number; mono = true
            acts += Act(stringResource(R.string.act_call), Glyphs.Phone, true) { Actions.dial(ctx, scan.number) }
            acts += Act(stringResource(R.string.act_sms), Glyphs.Sms) { Actions.sms(ctx, scan.number, "") }
            acts += Act(stringResource(R.string.act_copy_number), Glyphs.Copy) { Actions.copy(ctx, scan.number) }
        }
        is Scan.Sms -> {
            title = scan.number; mono = true
            if (scan.body.isNotEmpty()) rows += "" to scan.body
            acts += Act(stringResource(R.string.act_sms), Glyphs.Sms, true) { Actions.sms(ctx, scan.number, scan.body) }
            acts += Act(stringResource(R.string.act_call), Glyphs.Phone) { Actions.dial(ctx, scan.number) }
            acts += Act(stringResource(R.string.act_copy_number), Glyphs.Copy) { Actions.copy(ctx, scan.number) }
        }
        is Scan.Email -> {
            title = scan.to
            if (scan.subject.isNotEmpty()) rows += "" to scan.subject
            if (scan.body.isNotEmpty()) rows += "" to scan.body
            acts += Act(stringResource(R.string.act_email), Glyphs.Mail, true) { Actions.email(ctx, scan.to, scan.subject, scan.body) }
            acts += Act(copy, Glyphs.Copy) { Actions.copy(ctx, scan.to) }
        }
        is Scan.Contact -> {
            title = scan.name.ifEmpty { scan.phones.firstOrNull() ?: scan.emails.firstOrNull() ?: "—" }
            if (scan.org.isNotEmpty()) rows += "" to scan.org
            scan.phones.forEach { rows += stringResource(R.string.type_phone) to it }
            scan.emails.forEach { rows += stringResource(R.string.type_email) to it }
            if (scan.url.isNotEmpty()) rows += stringResource(R.string.type_url) to scan.url
            acts += Act(stringResource(R.string.act_save_contact), Glyphs.Person, true) { Actions.saveContact(ctx, scan) }
            scan.phones.firstOrNull()?.let { p -> acts += Act(stringResource(R.string.act_call), Glyphs.Phone) { Actions.dial(ctx, p) } }
            scan.emails.firstOrNull()?.let { e -> acts += Act(stringResource(R.string.act_email), Glyphs.Mail) { Actions.email(ctx, e, "", "") } }
        }
        is Scan.Geo -> {
            title = scan.query.ifEmpty { "${scan.lat}, ${scan.lon}" }
            if (scan.query.isNotEmpty() && scan.lat != null) rows += "" to "${scan.lat}, ${scan.lon}"
            acts += Act(stringResource(R.string.act_map), Glyphs.Pin, true) { Actions.map(ctx, scan.lat, scan.lon, scan.query) }
            acts += Act(copy, Glyphs.Copy) { Actions.copy(ctx, title) }
        }
        is Scan.Event -> {
            title = scan.title.ifEmpty { "—" }
            if (scan.start.isNotEmpty()) rows += "" to scan.start
            if (scan.place.isNotEmpty()) rows += "" to scan.place
            acts += Act(stringResource(R.string.act_add_calendar), Glyphs.Calendar, true) { Actions.addEvent(ctx, scan) }
        }
        is Scan.Text -> {
            title = scan.raw
            acts += Act(stringResource(R.string.act_copy_text), Glyphs.Copy, true) { Actions.copy(ctx, scan.raw) }
            acts += Act(share, Glyphs.Share) { Actions.share(ctx, scan.raw) }
            acts += Act(stringResource(R.string.search_web), Glyphs.Search) { Actions.webSearch(ctx, scan.raw) }
        }
        is Scan.Product -> {
            title = scan.raw; mono = true
            rows += "" to stringResource(R.string.barcode_type, scan.format.label)
            acts += Act(stringResource(R.string.search_web), Glyphs.Search, true) { Actions.webSearch(ctx, scan.raw) }
            acts += Act(stringResource(R.string.act_copy_number), Glyphs.Copy) { Actions.copy(ctx, scan.raw) }
            acts += Act(share, Glyphs.Share) { Actions.share(ctx, scan.raw) }
        }
    }

    Column(modifier.fillMaxWidth()) {
        if (showKicker) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(Modifier.size(36.dp).clip(RadiusSm).background(c.accent), contentAlignment = Alignment.Center) {
                    Icon(scanIcon(scan), contentDescription = null, tint = c.onAccent, modifier = Modifier.size(20.dp))
                }
                Spacer(Modifier.width(12.dp))
                Kicker(scanLabel(scan) + if (format != CodeFormat.QR && format != CodeFormat.UNKNOWN && scan !is Scan.Product) " · ${format.label}" else "")
            }
            Spacer(Modifier.height(14.dp))
        }
        Text(
            title,
            style = if (mono) Type.mono else Type.h2,
            color = c.ink,
            maxLines = 6,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier.semantics { heading() },
        )
        rows.forEach { (k, v) ->
            Spacer(Modifier.height(8.dp))
            if (k.isNotEmpty()) Kicker(k)
            Text(v, style = Type.body, color = if (k.isEmpty()) c.muted else c.ink, maxLines = 8, overflow = TextOverflow.Ellipsis)
        }
        Spacer(Modifier.height(18.dp))
        FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            acts.forEach { a ->
                QButton(a.label, a.run, kind = if (a.primary) BtnKind.Lime else BtnKind.Ghost, icon = a.icon, modifier = if (a.primary) Modifier.fillMaxWidth() else Modifier)
            }
        }
    }
}
