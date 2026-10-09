package co.qrspace.app.edit

import android.content.Context
import android.content.Intent
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.selection.selectableGroup
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.core.content.FileProvider
import co.qrspace.app.R
import co.qrspace.app.app
import co.qrspace.app.codes.CodeImage
import co.qrspace.app.codes.linkOf
import co.qrspace.app.create.ContentFields
import co.qrspace.app.create.DownloadLabels
import co.qrspace.app.billing.Buy
import co.qrspace.app.billing.BuyResult
import co.qrspace.app.billing.activity
import co.qrspace.app.billing.message
import co.qrspace.app.create.GateState
import co.qrspace.app.create.PriceGate
import co.qrspace.app.create.siteText
import co.qrspace.app.data.Api
import co.qrspace.app.data.CodeView
import co.qrspace.app.data.Payload
import co.qrspace.app.data.Pricing
import co.qrspace.app.scan.Actions
import co.qrspace.app.ui.Bone
import co.qrspace.app.ui.BtnKind
import co.qrspace.app.ui.Chip
import co.qrspace.app.ui.ErrorBox
import co.qrspace.app.ui.Glyphs
import co.qrspace.app.ui.Kicker
import co.qrspace.app.ui.Lime
import co.qrspace.app.ui.Loading
import co.qrspace.app.ui.LocalQr
import co.qrspace.app.ui.Night
import co.qrspace.app.ui.QButton
import co.qrspace.app.ui.QField
import co.qrspace.app.ui.Screen
import co.qrspace.app.ui.SiteText
import co.qrspace.app.ui.StatusScrim
import co.qrspace.app.ui.StepCard
import co.qrspace.app.ui.Type
import co.qrspace.app.ui.VisBadge
import co.qrspace.app.ui.dotGrid
import co.qrspace.app.ui.kindLabel
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.File

/** Save the code's picture to the cache and open the share sheet (save to Photos/Files, send). */
private suspend fun sharePicture(ctx: Context, api: Api, c: CodeView) {
    val (bytes, type) = api.imageBytes(c, 1024)
    val svg = type.startsWith("image/svg")
    val file = withContext(Dispatchers.IO) {
        File(ctx.cacheDir, "shared").apply { mkdirs() }.resolve("qr-${c.id}." + if (svg) "svg" else "png").apply { writeBytes(bytes) }
    }
    val uri = FileProvider.getUriForFile(ctx, "${ctx.packageName}.files", file)
    val send = Intent(Intent.ACTION_SEND).setType(if (svg) "image/svg+xml" else "image/png")
        .putExtra(Intent.EXTRA_STREAM, uri).putExtra(Intent.EXTRA_TITLE, c.title ?: "QR")
        .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
    ctx.startActivity(Intent.createChooser(send, null).addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION))
}

/**
 * Editing a code (the web's /codes/{id}), a page of its own: the picture, name, what's in the code, who sees it and the
 * memory — adding text/photo/video (with the room offer when it doesn't fit) and deleting entries.
 */
