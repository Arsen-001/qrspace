package co.qrspace.app.account

import android.widget.Toast
import co.qrspace.app.BuildConfig
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
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
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import co.qrspace.app.R
import co.qrspace.app.app
import co.qrspace.app.codes.Avatar
import co.qrspace.app.data.ApiException
import co.qrspace.app.data.Notice
import co.qrspace.app.data.Notices
import co.qrspace.app.data.Profile
import co.qrspace.app.data.Session
import co.qrspace.app.ui.Bone
import co.qrspace.app.ui.BtnKind
import co.qrspace.app.ui.ErrorBox
import co.qrspace.app.ui.Glyphs
import co.qrspace.app.ui.Kicker
import co.qrspace.app.ui.Lime
import co.qrspace.app.ui.Loading
import co.qrspace.app.ui.LocalQr
import co.qrspace.app.ui.Pill
import co.qrspace.app.ui.QButton
import co.qrspace.app.ui.QCard
import co.qrspace.app.ui.Radius
import co.qrspace.app.ui.RadiusSm
import co.qrspace.app.ui.Screen
import co.qrspace.app.ui.StatusScrim
import co.qrspace.app.ui.Type
import co.qrspace.app.ui.dotGrid
import co.qrspace.app.ui.fmtBytes
import co.qrspace.app.ui.fmtDate
import co.qrspace.app.ui.fmtUsd
import kotlinx.coroutines.launch

@Composable
fun AccountScreen(onSignedIn: () -> Unit = {}) {
    val ctx = LocalContext.current
    val session = ctx.app.session
    val me by session.me.collectAsState()
    val error by session.error.collectAsState()
    val scope = rememberCoroutineScope()
    LaunchedEffect(Unit) { if (me == null) session.refresh() }

    Screen {
        Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState())) {
            val m = me
            when {
                m == null && error -> Box(Modifier.statusBarsPadding().padding(20.dp)) { ErrorBox(stringResource(R.string.error_network), { scope.launch { session.refresh() } }) }
                m == null -> Box(Modifier.statusBarsPadding()) { Loading() }
                m.me == null -> SignIn(onSignedIn)
                else -> Signed()
            }
            if (BuildConfig.DEBUG) ServerSwitch()
            Spacer(Modifier.height(120.dp))
        }
        StatusScrim(LocalQr.current.stage)
    }
}

/** Open the site's sign-in in a Custom Tab; it comes back through qrspace://auth?token=… (MainActivity). */
fun openSignIn(ctx: android.content.Context, url: String) {
    val tab = androidx.browser.customtabs.CustomTabsIntent.Builder()
        .setShowTitle(true)
        .setDefaultColorSchemeParams(androidx.browser.customtabs.CustomTabColorSchemeParams.Builder().setToolbarColor(0xFF0B0B0C.toInt()).build())
        .build()
    runCatching { tab.launchUrl(ctx, android.net.Uri.parse(url)) }.onFailure { co.qrspace.app.scan.Actions.open(ctx, url) }
}

/**
 * Sign-in: Google / Apple (only when the server has the keys — /api/me providers), "Sign in on qrspace.co" (the site's
 * own sign-in page, demo people included) — all in a Custom Tab that returns here with a one-time code; and the
 * in-app demo picker while the server is in demo mode.
 */
