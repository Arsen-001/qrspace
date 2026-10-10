package co.qrspace.app.create

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
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
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.Saver
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import co.qrspace.app.R
import co.qrspace.app.app
import co.qrspace.app.data.ApiException
import co.qrspace.app.data.Look
import co.qrspace.app.billing.Buy
import co.qrspace.app.billing.BuyResult
import co.qrspace.app.billing.activity
import co.qrspace.app.billing.message
import co.qrspace.app.data.Payload
import co.qrspace.app.data.Pricing
import co.qrspace.app.ui.Bone
import co.qrspace.app.ui.Glyphs
import co.qrspace.app.ui.Lime
import co.qrspace.app.ui.LocalQr
import co.qrspace.app.ui.Night
import co.qrspace.app.ui.QButton
import co.qrspace.app.ui.QCard
import co.qrspace.app.ui.QField
import co.qrspace.app.ui.Screen
import co.qrspace.app.ui.SiteText
import co.qrspace.app.ui.StatusScrim
import co.qrspace.app.ui.StepCard
import co.qrspace.app.ui.Type
import kotlinx.coroutines.launch
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive

private val LookSaver = Saver<Look, List<Any?>>(
    save = { listOf(it.fg, it.bg, it.eyeColor, it.dot, it.eye, it.eyeBall, it.eyeBallColor, it.gradientTo, it.effect) },
    restore = { Look(it[0] as String, it[1] as String, it[2] as String, it[3] as String, it[4] as String, it[5] as String, it[6] as String, it[7] as String?, 45, it[8] as String) },
)

/** All typed fields of all types (switching type keeps what was typed), kept across rotation as JSON. */
private typealias AllFields = Map<String, Map<String, String>>

private val FieldsSaver = Saver<AllFields, String>(
    save = { JsonObject(it.mapValues { (_, f) -> JsonObject(f.mapValues { e -> JsonPrimitive(e.value) }) }).toString() },
    restore = { s -> Json.parseToJsonElement(s).jsonObject.mapValues { (_, f) -> f.jsonObject.mapValues { it.value.jsonPrimitive.content } } },
)

/**
 * Create a new QR (the web's /create): what's in the code → how it looks (live preview drawn by the server) → the price
 * gate (first simple code free / from a pack / a code bought in Google Play) → the code. Or a memory code: name,
 * template, look.
 */
