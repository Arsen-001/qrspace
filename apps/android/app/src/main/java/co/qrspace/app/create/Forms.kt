package co.qrspace.app.create

import android.app.DatePickerDialog
import android.app.TimePickerDialog
import android.text.format.DateFormat
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.selection.selectableGroup
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.luminance
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import co.qrspace.app.BuildConfig
import co.qrspace.app.R
import co.qrspace.app.app
import co.qrspace.app.billing.Products
import co.qrspace.app.codes.QrImage
import co.qrspace.app.codes.parseColor
import co.qrspace.app.data.Look
import co.qrspace.app.data.Payload
import co.qrspace.app.data.Quote
import co.qrspace.app.data.SavedStyle
import co.qrspace.app.ui.Bone
import co.qrspace.app.ui.BtnKind
import co.qrspace.app.ui.Chip
import co.qrspace.app.ui.Glyphs
import co.qrspace.app.ui.Kicker
import co.qrspace.app.ui.Lime
import co.qrspace.app.ui.LocalQr
import co.qrspace.app.ui.Night
import co.qrspace.app.ui.QButton
import co.qrspace.app.ui.QField
import co.qrspace.app.ui.Segmented
import co.qrspace.app.ui.SiteText
import co.qrspace.app.ui.Type
import co.qrspace.app.ui.dotGrid
import co.qrspace.app.ui.fmtBytes
import coil3.compose.AsyncImage
import kotlinx.coroutines.delay
import java.util.Calendar
import java.util.Locale

@Composable
fun siteText(map: Map<String, Int>, id: String): String = map[id]?.let { stringResource(it) } ?: id