@Composable
private fun SignIn(onSignedIn: () -> Unit) {
    val ctx = LocalContext.current
    val q = LocalQr.current
    val session = ctx.app.session
    val api = ctx.app.api
    val me by session.me.collectAsState()
    val scope = rememberCoroutineScope()
    var busy by remember { mutableStateOf<String?>(null) }
    val providers = me?.providers

    Column(Modifier.fillMaxWidth().background(q.stage).dotGrid(Bone.copy(alpha = 0.07f)).statusBarsPadding().padding(20.dp)) {
        Spacer(Modifier.height(28.dp))
        Kicker(stringResource(R.string.account_title), color = Lime)
        Spacer(Modifier.height(8.dp))
        Text(stringResource(R.string.login_title), style = Type.hero, color = Bone, modifier = Modifier.semantics { heading() })
        Spacer(Modifier.height(10.dp))
        Text(stringResource(R.string.login_only_hint), style = Type.body, color = Bone.copy(alpha = 0.75f))
        Spacer(Modifier.height(22.dp))
        if (providers?.google == true) {
            QButton(stringResource(R.string.with_google), { openSignIn(ctx, api.signInUrl("google")) }, kind = BtnKind.Lime, modifier = Modifier.fillMaxWidth())
            Spacer(Modifier.height(10.dp))
        }
        if (providers?.apple == true) {
            QButton(stringResource(R.string.with_apple), { openSignIn(ctx, api.signInUrl("apple")) }, kind = BtnKind.Stage, modifier = Modifier.fillMaxWidth())
            Spacer(Modifier.height(10.dp))
        }
        QButton(
            stringResource(R.string.signin_site, api.siteName), { openSignIn(ctx, api.signInUrl(null)) },
            kind = if (providers?.google == true || providers?.apple == true) BtnKind.Stage else BtnKind.Lime,
            icon = Glyphs.Open, modifier = Modifier.fillMaxWidth(),
        )
        Spacer(Modifier.height(8.dp))
        Text(stringResource(R.string.signin_site_hint), style = Type.small, color = Bone.copy(alpha = 0.6f))
        if (providers != null && !providers.google && !providers.apple) {
            Spacer(Modifier.height(10.dp))
            Text(stringResource(R.string.providers_pending), style = Type.small, color = Bone.copy(alpha = 0.6f))
        }
        Spacer(Modifier.height(8.dp))
    }

    val m = me ?: return
    if (!m.demo) return
    Column(Modifier.padding(20.dp)) {
        Text(stringResource(R.string.demo_account), style = Type.h2, color = q.ink)
        Spacer(Modifier.height(4.dp))
        Text(stringResource(R.string.login_hint), style = Type.small, color = q.muted)
        Spacer(Modifier.height(14.dp))
        val lang = Session.lang()
        m.people.filter { !it.admin }.forEach { p ->
            Row(
                Modifier.fillMaxWidth().padding(bottom = 8.dp).clip(Radius).background(q.card).border(1.dp, q.line, Radius)
                    .clickable(enabled = busy == null, role = Role.Button) {
                        busy = p.id
                        scope.launch {
                            runCatching { session.signIn(p.id) }.onSuccess { onSignedIn() }.onFailure { Toast.makeText(ctx, R.string.error_network, Toast.LENGTH_LONG).show() }
                            busy = null
                        }
                    }
                    .padding(14.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Avatar(p.localName(lang), p.color, 40)
                Spacer(Modifier.width(12.dp))
                Column(Modifier.weight(1f)) {
                    Text(p.localName(lang), style = Type.h3, color = q.ink)
                    Text(p.localDemo(lang), style = Type.small, color = q.muted)
                }
                if (busy == p.id) CircularProgressIndicator(Modifier.size(20.dp), color = q.accentInk, strokeWidth = 2.dp)
                else Icon(Glyphs.Chevron, null, tint = q.muted, modifier = Modifier.size(20.dp))
            }
        }
    }
}

@Composable
private fun Signed() {
    val ctx = LocalContext.current
    val q = LocalQr.current
    val api = ctx.app.api
    val session = ctx.app.session
    val epoch by session.epoch.collectAsState()
    val meState by session.me.collectAsState()
    var profile by remember { mutableStateOf<Profile?>(null) }
    var notices by remember { mutableStateOf<Notices?>(null) }
    var failed by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()

    suspend fun load() {
        failed = false
        runCatching { api.profile() }.onSuccess { profile = it }.onFailure {
            if (it is ApiException && it.code == 401) session.refresh() else failed = true
        }
        notices = runCatching { api.notifications() }.getOrNull()
    }
    LaunchedEffect(epoch) { load() }

    val p = profile
    // Header on the stage: who I am.
    Column(Modifier.fillMaxWidth().background(q.stage).dotGrid(Bone.copy(alpha = 0.07f)).statusBarsPadding().padding(20.dp)) {
        Spacer(Modifier.height(16.dp))
        Kicker(stringResource(R.string.account_title), color = Lime)
        Spacer(Modifier.height(10.dp))
        val me = meState?.me
        val person = session.person(me)
        Row(verticalAlignment = Alignment.CenterVertically) {
            Avatar(p?.name ?: person?.localName(Session.lang()) ?: "?", person?.color ?: "#2e3fd6", 52)
            Spacer(Modifier.width(14.dp))
            Column(Modifier.weight(1f)) {
                Text(p?.name ?: person?.localName(Session.lang()) ?: "", style = Type.h1, color = Bone, modifier = Modifier.semantics { heading() })
                val provider = p?.provider ?: "demo"
                Text(
                    if (provider == "demo") stringResource(R.string.demo_account) else stringResource(R.string.acc_signed_with) + " " + provider.replaceFirstChar { it.uppercase() } + (p?.email?.takeIf { it.isNotEmpty() }?.let { " · $it" } ?: ""),
                    style = Type.small, color = Bone.copy(alpha = 0.65f),
                )
            }
        }
        Spacer(Modifier.height(20.dp))
        if (p != null) {
            Row(Modifier.fillMaxWidth().height(IntrinsicSize.Min), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                Stat(stringResource(R.string.nav_codes), "${p.codes}", null, Modifier.weight(1f).fillMaxHeight())
                Stat(stringResource(R.string.acc_scans30), "${p.stats.scans30}", stringResource(R.string.acc_scans_all, p.stats.scans), Modifier.weight(1f).fillMaxHeight())
            }
            Spacer(Modifier.height(10.dp))
            Row(Modifier.fillMaxWidth().height(IntrinsicSize.Min), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                SpaceStat(p.stats.used, p.stats.quota, Modifier.weight(1f).fillMaxHeight())
                Stat(stringResource(R.string.acc_packs_left), "${p.stats.packsLeft}", null, Modifier.weight(1f).fillMaxHeight())
            }
        }
    }

    Column(Modifier.padding(20.dp)) {
        when {
            failed && p == null -> ErrorBox(stringResource(R.string.error_network), { scope.launch { load() } })
            p == null -> Loading()
            else -> {
                notices?.let { NoticesCard(it) }
                Section(stringResource(R.string.acc_purchases), if (p.stats.spent > 0) stringResource(R.string.acc_spent) + " " + fmtUsd(p.stats.spent) else null)
                if (p.purchases.isEmpty()) {
                    Text(stringResource(R.string.no_purchases), style = Type.body, color = q.muted)
                } else QCard(Modifier.fillMaxWidth(), padding = androidx.compose.foundation.layout.PaddingValues(horizontal = 16.dp, vertical = 4.dp)) {
                    p.purchases.forEachIndexed { i, b ->
                        if (i > 0) Box(Modifier.fillMaxWidth().height(1.dp).background(q.line))
                        Row(Modifier.fillMaxWidth().padding(vertical = 12.dp), verticalAlignment = Alignment.CenterVertically) {
                            Column(Modifier.weight(1f)) {
                                Text(stringResource(if (b.tier == "styled") R.string.tier_styled else R.string.tier_simple), style = Type.bodyStrong, color = q.ink)
                                Text(fmtDate(b.at), style = Type.small, color = q.muted)
                            }
                            when {
                                b.pack != null -> Pill(stringResource(R.string.acc_from_pack), bg = q.field, fg = q.ink)
                                b.free -> Pill(stringResource(R.string.free))
                                else -> Text(fmtUsd(b.price), style = Type.h3, color = q.ink)
                            }
                        }
                    }
                }
                Spacer(Modifier.height(24.dp))
                Section(stringResource(R.string.acc_packs), null)
                if (p.packs.isEmpty()) {
                    Text(stringResource(R.string.acc_no_packs), style = Type.body, color = q.muted)
                } else p.packs.forEach { pk ->
                    QCard(Modifier.fillMaxWidth().padding(bottom = 8.dp)) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Text(stringResource(R.string.acc_pack_item) + " · ${pk.codes} QR", style = Type.h3, color = q.ink, modifier = Modifier.weight(1f))
                            Text(fmtUsd(pk.price), style = Type.h3, color = q.ink)
                        }
                        Spacer(Modifier.height(8.dp))
                        Bar(if (pk.codes == 0) 0f else pk.used.toFloat() / pk.codes)
                        Spacer(Modifier.height(6.dp))
                        Text(stringResource(R.string.acc_pack_used, pk.used, pk.codes) + " · " + fmtDate(pk.at), style = Type.small, color = q.muted)
                    }
                }
                Spacer(Modifier.height(28.dp))
                QButton(stringResource(R.string.open_in_browser), { co.qrspace.app.scan.Actions.open(ctx, "${api.base}/account") }, kind = BtnKind.Ghost, icon = Glyphs.Open, modifier = Modifier.fillMaxWidth())
                Spacer(Modifier.height(10.dp))
                QButton(stringResource(R.string.logout), { scope.launch { session.signOut() } }, kind = BtnKind.Ink, icon = Glyphs.Exit, modifier = Modifier.fillMaxWidth())
                // Demo people can't be deleted (the server answers 403) — no button, as on the site.
                if (p.provider != "demo") {
                    Spacer(Modifier.height(16.dp))
                    DeleteAccount()
                }
            }
        }
    }
}