@Composable
fun EditScreen(id: String, onBack: () -> Unit, onView: (String) -> Unit) {
    val ctx = LocalContext.current
    val api = ctx.app.api
    val session = ctx.app.session
    val me by session.me.collectAsState()
    var code by remember { mutableStateOf<CodeView?>(null) }
    var failed by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()

    suspend fun load() {
        failed = false
        runCatching { api.code(id) }.onSuccess { code = it }.onFailure { failed = true }
    }
    LaunchedEffect(id) { load() }
    val update: (CodeView) -> Unit = { code = it; session.changed() }

    Screen {
        Column(Modifier.fillMaxSize().imePadding().verticalScroll(rememberScrollState())) {
            val c = code
            when {
                c == null && failed -> {
                    Bar(onBack, onStage = false)
                    ErrorBox(stringResource(R.string.error_network), { scope.launch { load() } }, Modifier.padding(16.dp))
                }
                c == null -> { Bar(onBack, onStage = false); Loading() }
                else -> {
                    Header(c, me?.base ?: api.base, onBack, onView, update)
                    Column(Modifier.padding(16.dp).widthIn(max = 720.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
                        if (c.access == "owner") {
                            TitleCard(c, update)
                            if (c.content != null) ContentCard(c, update)
                            VisibilityCard(c, update)
                        }
                        Text(stringResource(R.string.tab_memory), style = Type.h1.copy(fontSize = androidx.compose.ui.unit.TextUnit(22f, androidx.compose.ui.unit.TextUnitType.Sp)), color = LocalQr.current.ink, modifier = Modifier.semantics { heading() })
                        MemoryEditor(c, update)
                        Spacer(Modifier.height(8.dp))
                        Text(stringResource(R.string.more_on_site), style = Type.small, color = LocalQr.current.muted)
                        QButton(stringResource(R.string.open_in_browser), { Actions.open(ctx, "${api.base}/codes/${c.id}") }, kind = BtnKind.Ghost, icon = Glyphs.Open, modifier = Modifier.fillMaxWidth())
                        Spacer(Modifier.height(40.dp))
                    }
                }
            }
            Spacer(Modifier.navigationBarsPadding())
        }
        StatusScrim(Night)
    }
}

@Composable
private fun Bar(onBack: () -> Unit, onStage: Boolean, share: String? = null) {
    val ctx = LocalContext.current
    val tint = if (onStage) Bone else LocalQr.current.ink
    Row(Modifier.fillMaxWidth().statusBarsPadding().padding(horizontal = 4.dp, vertical = 4.dp), verticalAlignment = Alignment.CenterVertically) {
        IconButton(onClick = onBack) { Icon(Glyphs.Back, stringResource(R.string.back), tint = tint) }
        Spacer(Modifier.weight(1f))
        if (share != null) IconButton(onClick = { Actions.share(ctx, share) }) { Icon(Glyphs.Share, stringResource(R.string.share), tint = tint) }
    }
}

/** The picture on the black stage, title, kind, who sees it; share the picture (through the price gate) and "As others see it". */
@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun Header(c: CodeView, base: String, onBack: () -> Unit, onView: (String) -> Unit, onChange: (CodeView) -> Unit) {
    val ctx = LocalContext.current
    val api = ctx.app.api
    val scope = rememberCoroutineScope()
    val title = c.title ?: stringResource(kindLabel(c.kind))
    var gate by remember { mutableStateOf<GateState?>(null) }
    var sharing by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf(false) }
    /** After Google Play: pending, unavailable, didn't finish. */
    var note by remember { mutableStateOf<Int?>(null) }
    // A memory code is paid when its picture is taken (like downloading on the site, key "code:{id}"); a generator code
    // was paid when it was created.
    val key = "code:${c.id}"
    val tier = Pricing.tierOf(c.style)

    fun share() {
        scope.launch {
            sharing = true
            error = false
            runCatching { sharePicture(ctx, api, c) }.onFailure { error = true }
            sharing = false
        }
    }
    fun ask() {
        note = null
        if (c.content != null || c.access != "owner") return share()
        scope.launch {
            gate = GateState.Checking
            runCatching { api.quote(key, tier) }
                .onSuccess { q -> if (q.paid) { gate = null; share() } else gate = GateState.Ask(q) }
                .onFailure { gate = null; error = true }
        }
    }

    Column(Modifier.fillMaxWidth().background(Night).dotGrid(Bone.copy(alpha = 0.07f))) {
        Bar(onBack, onStage = true, share = linkOf(base, c))
        Column(Modifier.padding(start = 16.dp, end = 16.dp, bottom = 20.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                CodeImage(c, base, stringResource(R.string.qr_of, title), Modifier.width(140.dp).aspectRatio(1f).clip(RoundedCornerShape(12.dp)).padding(0.dp))
                Spacer(Modifier.width(16.dp))
                Column(Modifier.weight(1f)) {
                    Kicker(stringResource(kindLabel(c.kind)), color = Lime)
                    Spacer(Modifier.height(4.dp))
                    Text(title, style = Type.h1, color = Bone, maxLines = 3, modifier = Modifier.semantics { heading() })
                    Spacer(Modifier.height(8.dp))
                    FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) { VisBadge(c.visibility, onStage = true) }
                    val scans = c.stats?.total ?: 0
                    Spacer(Modifier.height(8.dp))
                    Text(stringResource(R.string.scans_count) + ": $scans · " + stringResource(R.string.dash_week, c.stats?.week ?: 0), style = Type.small, color = Bone.copy(alpha = 0.7f))
                }
            }
            Spacer(Modifier.height(16.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                val shareLabel = stringResource(R.string.share_image)
                QButton(stringResource(R.string.share), ::ask, Modifier.weight(1f).semantics { contentDescription = shareLabel }, icon = Glyphs.Share, enabled = !sharing && gate == null)
                QButton(stringResource(R.string.dash_as_guest), { onView(c.id) }, Modifier.weight(1f), kind = BtnKind.Stage)
            }
            if (sharing) Row(Modifier.padding(top = 10.dp), verticalAlignment = Alignment.CenterVertically) {
                CircularProgressIndicator(Modifier.size(16.dp), color = Lime, strokeWidth = 2.dp)
            }
            if (error) Text(stringResource(R.string.error_network), style = Type.small, color = Lime, modifier = Modifier.padding(top = 8.dp))
            note?.let { Text(stringResource(it), style = Type.small, color = Lime, modifier = Modifier.padding(top = 8.dp)) }
            gate?.let { g ->
                Spacer(Modifier.height(12.dp))
                PriceGate(g, DownloadLabels, onConfirm = {
                    val qt = (g as? GateState.Ask)?.quote
                    scope.launch {
                        gate = GateState.Working
                        // Free / from a pack: the server records it. Paid: Google Play first, the server credits the key.
                        val ok = if (qt != null && (qt.free || qt.pack != null)) {
                            runCatching { api.pay(key, tier) }.onFailure { error = true }.isSuccess
                        } else {
                            val r = ctx.app.store.buy(ctx.activity(), Buy.Code(key, tier))
                            note = r.message()
                            r == BuyResult.Done
                        }
                        gate = null
                        if (ok) {
                            share()
                            // Paid → the server now draws it full size; reload so the picture here updates too.
                            runCatching { api.code(c.id) }.onSuccess(onChange)
                        }
                    }
                }, onCancel = { gate = null }, modifier = Modifier.border(1.dp, Bone.copy(alpha = 0.15f), RoundedCornerShape(14.dp)))
            }
        }
    }
}