/** Content type tiles by group (the generator's step 1). */
@Composable
fun ContentTypePicker(type: String, onType: (String) -> Unit) {
    Column(verticalArrangement = Arrangement.spacedBy(14.dp)) {
        Payload.GROUPS.forEach { (g, ids) ->
            Column {
                Kicker(siteText(SiteText.group, g))
                Spacer(Modifier.height(8.dp))
                Column(Modifier.selectableGroup(), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    ids.chunked(3).forEach { row ->
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            row.forEach { id -> TypeTile(id, type == id, Modifier.weight(1f)) { onType(id) } }
                            repeat(3 - row.size) { Spacer(Modifier.weight(1f)) }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun TypeTile(id: String, on: Boolean, modifier: Modifier, onClick: () -> Unit) {
    val q = LocalQr.current
    val shape = RoundedCornerShape(12.dp)
    Column(
        modifier.heightIn(min = 72.dp).clip(shape).background(if (on) q.picked else q.field).border(1.dp, if (on) q.pickedLine else q.line, shape)
            .selectable(on, role = Role.RadioButton, onClick = onClick).padding(horizontal = 4.dp, vertical = 10.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Icon(Glyphs.type(id), null, tint = if (on) Lime else q.ink, modifier = Modifier.size(22.dp))
        Spacer(Modifier.height(6.dp))
        Text(siteText(SiteText.type, id), style = Type.small.copy(fontSize = 12.sp, lineHeight = 15.sp), color = if (on) Bone else q.ink, textAlign = TextAlign.Center, maxLines = 2)
    }
}

private val PLACEHOLDER = mapOf(
    "url" to "example.com", "phone" to "+374 91 123456", "username" to "@username", "email" to "name@example.com",
    "website" to "example.com", "place" to "Yerevan, Northern Ave 1 · 40.1811, 44.5136",
)

/** The fields of one content type, with the site's labels, keyboards and pickers. */
@Composable
fun ContentFields(type: String, fields: Map<String, String>, onField: (String, String) -> Unit) {
    var showPass by remember { mutableStateOf(false) }
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        for (k in Payload.FIELDS[type].orEmpty()) {
            val label = siteText(SiteText.field, k)
            val value = fields[k] ?: ""
            when {
                k == "security" -> Column {
                    Text(label, style = Type.small, color = LocalQr.current.muted)
                    Spacer(Modifier.height(6.dp))
                    Segmented(listOf("WPA", "WEP", "nopass").map { it to siteText(SiteText.security, it) }, value.ifEmpty { "WPA" }, { onField(k, it) })
                }
                k == "password" && fields["security"] == "nopass" -> {}
                k == "start" || k == "end" -> DateTimeField(value, { onField(k, it) }, label)
                else -> QField(
                    value, { onField(k, it) }, label,
                    placeholder = PLACEHOLDER[k],
                    singleLine = k !in setOf("text", "body", "notes"),
                    minLines = if (k == "text") 4 else if (k in setOf("body", "notes")) 3 else 1,
                    keyboard = when (k) {
                        "url", "website" -> KeyboardType.Uri
                        "phone" -> KeyboardType.Phone
                        "email" -> KeyboardType.Email
                        "password" -> KeyboardType.Password
                        else -> KeyboardType.Text
                    },
                    password = k == "password" && !showPass,
                    maxLength = when (k) { "text", "body" -> 2000; "notes", "message" -> 1000; else -> 300 },
                    trailing = if (k == "password") ({ TextButton({ showPass = !showPass }) { Text(stringResource(R.string.show_password), color = LocalQr.current.muted) } }) else null,
                )
            }
        }
    }
}

/** «2026-10-10T18:30» — typed, or picked with the system date and time pickers. */
@Composable
private fun DateTimeField(value: String, onChange: (String) -> Unit, label: String) {
    val ctx = LocalContext.current
    val pick = stringResource(R.string.pick_date)
    QField(
        value.replace('T', ' '), { onChange(it.trim().replace(' ', 'T')) }, label,
        placeholder = "2026-10-10 18:30",
        trailing = {
            IconButton({
                val now = Calendar.getInstance()
                DatePickerDialog(ctx, { _, y, m, d ->
                    TimePickerDialog(ctx, { _, h, min ->
                        onChange(String.format(Locale.ROOT, "%04d-%02d-%02dT%02d:%02d", y, m + 1, d, h, min))
                    }, 18, 0, DateFormat.is24HourFormat(ctx)).show()
                }, now.get(Calendar.YEAR), now.get(Calendar.MONTH), now.get(Calendar.DAY_OF_MONTH)).show()
            }) { Icon(Glyphs.Calendar, pick, tint = LocalQr.current.ink) }
        },
    )
}

/** Approximate style for the offline drawing (ZXing) of a look. */
fun Look.toSaved() = SavedStyle(fg = fg, bg = bg, dot = dot, eye = eye, eyeBall = eyeBall, eyeColor = eyeColor, eyeBallColor = eyeBallColor, effect = effect)

private const val SAMPLE = "HTTPS://QRSPACE.CO/K/XXXXXX"

/** A look drawn by the server (POST /api/preview, debounced), so it's exactly what the site will make. */
@Composable
fun LivePreview(look: Look, modifier: Modifier = Modifier, size: Int = 640, debounceMs: Long = 350) {
    val api = LocalContext.current.app.api
    var bytes by remember { mutableStateOf<ByteArray?>(null) }
    var loading by remember { mutableStateOf(false) }
    LaunchedEffect(look) {
        delay(debounceMs)
        loading = true
        runCatching { api.preview(look, size) }.onSuccess { bytes = it }
        loading = false
    }
    val label = stringResource(R.string.preview_label)
    Box(modifier.background(parseColor(look.bg, Color.White)).semantics { contentDescription = label }) {
        val b = bytes
        if (b != null) AsyncImage(model = b, contentDescription = null, contentScale = ContentScale.Fit, modifier = Modifier.fillMaxSize())
        else QrImage(SAMPLE, look.toSaved(), label, Modifier.fillMaxSize().padding(8.dp))
        if (loading) CircularProgressIndicator(Modifier.align(Alignment.TopEnd).padding(8.dp).size(18.dp), color = Lime, strokeWidth = 2.dp, trackColor = Night.copy(alpha = 0.4f))
    }
}

/** Contrast of dots on background (WCAG ratio). */
private fun contrast(a: String, b: String): Double {
    val l1 = parseColor(a, Color.Black).luminance() + 0.05
    val l2 = parseColor(b, Color.White).luminance() + 0.05
    return maxOf(l1, l2) / minOf(l1, l2)
}

/** Step 2 — how it looks: ready styles, colours, dot and corner shapes. */
@OptIn(ExperimentalLayoutApi::class)
@Composable
fun LookPicker(look: Look, onLook: (Look) -> Unit) {
    val q = LocalQr.current
    Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
        Column {
            Kicker(stringResource(R.string.style_ready))
            Spacer(Modifier.height(8.dp))
            LazyRow(Modifier.selectableGroup(), horizontalArrangement = Arrangement.spacedBy(8.dp), contentPadding = PaddingValues(end = 8.dp)) {
                items(Look.PRESETS, key = { it.first }) { (id, pr) ->
                    val on = look == pr
                    val shape = RoundedCornerShape(12.dp)
                    Column(
                        Modifier.width(88.dp).clip(shape).border(2.dp, if (on) q.accentInk else Color.Transparent, shape)
                            .background(if (on) Lime.copy(alpha = 0.15f) else Color.Transparent)
                            .selectable(on, role = Role.RadioButton) { onLook(pr) }.padding(6.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                    ) {
                        LivePreview(pr, Modifier.fillMaxWidth().aspectRatio(1f).clip(RoundedCornerShape(8.dp)).border(1.dp, q.line, RoundedCornerShape(8.dp)), size = 192, debounceMs = 0)
                        Spacer(Modifier.height(6.dp))
                        Text(siteText(SiteText.preset, id), style = Type.small.copy(fontSize = 12.sp), color = q.ink, maxLines = 1, overflow = TextOverflow.Ellipsis)
                    }
                }
            }
        }

        Column {
            Kicker(stringResource(R.string.colors))
            Spacer(Modifier.height(8.dp))
            FlowRow(Modifier.selectableGroup(), horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Look.PAIRS.forEach { (fg, bg) -> PairSwatch(fg, bg, look.fg == fg && look.bg == bg) { onLook(look.withFg(fg).copy(bg = bg, gradientTo = null)) } }
            }
            Spacer(Modifier.height(12.dp))
            SwatchRow(stringResource(R.string.fg), Look.FG, look.fg) { onLook(look.withFg(it).copy(gradientTo = null)) }
            Spacer(Modifier.height(10.dp))
            SwatchRow(stringResource(R.string.bg), Look.BG, look.bg) { onLook(look.copy(bg = it)) }
            if (contrast(look.fg, look.bg) < 3.0) {
                Spacer(Modifier.height(8.dp))
                Text(stringResource(R.string.low_contrast), style = Type.small, color = q.warn, modifier = Modifier.semantics { liveRegion = LiveRegionMode.Polite })
            }
        }

        Column {
            Kicker(stringResource(R.string.dots))
            Spacer(Modifier.height(8.dp))
            FlowRow(Modifier.selectableGroup(), horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Look.DOTS.forEach { d -> Chip(siteText(SiteText.dot, d), look.dot == d, { onLook(look.copy(dot = d)) }) }
            }
        }
        Column {
            Kicker(stringResource(R.string.eyes))
            Spacer(Modifier.height(8.dp))
            FlowRow(Modifier.selectableGroup(), horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Look.EYES.forEach { e -> Chip(siteText(SiteText.eye, e), look.eye == e, { onLook(look.copy(eye = e, eyeBall = "auto")) }) }
            }
        }
    }
}

@Composable
private fun PairSwatch(fg: String, bg: String, on: Boolean, onClick: () -> Unit) {
    val q = LocalQr.current
    Box(
        Modifier.size(44.dp).clip(CircleShape).border(if (on) 3.dp else 1.dp, if (on) q.accentInk else q.line, CircleShape)
            .selectable(on, role = Role.RadioButton, onClick = onClick).semantics { contentDescription = "$fg / $bg" }
            .padding(5.dp).clip(CircleShape).background(parseColor(bg, Color.White)),
        contentAlignment = Alignment.Center,
    ) { Box(Modifier.size(16.dp).clip(RoundedCornerShape(3.dp)).background(parseColor(fg, Color.Black))) }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun SwatchRow(label: String, colors: List<String>, value: String, onPick: (String) -> Unit) {
    val q = LocalQr.current
    Row(verticalAlignment = Alignment.CenterVertically) {
        Text(label, style = Type.small, color = q.muted, modifier = Modifier.width(88.dp))
        FlowRow(Modifier.weight(1f).selectableGroup(), horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            colors.forEach { c ->
                val on = value.equals(c, ignoreCase = true)
                Box(
                    Modifier.size(32.dp).clip(CircleShape).border(if (on) 3.dp else 1.dp, if (on) q.accentInk else q.line, CircleShape)
                        .selectable(on, role = Role.RadioButton) { onPick(c) }.semantics { contentDescription = "$label $c" }
                        .padding(4.dp).clip(CircleShape).background(parseColor(c, Color.White)),
                )
            }
        }
    }
}

/** Google Play's price of [productId] for this person ("$0.99", "390 ֏"); null — not loaded / no Google Play. */
@Composable
fun storePrice(productId: String): String? {
    val prices by LocalContext.current.app.store.prices.collectAsState()
    return prices[productId]
}

/**
 * Price row under the preview: simple / styled, the store's price of a code, "the first simple code is free". None in
 * a build without purchases; no price while Google Play's prices aren't there.
 */
@Composable
fun TierRow(tier: String) {
    if (!BuildConfig.PURCHASES_ENABLED) return
    val q = LocalQr.current
    val price = storePrice(Products.CODE)
    Column {
        Row(
            Modifier.fillMaxWidth().clip(RoundedCornerShape(10.dp)).border(1.dp, q.line, RoundedCornerShape(10.dp)).padding(horizontal = 12.dp, vertical = 10.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Box(Modifier.size(8.dp).clip(CircleShape).background(if (tier == "simple") q.muted else Lime))
            Spacer(Modifier.width(8.dp))
            Text(stringResource(if (tier == "simple") R.string.tier_simple else R.string.tier_styled), style = Type.bodyStrong, color = q.ink, modifier = Modifier.weight(1f))
            if (price != null) Text(price, style = Type.h2, color = q.ink)
        }
        Spacer(Modifier.height(6.dp))
        Text(stringResource(R.string.first_free), style = Type.small, color = q.muted, textAlign = TextAlign.Center, modifier = Modifier.fillMaxWidth())
    }
}

sealed interface GateState {
    data object Checking : GateState
    data class Ask(val quote: Quote) : GateState
    data object Working : GateState
}

/**
 * Labels of the gate's main button: creating a code, or getting a code's picture. [off] — what a build without
 * purchases says instead of the price.
 */
data class GateLabels(val free: Int, val pay: Int, val pack: Int, val off: Int)
val CreateLabels = GateLabels(R.string.create_free, R.string.create_pay, R.string.create_from_pack, R.string.iap_off_create)
val DownloadLabels = GateLabels(R.string.download_free, R.string.pay_and_download, R.string.pack_download, R.string.iap_off_picture)

/**
 * The price gate: the first simple code is free, a pack code costs nothing more, otherwise a code at Google Play's
 * price (onConfirm then buys it — billing/Store.kt). Google Play not there → "Purchases unavailable". Without purchases
 * (BuildConfig.PURCHASES_ENABLED = false) the free code and pack codes still go through; a paid one gets
 * [GateLabels.off] and only "Cancel" — no price, no link.
 */
@Composable
fun PriceGate(state: GateState, labels: GateLabels, onConfirm: () -> Unit, onCancel: () -> Unit, modifier: Modifier = Modifier) {
    Column(
        modifier.fillMaxWidth().clip(RoundedCornerShape(14.dp)).background(LocalQr.current.stage).border(1.dp, LocalQr.current.stageLine, RoundedCornerShape(14.dp)).dotGrid(Bone.copy(alpha = 0.06f)).padding(16.dp)
            .semantics { liveRegion = LiveRegionMode.Polite },
    ) {
        when (state) {
            GateState.Checking, GateState.Working -> Row(verticalAlignment = Alignment.CenterVertically) {
                CircularProgressIndicator(Modifier.size(20.dp), color = Lime, strokeWidth = 2.dp)
                Spacer(Modifier.width(10.dp))
                Text(stringResource(if (state == GateState.Working) R.string.creating else R.string.loading), style = Type.body, color = Bone)
            }
            is GateState.Ask -> {
                val qt = state.quote
                val pack = qt.pack
                val paid = pack == null && !qt.free
                val price = storePrice(Products.CODE)
                if (paid && (!BuildConfig.PURCHASES_ENABLED || price == null)) {
                    Text(stringResource(if (BuildConfig.PURCHASES_ENABLED) R.string.iap_unavailable else labels.off), style = Type.bodyStrong, color = Bone)
                    Spacer(Modifier.height(14.dp))
                    QButton(stringResource(R.string.cancel), onCancel, kind = BtnKind.Stage)
                } else {
                    when {
                        pack != null -> {
                            Text(stringResource(R.string.pack_from), style = Type.bodyStrong, color = Bone)
                            Spacer(Modifier.height(4.dp))
                            Text(stringResource(R.string.pack_left) + ": ${pack.left} · " + fmtBytes(pack.bytes) + " " + stringResource(R.string.pack_room), style = Type.kicker, color = Bone.copy(alpha = 0.7f))
                        }
                        qt.free -> Text(stringResource(R.string.free_first), style = Type.bodyStrong, color = Bone)
                        else -> Text(stringResource(R.string.pay_title) + ": " + price, style = Type.h2, color = Bone)
                    }
                    Spacer(Modifier.height(14.dp))
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                        val main = when {
                            pack != null -> stringResource(labels.pack)
                            qt.free -> stringResource(labels.free)
                            labels.pay == R.string.create_pay -> stringResource(R.string.create_pay, price.orEmpty())
                            else -> stringResource(labels.pay) + " — " + price.orEmpty()
                        }
                        QButton(main, onConfirm, Modifier.weight(1f))
                        QButton(stringResource(R.string.cancel), onCancel, kind = BtnKind.Stage)
                    }
                }
            }
        }
    }
}