@Composable
private fun Section(title: String, extra: String?) {
    val q = LocalQr.current
    Row(Modifier.fillMaxWidth().padding(bottom = 10.dp), verticalAlignment = Alignment.Bottom) {
        Text(title, style = Type.h2, color = q.ink, modifier = Modifier.weight(1f).semantics { heading() })
        if (extra != null) Text(extra, style = Type.small, color = q.muted)
    }
}

@Composable
private fun Stat(label: String, value: String, sub: String?, modifier: Modifier) {
    Column(modifier.clip(RoundedCornerShape(10.dp)).border(1.dp, Bone.copy(alpha = 0.14f), RoundedCornerShape(10.dp)).padding(14.dp)) {
        Kicker(label, color = Bone.copy(alpha = 0.6f))
        Spacer(Modifier.height(6.dp))
        Text(value, style = Type.stat, color = Lime)
        if (sub != null) Text(sub, style = Type.small, color = Bone.copy(alpha = 0.6f))
    }
}

@Composable
private fun SpaceStat(used: Long, quota: Long, modifier: Modifier) {
    Column(modifier.clip(RoundedCornerShape(10.dp)).border(1.dp, Bone.copy(alpha = 0.14f), RoundedCornerShape(10.dp)).padding(14.dp)) {
        Kicker(stringResource(R.string.acc_space), color = Bone.copy(alpha = 0.6f))
        Spacer(Modifier.height(6.dp))
        Text(
            buildAnnotatedString {
                withStyle(SpanStyle(color = Lime)) { append(fmtBytes(used)) }
            },
            style = Type.h2,
        )
        Text("/ " + fmtBytes(quota), style = Type.small, color = Bone.copy(alpha = 0.6f))
        Spacer(Modifier.height(8.dp))
        Bar(if (quota == 0L) 0f else (used.toFloat() / quota).coerceIn(0f, 1f), track = Bone.copy(alpha = 0.15f))
    }
}