@Composable
fun CreateScreen(onBack: () -> Unit, onCreated: (String) -> Unit, onSignIn: () -> Unit) {
    val ctx = LocalContext.current
    val api = ctx.app.api
    val session = ctx.app.session
    val me by session.me.collectAsState()
    val q = LocalQr.current
    val scope = rememberCoroutineScope()

    var mode by rememberSaveable { mutableStateOf("content") }
    var type by rememberSaveable { mutableStateOf("url") }
    var all by rememberSaveable(stateSaver = FieldsSaver) { mutableStateOf<AllFields>(mapOf("wifi" to mapOf("security" to "WPA"))) }
    var title by rememberSaveable { mutableStateOf("") }
    var kind by rememberSaveable { mutableStateOf("memory") }
    var look by rememberSaveable(stateSaver = LookSaver) { mutableStateOf(Look()) }
    var gate by remember { mutableStateOf<GateState?>(null) }
    var error by remember { mutableStateOf<Int?>(null) }
    var needLogin by remember { mutableStateOf(false) }

    val fields = all[type].orEmpty()
    val clean = Payload.clean(type, fields)
    val ready = if (mode == "content") Payload.valid(type, clean) else title.isNotBlank()
    val tier = Pricing.tierOf(look)

    fun failed(e: Throwable) {
        gate = null
        when {
            e is ApiException && e.code == 401 -> needLogin = true
            e is ApiException && e.code == 429 -> error = R.string.limit_today
            else -> error = R.string.save_error
        }
    }

    val key = Pricing.codeKey(Payload.build(type, clean), look.toJson().toString())

    // Content code: the server makes it only against the purchase with this key (one purchase = one code); the same
    // content again → a new code after a new purchase (10.10.2026). A name typed here goes along.
    suspend fun makeQuick() {
        gate = GateState.Working
        runCatching { api.quick(type, clean, look, key, title.trim().ifEmpty { null }) }
            .onSuccess { r -> session.changed(); onCreated(r.id) }
            .onFailure { e ->
                if (e is ApiException && e.code == 402) {
                    // No unused purchase for this key (e.g. it went to a code that still exists) — ask again.
                    runCatching { api.quote(key, tier) }
                        .onSuccess { qt -> if (qt.paid) failed(e) else gate = GateState.Ask(qt) }
                        .onFailure(::failed)
                } else failed(e)
            }
    }
    fun create() {
        error = null
        needLogin = false
        if (me?.me == null) { needLogin = true; return }
        scope.launch {
            if (mode == "memory") {
                gate = GateState.Working
                runCatching { api.createCode(title.trim(), kind, look) }
                    .onSuccess { session.changed(); onCreated(it.id) }
                    .onFailure(::failed)
                return@launch
            }
            gate = GateState.Checking
            runCatching { api.quote(key, tier) }
                .onSuccess { qt -> if (qt.paid) makeQuick() else gate = GateState.Ask(qt) }
                .onFailure(::failed)
        }
    }

    Screen {
        Column(Modifier.fillMaxSize().imePadding().verticalScroll(rememberScrollState())) {
            Row(Modifier.fillMaxWidth().statusBarsPadding().padding(horizontal = 4.dp, vertical = 4.dp), verticalAlignment = Alignment.CenterVertically) {
                IconButton(onClick = onBack) { Icon(Glyphs.Back, stringResource(R.string.back), tint = q.ink) }
                Text(stringResource(R.string.make_title), style = Type.h2, color = q.ink, modifier = Modifier.semantics { heading() })
            }
            Column(Modifier.padding(horizontal = 16.dp).widthIn(max = 720.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
                // What kind of code: content (link, Wi‑Fi…) or memory (photos, video, text under it).
                Row(Modifier.selectableGroup(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    ModeTile(stringResource(R.string.mode_content), stringResource(R.string.mode_content_hint), Glyphs.Qr, mode == "content", Modifier.weight(1f)) { mode = "content"; gate = null }
                    ModeTile(stringResource(R.string.mode_memory), stringResource(R.string.mode_memory_hint), Glyphs.Book, mode == "memory", Modifier.weight(1f)) { mode = "memory"; gate = null }
                }

                if (mode == "content") {
                    StepCard(1, stringResource(R.string.step1)) {
                        ContentTypePicker(type) { type = it; gate = null }
                        Spacer(Modifier.height(16.dp))
                        Row(
                            Modifier.fillMaxWidth().clip(RoundedCornerShape(10.dp)).border(1.dp, q.line, RoundedCornerShape(10.dp)).padding(12.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Icon(Glyphs.type(type), null, tint = q.accentInk, modifier = Modifier.size(20.dp))
                            Spacer(Modifier.width(10.dp))
                            Text(siteText(SiteText.hint, type), style = Type.small, color = q.ink)
                        }
                        Spacer(Modifier.height(16.dp))
                        ContentFields(type, fields) { k, v -> all = all + (type to (fields + (k to v))); gate = null }
                        Spacer(Modifier.height(12.dp))
                        QField(title, { title = it }, stringResource(R.string.code_name_optional), placeholder = if (clean.isNotEmpty()) Payload.titleOf(type, clean) else null, maxLength = 80)
                    }
                } else {
                    StepCard(1, stringResource(R.string.template_label)) {
                        QField(title, { title = it }, stringResource(R.string.new_code_title), placeholder = stringResource(R.string.new_code_placeholder), maxLength = 80)
                        Spacer(Modifier.height(14.dp))
                        Column(Modifier.selectableGroup(), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            listOf("memory", "car", "lost", "pet").forEach { k ->
                                KindRow(k, kind == k) { kind = k }
                            }
                        }
                    }
                }

                StepCard(2, stringResource(R.string.step2)) {
                    Box(Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
                        LivePreview(look, Modifier.fillMaxWidth(0.8f).widthIn(max = 360.dp).aspectRatio(1f).clip(RoundedCornerShape(12.dp)).border(1.dp, q.line, RoundedCornerShape(12.dp)))
                    }
                    Spacer(Modifier.height(14.dp))
                    if (mode == "content") TierRow(tier)
                    Spacer(Modifier.height(18.dp))
                    LookPicker(look) { look = it; gate = null }
                }

                if (needLogin) QCard(Modifier.fillMaxWidth()) {
                    Text(stringResource(R.string.login_to_create), style = Type.body, color = q.ink)
                    Spacer(Modifier.height(12.dp))
                    QButton(stringResource(R.string.login), onSignIn, Modifier.fillMaxWidth())
                }
                error?.let { Text(stringResource(it), style = Type.bodyStrong, color = q.warn) }

                val g = gate
                if (g != null) {
                    PriceGate(g, CreateLabels, onConfirm = {
                        val qt = (g as? GateState.Ask)?.quote
                        scope.launch {
                            gate = GateState.Working
                            if (qt != null && (qt.free || qt.pack != null)) {
                                // The first simple code / a code from a pack: no money, the server just records it.
                                runCatching { api.pay(key, tier) }.onSuccess { makeQuick() }.onFailure(::failed)
                            } else {
                                // A paid code: Google Play, the server credits the key, then the code as before.
                                val r = ctx.app.store.buy(ctx.activity(), Buy.Code(key, tier))
                                if (r == BuyResult.Done) makeQuick() else { gate = null; error = r.message() }
                            }
                        }
                    }, onCancel = { gate = null })
                } else {
                    QButton(
                        stringResource(R.string.create), ::create, Modifier.fillMaxWidth().heightIn(min = 56.dp),
                        icon = Glyphs.Plus, enabled = ready,
                    )
                }
                Spacer(Modifier.height(40.dp))
                Spacer(Modifier.navigationBarsPadding())
            }
        }
        StatusScrim(q.bg)
    }
}

@Composable
private fun ModeTile(title: String, hint: String, icon: androidx.compose.ui.graphics.vector.ImageVector, on: Boolean, modifier: Modifier, onClick: () -> Unit) {
    val q = LocalQr.current
    val shape = RoundedCornerShape(14.dp)
    Column(
        modifier.clip(shape).background(if (on) q.picked else q.card).border(1.dp, if (on) q.pickedLine else q.line, shape)
            .selectable(on, role = Role.RadioButton, onClick = onClick).padding(14.dp),
    ) {
        Icon(icon, null, tint = if (on) Lime else q.ink, modifier = Modifier.size(24.dp))
        Spacer(Modifier.height(10.dp))
        Text(title, style = Type.h3, color = if (on) Bone else q.ink)
        Spacer(Modifier.height(4.dp))
        Text(hint, style = Type.small, color = if (on) Bone.copy(alpha = 0.7f) else q.muted)
    }
}

@Composable
private fun KindRow(k: String, on: Boolean, onClick: () -> Unit) {
    val q = LocalQr.current
    val shape = RoundedCornerShape(12.dp)
    Row(
        Modifier.fillMaxWidth().clip(shape).background(if (on) q.accent else q.field).border(1.dp, if (on) q.accent else q.line, shape)
            .selectable(on, role = Role.RadioButton, onClick = onClick).padding(12.dp),
        verticalAlignment = Alignment.Top,
    ) {
        Icon(Glyphs.kind(k), null, tint = if (on) q.onAccent else q.ink, modifier = Modifier.size(22.dp))
        Spacer(Modifier.width(12.dp))
        Column(Modifier.weight(1f)) {
            Text(stringResource(co.qrspace.app.ui.kindLabel(k)), style = Type.h3, color = if (on) q.onAccent else q.ink)
            Text(siteText(SiteText.tplHint, k), style = Type.small, color = if (on) q.onAccent.copy(alpha = 0.8f) else q.muted)
        }
    }
}