@Composable
private fun SavedNote(state: Int?) {
    if (state == null) return
    val q = LocalQr.current
    Text(stringResource(state), style = Type.small, color = if (state == R.string.saved) q.ok else q.warn, modifier = Modifier.semantics { liveRegion = LiveRegionMode.Polite })
}

@Composable
private fun TitleCard(c: CodeView, onChange: (CodeView) -> Unit) {
    val api = LocalContext.current.app.api
    val scope = rememberCoroutineScope()
    var title by remember(c.id) { mutableStateOf(c.title ?: "") }
    var busy by remember { mutableStateOf(false) }
    var note by remember { mutableStateOf<Int?>(null) }
    val changed = title.trim() != (c.title ?: "") && title.isNotBlank()
    StepCard(null, stringResource(R.string.title_label)) {
        QField(title, { title = it; note = null }, stringResource(R.string.new_code_title), maxLength = 80)
        Spacer(Modifier.height(10.dp))
        Row(verticalAlignment = Alignment.CenterVertically) {
            QButton(stringResource(R.string.save), {
                scope.launch {
                    busy = true
                    runCatching { api.rename(c.id, title.trim()) }.onSuccess { onChange(it); note = R.string.saved }.onFailure { note = R.string.save_error }
                    busy = false
                }
            }, enabled = changed && !busy)
            Spacer(Modifier.width(12.dp))
            SavedNote(note)
        }
    }
}