@Composable
private fun Bar(frac: Float, track: androidx.compose.ui.graphics.Color = LocalQr.current.field) {
    Box(Modifier.fillMaxWidth().height(6.dp).clip(RoundedCornerShape(3.dp)).background(track)) {
        Box(Modifier.fillMaxWidth(frac.coerceIn(0.02f, 1f)).fillMaxHeight().background(Lime))
    }
}

@Composable
private fun NoticesCard(n: Notices) {
    val q = LocalQr.current
    val session = LocalContext.current.app.session
    Section(stringResource(R.string.notifications), if (n.unread > 0) "${n.unread}" else null)
    QCard(Modifier.fillMaxWidth()) {
        if (n.due > 0) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(Glyphs.Bell, null, tint = q.warn, modifier = Modifier.size(18.dp))
                Spacer(Modifier.width(8.dp))
                Text(stringResource(R.string.tasks_due, n.due), style = Type.bodyStrong, color = q.ink)
            }
            if (n.items.isNotEmpty()) Spacer(Modifier.height(10.dp))
        }
        if (n.items.isEmpty() && n.due == 0) Text(stringResource(R.string.notifications_empty), style = Type.body, color = q.muted)
        n.items.take(8).forEach { item ->
            Row(Modifier.fillMaxWidth().padding(vertical = 6.dp), verticalAlignment = Alignment.Top) {
                Box(Modifier.padding(top = 7.dp).size(8.dp).clip(RoundedCornerShape(4.dp)).background(if (item.read) q.line else Lime))
                Spacer(Modifier.width(10.dp))
                Column(Modifier.weight(1f)) {
                    Text(noticeText(item, session), style = Type.body, color = q.ink)
                    Text(fmtDate(item.at), style = Type.small, color = q.muted)
                }
            }
        }
    }
    Spacer(Modifier.height(24.dp))
}

