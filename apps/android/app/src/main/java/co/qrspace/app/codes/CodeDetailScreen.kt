package co.qrspace.app.codes

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
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
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import co.qrspace.app.R
import co.qrspace.app.app
import co.qrspace.app.data.ApiException
import co.qrspace.app.data.Block
import co.qrspace.app.data.CodeView
import co.qrspace.app.scan.Actions
import co.qrspace.app.scan.CodeFormat
import co.qrspace.app.scan.ResultCard
import co.qrspace.app.scan.toScan
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
import co.qrspace.app.ui.Screen
import co.qrspace.app.ui.StatusScrim
import co.qrspace.app.ui.Type
import co.qrspace.app.ui.dotGrid
import co.qrspace.app.ui.fmtDate
import co.qrspace.app.ui.kindLabel
import coil3.compose.AsyncImage
import kotlinx.coroutines.launch

private sealed interface DState {
    data object Busy : DState
    data object Missing : DState
    data object Failed : DState
    data class Ok(val code: CodeView, val base: String) : DState
}

/** A code inside the app: title, owner, what's in it and the memory (text, photos, videos). */
@Composable
fun CodeDetailScreen(id: String?, short: String?, visit: Boolean, onBack: () -> Unit, onSignIn: () -> Unit, onEdit: (String) -> Unit) {
    val ctx = LocalContext.current
    val api = ctx.app.api
    val session = ctx.app.session
    val me by session.me.collectAsState()
    val epoch by session.epoch.collectAsState()
    var state by remember { mutableStateOf<DState>(DState.Busy) }
    val scope = rememberCoroutineScope()

    suspend fun load() {
        state = try {
            // Short link (/K/ABC123): the server's /api/verify maps it to the code id.
            val codeId = id ?: api.resolve("${api.base}/K/$short").id
            if (codeId == null) DState.Missing else DState.Ok(api.code(codeId, visit), me?.base ?: api.base)
        } catch (e: ApiException) {
            if (e.code == 404) DState.Missing else DState.Failed
        } catch (_: Exception) {
            DState.Failed
        }
    }
    LaunchedEffect(id, short, epoch) { load() }

    Screen {
        Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState())) {
            when (val s = state) {
                DState.Busy -> { TopBar(onBack, null); Loading(label = stringResource(R.string.opening_code)) }
                DState.Missing -> {
                    TopBar(onBack, null)
                    QCard(Modifier.padding(20.dp).fillMaxWidth()) {
                        Text(stringResource(R.string.not_found), style = Type.h2, color = LocalQr.current.ink)
                        Spacer(Modifier.height(6.dp))
                        Text(stringResource(R.string.not_found_hint), style = Type.body, color = LocalQr.current.muted)
                    }
                }
                DState.Failed -> { TopBar(onBack, null); ErrorBox(stringResource(R.string.error_network), { scope.launch { state = DState.Busy; load() } }, Modifier.padding(20.dp)) }
                is DState.Ok -> Detail(s.code, s.base, signedIn = me?.me != null, onBack = onBack, onSignIn = onSignIn, onEdit = onEdit) { state = DState.Ok(it, s.base) }
            }
            Spacer(Modifier.height(48.dp))
        }
        StatusScrim(LocalQr.current.stage)
    }
}

@Composable
private fun TopBar(onBack: () -> Unit, share: String?, onStage: Boolean = false) {
    val ctx = LocalContext.current
    val tint = if (onStage) Bone else LocalQr.current.ink
    Row(Modifier.fillMaxWidth().statusBarsPadding().padding(horizontal = 4.dp, vertical = 4.dp), verticalAlignment = Alignment.CenterVertically) {
        IconButton(onClick = onBack) { Icon(Glyphs.Back, stringResource(R.string.back), tint = tint) }
        Spacer(Modifier.weight(1f))
        if (share != null) IconButton(onClick = { Actions.share(ctx, share) }) { Icon(Glyphs.Share, stringResource(R.string.share), tint = tint) }
    }
}