/** What's in the code (generator codes): change it any time — the printed code stays the same. */
@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun ContentCard(c: CodeView, onChange: (CodeView) -> Unit) {
    val api = LocalContext.current.app.api
    val q = LocalQr.current
    val scope = rememberCoroutineScope()
    val content = c.content ?: return
    var type by remember(c.id) { mutableStateOf(content.type) }
    var all by remember(c.id) { mutableStateOf(mapOf(content.type to content.fields)) }
    var busy by remember { mutableStateOf(false) }
    var note by remember { mutableStateOf<Int?>(null) }
    val fields = all[type].orEmpty()
    val clean = Payload.clean(type, fields)
    val changed = type != content.type || clean != content.fields
    StepCard(null, stringResource(R.string.tab_link)) {
        Text(stringResource(R.string.link_hint), style = Type.small, color = q.muted)
        Spacer(Modifier.height(12.dp))
        FlowRow(Modifier.selectableGroup(), horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Payload.TYPES.forEach { t -> Chip(siteText(SiteText.type, t), type == t, { type = t; note = null }, icon = Glyphs.type(t)) }
        }
        Spacer(Modifier.height(14.dp))
        ContentFields(type, fields) { k, v -> all = all + (type to (fields + (k to v))); note = null }
        Spacer(Modifier.height(12.dp))
        Row(verticalAlignment = Alignment.CenterVertically) {
            QButton(stringResource(R.string.save), {
                scope.launch {
                    busy = true
                    runCatching { api.setContent(c.id, type, clean) }.onSuccess { onChange(it); note = R.string.saved }.onFailure { note = R.string.save_error }
                    busy = false
                }
            }, enabled = changed && Payload.valid(type, clean) && !busy)
            Spacer(Modifier.width(12.dp))
            SavedNote(note)
        }
    }
}

/** Who sees it: everyone / my contacts / chosen people / only me (the people list itself — on the site). */
@Composable
private fun VisibilityCard(c: CodeView, onChange: (CodeView) -> Unit) {
    val api = LocalContext.current.app.api
    val q = LocalQr.current
    val scope = rememberCoroutineScope()
    var busy by remember { mutableStateOf<String?>(null) }
    var failed by remember { mutableStateOf(false) }
    StepCard(null, stringResource(if (c.content != null) R.string.tab_access else R.string.vis_title)) {
        Column(Modifier.selectableGroup(), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            listOf("all", "contacts", "people", "me").forEach { v ->
                val on = c.visibility == v
                val shape = RoundedCornerShape(12.dp)
                Row(
                    Modifier.fillMaxWidth().clip(shape).background(if (on) q.accent else q.field).border(1.dp, if (on) q.accent else q.line, shape)
                        .selectable(on, enabled = busy == null, role = Role.RadioButton) {
                            if (on) return@selectable
                            busy = v
                            failed = false
                            scope.launch {
                                runCatching { api.setVisibility(c.id, v) }.onSuccess(onChange).onFailure { failed = true }
                                busy = null
                            }
                        }
                        .padding(12.dp),
                    verticalAlignment = Alignment.Top,
                ) {
                    Box(Modifier.size(22.dp), contentAlignment = Alignment.Center) {
                        if (busy == v) CircularProgressIndicator(Modifier.size(16.dp), color = q.ink, strokeWidth = 2.dp)
                        else Icon(Glyphs.visibility(v), null, tint = if (on) q.onAccent else q.ink, modifier = Modifier.size(20.dp))
                    }
                    Spacer(Modifier.width(12.dp))
                    Column(Modifier.weight(1f)) {
                        Text(siteText(SiteText.vis, v), style = Type.bodyStrong, color = if (on) q.onAccent else q.ink)
                        Text(siteText(SiteText.visHint, v), style = Type.small, color = if (on) q.onAccent.copy(alpha = 0.8f) else q.muted)
                    }
                }
            }
        }
        if (failed) Text(stringResource(R.string.save_error), style = Type.small, color = q.warn, modifier = Modifier.padding(top = 8.dp))
    }
}