@Composable
private fun noticeText(n: Notice, session: Session): String {
    val res = when (n.kind) {
        "message" -> R.string.notice_message
        "request" -> R.string.notice_request
        "joined" -> R.string.notice_joined
        "granted" -> R.string.notice_granted
        "outbid" -> R.string.notice_outbid
        "bid" -> R.string.notice_bid
        "sold" -> R.string.notice_sold
        "won" -> R.string.notice_won
        else -> null
    } ?: return n.params["title"] ?: n.kind
    return stringResource(res, session.name(n.params["who"]) ?: "", n.params["title"] ?: "", n.params["amount"] ?: "")
}

/** Debug builds only: which server the app talks to (local web server for tests, or production). */
@Composable
private fun ServerSwitch() {
    val ctx = LocalContext.current
    val q = LocalQr.current
    val api = ctx.app.api
    val session = ctx.app.session
    val scope = rememberCoroutineScope()
    var url by remember { mutableStateOf(api.base) }
    Column(Modifier.padding(horizontal = 20.dp, vertical = 8.dp)) {
        Kicker(stringResource(R.string.server_title))
        Spacer(Modifier.height(8.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            listOf("http://10.0.2.2:3720", "https://qrspace.co").forEach { u ->
                co.qrspace.app.ui.Chip(u.substringAfter("://"), api.base == u, { url = u; scope.launch { session.switchServer(u) } }, Modifier.weight(1f))
            }
        }
        Spacer(Modifier.height(8.dp))
        Row(verticalAlignment = Alignment.CenterVertically) {
            co.qrspace.app.ui.QField(url, { url = it }, "URL", Modifier.weight(1f), keyboard = androidx.compose.ui.text.input.KeyboardType.Uri)
            Spacer(Modifier.width(8.dp))
            QButton(stringResource(R.string.server_apply), { scope.launch { session.switchServer(url) } }, kind = BtnKind.Ink, enabled = url.startsWith("http"))
        }
        Text(api.base, style = Type.small, color = q.muted, modifier = Modifier.padding(top = 4.dp))
    }
}

/** "Delete account" with a clear confirm step, in the site's words (AccountPage Settings). */
@Composable
private fun DeleteAccount() {
    val ctx = LocalContext.current
    val q = LocalQr.current
    val session = ctx.app.session
    val scope = rememberCoroutineScope()
    var sure by remember { mutableStateOf(false) }
    var busy by remember { mutableStateOf(false) }
    var failed by remember { mutableStateOf(false) }
    if (!sure) {
        androidx.compose.material3.TextButton({ sure = true; failed = false }, Modifier.fillMaxWidth().heightIn(min = 48.dp)) {
            Text(stringResource(R.string.delete_account), style = Type.small, color = q.muted)
        }
        return
    }
    Column(
        Modifier.fillMaxWidth().clip(Radius).background(q.warnSoft).padding(16.dp)
            .semantics { liveRegion = androidx.compose.ui.semantics.LiveRegionMode.Polite },
    ) {
        Text(stringResource(R.string.delete_account_sure), style = Type.bodyStrong, color = q.warn)
        Spacer(Modifier.height(12.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
            Box(
                Modifier.weight(1f).heightIn(min = 48.dp).clip(RadiusSm).background(if (busy) q.warn.copy(alpha = 0.5f) else q.warn)
                    .clickable(enabled = !busy, role = Role.Button) {
                        busy = true
                        failed = false
                        scope.launch {
                            runCatching {
                                session.deleteAccount {
                                    coil3.SingletonImageLoader.get(ctx).let { l -> l.memoryCache?.clear(); l.diskCache?.clear() }
                                    java.io.File(ctx.cacheDir, "shared").deleteRecursively()
                                }
                            }.onFailure { failed = true }
                            busy = false
                        }
                    }
                    .padding(horizontal = 16.dp, vertical = 12.dp),
                contentAlignment = Alignment.Center,
            ) {
                if (busy) CircularProgressIndicator(Modifier.size(18.dp), color = Bone, strokeWidth = 2.dp)
                else Text(stringResource(R.string.delete_account_yes), style = Type.button, color = Bone)
            }
            androidx.compose.material3.TextButton({ sure = false }, enabled = !busy) { Text(stringResource(R.string.cancel), color = q.muted) }
        }
        if (failed) Text(stringResource(R.string.save_error), style = Type.small, color = q.warn, modifier = Modifier.padding(top = 8.dp))
    }
}