@Composable
private fun Detail(c: CodeView, base: String, signedIn: Boolean, onBack: () -> Unit, onSignIn: () -> Unit, onEdit: (String) -> Unit, onChange: (CodeView) -> Unit) {
    val ctx = LocalContext.current
    val q = LocalQr.current
    val session = ctx.app.session
    val link = linkOf(base, c)
    val title = c.title ?: stringResource(kindLabel(c.kind))

    // Stage: the code itself on black, like the site's hero.
    Column(Modifier.fillMaxWidth().background(q.stage).dotGrid(Bone.copy(alpha = 0.07f))) {
        TopBar(onBack, link, onStage = true)
        Column(Modifier.padding(start = 20.dp, end = 20.dp, bottom = 24.dp)) {
            Box(Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
                Box(Modifier.fillMaxWidth(0.62f).aspectRatio(1f).clip(RoundedCornerShape(14.dp))) {
                    CodeImage(c, base, stringResource(R.string.qr_of, title), Modifier.fillMaxSize())
                }
            }
            Spacer(Modifier.height(20.dp))
            Row(verticalAlignment = Alignment.CenterVertically) {
                Kicker(stringResource(kindLabel(c.kind)), color = Lime)
                c.edition?.let { Spacer(Modifier.width(8.dp)); Pill("№ ${it.no}" + (it.of?.let { o -> " / $o" } ?: "")) }
            }
            Spacer(Modifier.height(6.dp))
            Text(title, style = Type.hero, color = Bone, modifier = Modifier.semantics { heading() })
            Spacer(Modifier.height(10.dp))
            val owner = session.person(c.owner)
            Row(verticalAlignment = Alignment.CenterVertically) {
                if (owner != null) {
                    Avatar(owner.localName(co.qrspace.app.data.Session.lang()), owner.color, 26)
                    Spacer(Modifier.width(8.dp))
                    Text(stringResource(R.string.owner_label) + ": " + owner.localName(co.qrspace.app.data.Session.lang()), style = Type.small, color = Bone.copy(alpha = 0.8f))
                } else {
                    Text(if (c.owner != null) stringResource(R.string.owner_label) + ": " + (session.name(c.owner) ?: "") else stringResource(R.string.hidden_owner), style = Type.small, color = Bone.copy(alpha = 0.6f))
                }
            }
        }
    }

    Column(Modifier.padding(horizontal = 20.dp)) {
        Spacer(Modifier.height(20.dp))
        if (c.access == "closed") {
            QCard(Modifier.fillMaxWidth()) {
                Icon(Glyphs.Lock, null, tint = q.ink, modifier = Modifier.size(26.dp))
                Spacer(Modifier.height(10.dp))
                Text(stringResource(R.string.closed_title), style = Type.h2, color = q.ink)
                Spacer(Modifier.height(6.dp))
                Text(stringResource(if (c.visibility == "me") R.string.closed_me else R.string.closed_hint), style = Type.body, color = q.muted)
                if (!signedIn) {
                    Spacer(Modifier.height(14.dp))
                    QButton(stringResource(R.string.login), onSignIn, modifier = Modifier.fillMaxWidth())
                }
            }
            return@Column
        }

        c.content?.let { content ->
            QCard(Modifier.fillMaxWidth()) {
                Kicker(stringResource(R.string.in_the_code))
                Spacer(Modifier.height(12.dp))
                ResultCard(content.toScan(), CodeFormat.QR)
            }
            Spacer(Modifier.height(20.dp))
        }

        if (c.access == "owner") {
            QButton(stringResource(R.string.edit), { onEdit(c.id) }, icon = Glyphs.Pencil, modifier = Modifier.fillMaxWidth())
            Spacer(Modifier.height(20.dp))
        }

        val blocks = c.blocks.orEmpty()
        if (c.access == "edit") {
            // Someone who may add to this code: the same composer as the owner's (space — only the owner can buy).
            Text(stringResource(R.string.memory), style = Type.h2, color = q.ink, modifier = Modifier.semantics { heading() })
            Spacer(Modifier.height(12.dp))
            co.qrspace.app.edit.MemoryEditor(c, onChange)
        } else if (blocks.isNotEmpty() || c.content == null) {
            Text(stringResource(R.string.memory), style = Type.h2, color = q.ink, modifier = Modifier.semantics { heading() })
            Spacer(Modifier.height(12.dp))
            if (blocks.isEmpty()) {
                Text(stringResource(R.string.memory_empty), style = Type.body, color = q.muted)
            }
            blocks.forEach { b ->
                MemoryBlock(b, ctx.app.api.mediaUrl(b.media ?: ""), session.name(b.author))
                Spacer(Modifier.height(12.dp))
            }
        }

        Spacer(Modifier.height(12.dp))
        QButton(stringResource(R.string.open_in_browser), { Actions.open(ctx, "$base/c/${c.id}") }, kind = BtnKind.Ghost, icon = Glyphs.Open, modifier = Modifier.fillMaxWidth())
    }
}

@Composable
fun Avatar(name: String, color: String, sizeDp: Int) {
    Box(
        Modifier.size(sizeDp.dp).clip(CircleShape).background(parseColor(color, Lime)),
        contentAlignment = Alignment.Center,
    ) {
        Text(name.take(1).uppercase(), style = Type.h3.copy(fontSize = (sizeDp * 0.45f).let { androidx.compose.ui.unit.TextUnit(it, androidx.compose.ui.unit.TextUnitType.Sp) }), color = Bone)
    }
}

@Composable
private fun MemoryBlock(b: Block, mediaUrl: String, author: String?) {
    val q = LocalQr.current
    QCard(Modifier.fillMaxWidth(), padding = androidx.compose.foundation.layout.PaddingValues(0.dp)) {
        when (b.kind) {
            "photo" -> AsyncImage(
                model = mediaUrl,
                contentDescription = b.text.ifEmpty { stringResource(R.string.photo) },
                contentScale = ContentScale.FillWidth,
                modifier = Modifier.fillMaxWidth().heightIn(min = 120.dp).background(q.field),
            )
            "video" -> VideoPlayer(mediaUrl)
        }
        Column(Modifier.padding(16.dp)) {
            if (b.text.isNotEmpty()) Text(b.text, style = Type.body, color = q.ink)
            val meta = listOfNotNull(author?.takeIf { it.isNotEmpty() }, b.at.takeIf { it.isNotEmpty() }?.let { fmtDate(it) }).joinToString(" · ")
            if (meta.isNotEmpty()) {
                if (b.text.isNotEmpty()) Spacer(Modifier.height(8.dp))
                Kicker(meta)
            }
        }
    }
}
