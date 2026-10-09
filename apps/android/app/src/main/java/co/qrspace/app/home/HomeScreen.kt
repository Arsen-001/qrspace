package co.qrspace.app.home

import androidx.compose.animation.core.CubicBezierEasing
import androidx.compose.animation.core.animateDpAsState
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.GridItemSpan
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.selection.toggleable
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.clipToBounds
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.clipRect
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import co.qrspace.app.R
import co.qrspace.app.app
import co.qrspace.app.codes.CodeImage
import co.qrspace.app.codes.parseColor
import co.qrspace.app.data.ApiException
import co.qrspace.app.data.CodeList
import co.qrspace.app.data.CodeView
import co.qrspace.app.data.Payload
import co.qrspace.app.data.Task
import co.qrspace.app.ui.Bone
import co.qrspace.app.ui.BtnKind
import co.qrspace.app.ui.ErrorBox
import co.qrspace.app.ui.Glyphs
import co.qrspace.app.ui.Heading
import co.qrspace.app.ui.Kicker
import co.qrspace.app.ui.Lime
import co.qrspace.app.ui.Loading
import co.qrspace.app.ui.LocalQr
import co.qrspace.app.ui.Mono
import co.qrspace.app.ui.Night
import co.qrspace.app.ui.QButton
import co.qrspace.app.ui.QCard
import co.qrspace.app.ui.Radius
import co.qrspace.app.ui.Screen
import co.qrspace.app.ui.SiteText
import co.qrspace.app.ui.Type
import co.qrspace.app.ui.VisBadge
import co.qrspace.app.ui.daysLeft
import co.qrspace.app.ui.dotGrid
import co.qrspace.app.ui.fmtDay
import co.qrspace.app.ui.fmtDays
import kotlinx.coroutines.launch

private sealed interface Load {
    data object Busy : Load
    data object Login : Load
    data object Failed : Load
    data class Ok(val v: CodeList) : Load
}

private val StageLine = Color(0xFF2A2A2E)
private val Ease = CubicBezierEasing(0.65f, 0f, 0.35f, 1f)

/**
 * Home after sign-in — "My QR codes" (the web's HomeDashboard): every code is a dark card with its own ON/OFF switch
 * (off — the code, on — what's under it), scans in big numbers (total, this week, 30 day bars), Edit and "As others
 * see it"; a big "+ Create new QR", reminders ("To do") and "Shared with me".
 */
@OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)
@Composable
fun HomeScreen(onCreate: () -> Unit, onEdit: (String) -> Unit, onView: (String) -> Unit, onSignIn: () -> Unit) {
    val ctx = LocalContext.current
    val api = ctx.app.api
    val epoch by ctx.app.session.epoch.collectAsState()
    var state by remember { mutableStateOf<Load>(Load.Busy) }
    var refreshing by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()

    suspend fun load() {
        state = runCatching { Load.Ok(api.codes()) }.getOrElse { if (it is ApiException && it.code == 401) Load.Login else Load.Failed }
    }
    LaunchedEffect(epoch) { load() }

    Screen {
        PullToRefreshBox(isRefreshing = refreshing, onRefresh = { scope.launch { refreshing = true; load(); refreshing = false } }, modifier = Modifier.fillMaxSize()) {
            LazyVerticalGrid(
                columns = GridCells.Adaptive(330.dp),
                contentPadding = PaddingValues(start = 16.dp, end = 16.dp, bottom = 120.dp),
                horizontalArrangement = Arrangement.spacedBy(14.dp),
                verticalArrangement = Arrangement.spacedBy(14.dp),
                modifier = Modifier.fillMaxSize().statusBarsPadding(),
            ) {
                val ok = state as? Load.Ok
                item(span = { GridItemSpan(maxLineSpan) }) { Header(ok?.v, onCreate) }
                when (val s = state) {
                    Load.Busy -> item(span = { GridItemSpan(maxLineSpan) }) { Loading() }
                    Load.Failed -> item(span = { GridItemSpan(maxLineSpan) }) { ErrorBox(stringResource(R.string.error_network), onRetry = { scope.launch { state = Load.Busy; load() } }) }
                    Load.Login -> item(span = { GridItemSpan(maxLineSpan) }) {
                        QCard(Modifier.fillMaxWidth()) {
                            Text(stringResource(R.string.acc_login_text), style = Type.body, color = LocalQr.current.ink)
                            Spacer(Modifier.height(14.dp))
                            QButton(stringResource(R.string.login), onSignIn, modifier = Modifier.fillMaxWidth())
                        }
                    }
                    is Load.Ok -> {
                        val base = s.v.base
                        val todo = upcoming(s.v.mine + s.v.shared)
                        if (todo.isNotEmpty()) item(span = { GridItemSpan(maxLineSpan) }) {
                            Upcoming(todo, onOpen = { c -> if (c.access == "owner") onEdit(c.id) else onView(c.id) }) { c, t ->
                                runCatching { api.doneTask(c.id, t.id) }
                                load()
                            }
                        }
                        if (s.v.mine.isEmpty()) {
                            item(span = { GridItemSpan(maxLineSpan) }) { FirstCode(onCreate) }
                        } else {
                            items(s.v.mine, key = { "m" + it.id }) { CodeCard(it, base, onEdit = { onEdit(it.id) }, onView = { onView(it.id) }) }
                            item(key = "new") { NewTile(onCreate) }
                        }
                        if (s.v.shared.isNotEmpty()) item(span = { GridItemSpan(maxLineSpan) }) { Shared(s.v.shared, base, onView) }
                    }
                }
            }
        }
    }
}

@Composable
private fun Header(list: CodeList?, onCreate: () -> Unit) {
    val q = LocalQr.current
    Column(Modifier.padding(top = 20.dp, bottom = 2.dp)) {
        Kicker("QR Space")
        Spacer(Modifier.height(6.dp))
        Heading(stringResource(R.string.dash_title))
        if (list != null && list.mine.isNotEmpty()) {
            val total = list.mine.sumOf { it.stats?.total ?: 0 }
            val week = list.mine.sumOf { it.stats?.week ?: 0 }
            Spacer(Modifier.height(8.dp))
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    buildAnnotatedString {
                        append(stringResource(R.string.nav_codes) + ": ")
                        withStyle(SpanStyle(color = q.ink, fontWeight = FontWeight.Bold)) { append("${list.mine.size}") }
                        append(" · " + stringResource(R.string.dash_scans_all) + ": ")
                        withStyle(SpanStyle(color = q.ink, fontWeight = FontWeight.Bold)) { append("$total") }
                    },
                    style = Type.small, color = q.muted,
                )
                if (week > 0) {
                    Spacer(Modifier.width(6.dp))
                    Text("+$week", style = Type.kicker, color = q.onAccent, modifier = Modifier.clip(RoundedCornerShape(5.dp)).background(q.accent).padding(horizontal = 6.dp, vertical = 2.dp))
                }
            }
        }
        if (list != null) {
            Spacer(Modifier.height(16.dp))
            QButton("+  " + stringResource(R.string.dash_new), onCreate, modifier = Modifier.fillMaxWidth().heightIn(min = 56.dp))
        }
    }
}

/** A dark card per code, like the web dashboard. */
@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun CodeCard(c: CodeView, base: String, onEdit: () -> Unit, onView: () -> Unit) {
    var open by rememberSaveable(c.id) { mutableStateOf(false) }
    val p by animateFloatAsState(if (open) 1f else 0f, tween(700, easing = Ease), label = "reveal")
    val title = c.title ?: stringResource(co.qrspace.app.ui.kindLabel(c.kind))
    val scans = c.stats?.total ?: 0
    val week = c.stats?.week ?: 0
    Column(
        Modifier.clip(RoundedCornerShape(24.dp)).background(LocalQr.current.stage)
            .then(if (LocalQr.current.dark) Modifier.border(1.dp, StageLine, RoundedCornerShape(24.dp)) else Modifier)
            .dotGrid(Bone.copy(alpha = 0.05f)).padding(16.dp),
    ) {
        Row(verticalAlignment = Alignment.Top) {
            Text(
                title, style = Type.h2, color = Bone, maxLines = 1, overflow = TextOverflow.Ellipsis,
                modifier = Modifier.weight(1f).clickable(role = Role.Button, onClick = onEdit).semantics { heading() },
            )
            if (c.unread > 0) {
                val label = stringResource(R.string.unread_count, c.unread)
                Box(
                    Modifier.padding(start = 8.dp).heightIn(min = 24.dp).clip(RoundedCornerShape(12.dp)).background(Color(0xFFFB923C)).padding(horizontal = 8.dp).semantics { contentDescription = label },
                    contentAlignment = Alignment.Center,
                ) { Text("${c.unread}", style = Type.kicker, color = Night) }
            }
        }
        Spacer(Modifier.height(8.dp))
        FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            VisBadge(c.visibility, onStage = true)
            c.edition?.let { e -> StagePill(stringResource(R.string.edition_no) + " ${e.no}" + (e.of?.let { " / $it" } ?: "")) }
            if (c.lost) StagePill(stringResource(R.string.lost_mode), warn = true)
        }

        Spacer(Modifier.height(16.dp))
        Row(verticalAlignment = Alignment.CenterVertically) {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Text(
                    stringResource(R.string.dash_under_short).uppercase(), style = Type.kicker.copy(fontSize = 9.sp, lineHeight = 11.sp),
                    color = if (open) Lime else Bone.copy(alpha = 0.5f), maxLines = 2, modifier = Modifier.width(52.dp),
                    textAlign = androidx.compose.ui.text.style.TextAlign.Center,
                )
                Spacer(Modifier.height(6.dp))
                MiniSwitch(open, stringResource(R.string.hero_switch) + ": " + title) { open = !open }
                Spacer(Modifier.height(6.dp))
                Text("QR", style = Type.kicker.copy(fontSize = 9.sp), color = if (open) Bone.copy(alpha = 0.5f) else Bone)
            }
            Spacer(Modifier.width(12.dp))
            Box(
                Modifier.weight(1f).aspectRatio(1f).clip(RoundedCornerShape(16.dp)).border(1.dp, StageLine, RoundedCornerShape(16.dp)).background(Color.White.copy(alpha = 0.03f)),
            ) {
                Under(c)
                // The code on top; switched on — it slides away upwards and shows what's under it.
                Box(
                    Modifier
                        .fillMaxSize()
                        .clipToBounds()
                        .drawWithContent { clipRect(bottom = size.height * (1f - p)) { this@drawWithContent.drawContent() } }
                        .background(parseColor(c.style?.bg, Color.White))
                        .padding(10.dp)
                        .then(if (open) Modifier.clearAndSetSemantics { } else Modifier),
                ) {
                    CodeImage(c, base, stringResource(R.string.qr_of, title), Modifier.fillMaxSize().alpha(if (c.blocked) 0.4f else 1f))
                }
            }
        }

        Spacer(Modifier.height(16.dp))
        val scansLabel = stringResource(R.string.scans_count)
        val weekText = stringResource(R.string.dash_week, week)
        Row(Modifier.fillMaxWidth().semantics(mergeDescendants = true) { contentDescription = "$scansLabel: $scans · $weekText" }, verticalAlignment = Alignment.Bottom) {
            Column(Modifier.weight(1f)) {
                Row(verticalAlignment = Alignment.Bottom) {
                    Text("$scans", style = Type.stat.copy(fontSize = 34.sp, lineHeight = 36.sp), color = Bone)
                    Spacer(Modifier.width(6.dp))
                    Text(scansLabel.lowercase(), style = Type.small, color = Bone.copy(alpha = 0.7f), modifier = Modifier.padding(bottom = 4.dp))
                }
                Text(weekText, style = Type.small.copy(fontWeight = if (week > 0) FontWeight.Bold else FontWeight.Medium), color = if (week > 0) Lime else Bone.copy(alpha = 0.5f))
            }
            c.stats?.let { Spark(it.days) }
        }

        Spacer(Modifier.height(16.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            QButton(stringResource(R.string.edit), onEdit, Modifier.weight(1f), icon = Glyphs.Pencil)
            QButton(stringResource(R.string.dash_as_guest), onView, Modifier.weight(1f), kind = BtnKind.Stage)
        }
    }
}

@Composable
private fun StagePill(text: String, warn: Boolean = false) {
    Text(
        text, style = Type.small.copy(fontSize = 12.sp, fontWeight = FontWeight.SemiBold), color = if (warn) Night else Bone,
        modifier = Modifier.clip(RoundedCornerShape(50)).background(if (warn) Color(0xFFFB923C) else Bone.copy(alpha = 0.1f)).padding(horizontal = 10.dp, vertical = 5.dp),
    )
}

/** Small vertical switch with ON / OFF on the knob — like the big one on the site's first screen. */
@Composable
private fun MiniSwitch(open: Boolean, label: String, toggle: () -> Unit) {
    val y by animateDpAsState(if (open) 0.dp else 88.dp, tween(500, easing = Ease), label = "knob")
    val shape = RoundedCornerShape(50)
    Box(
        Modifier
            .size(width = 40.dp, height = 128.dp)
            .clip(shape)
            .background(if (open) Lime.copy(alpha = 0.2f) else Color.White.copy(alpha = 0.05f))
            .border(1.dp, if (open) Lime else StageLine, shape)
            .toggleable(value = open, role = Role.Switch, onValueChange = { toggle() })
            .semantics { contentDescription = label },
    ) {
        Box(
            Modifier.align(Alignment.TopCenter).padding(top = 4.dp).offset(y = y).size(32.dp).clip(CircleShape).background(if (open) Lime else Bone),
            contentAlignment = Alignment.Center,
        ) {
            Text(if (open) "ON" else "OFF", style = Type.kicker.copy(fontFamily = Mono, fontSize = 9.sp, fontWeight = FontWeight.Bold, letterSpacing = 0.sp), color = Night)
        }
    }
}

/** What's under the code, as a person sees it after a scan: the content, or the memory (entries, photos, text). */
@Composable
private fun Under(c: CodeView) {
    val api = LocalContext.current.app.api
    val content = c.content
    if (content != null) {
        Column(Modifier.fillMaxSize().padding(16.dp), verticalArrangement = Arrangement.Center) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(Modifier.size(36.dp).clip(RoundedCornerShape(12.dp)).background(Lime), contentAlignment = Alignment.Center) {
                    Icon(Glyphs.type(content.type), null, tint = Night, modifier = Modifier.size(20.dp))
                }
                Spacer(Modifier.width(8.dp))
                Kicker(SiteText.type[content.type]?.let { stringResource(it) } ?: content.type, color = Bone.copy(alpha = 0.6f))
            }
            Spacer(Modifier.height(12.dp))
            Text(Payload.mainValue(content).ifEmpty { stringResource(R.string.not_set_up) }, style = Type.h2.copy(fontSize = 18.sp, lineHeight = 23.sp), color = Bone, maxLines = 3, overflow = TextOverflow.Ellipsis)
        }
        return
    }
    val blocks = c.blocks.orEmpty()
    if (blocks.isEmpty()) {
        Column(Modifier.fillMaxSize().padding(16.dp), verticalArrangement = Arrangement.Center, horizontalAlignment = Alignment.CenterHorizontally) {
            Text(stringResource(if (c.kind == "link") R.string.not_set_up else R.string.dash_empty_memory), style = Type.h3, color = Bone, textAlign = androidx.compose.ui.text.style.TextAlign.Center)
            Spacer(Modifier.height(4.dp))
            Text(stringResource(R.string.dash_empty_memory_hint), style = Type.small.copy(fontSize = 12.sp), color = Bone.copy(alpha = 0.6f), textAlign = androidx.compose.ui.text.style.TextAlign.Center)
        }
        return
    }
    val photos = blocks.filter { it.kind == "photo" && it.media != null }.take(3)
    val text = blocks.firstOrNull { it.kind == "text" && it.text.isNotBlank() }?.text
    Column(Modifier.fillMaxSize().padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Icon(Glyphs.kind(c.kind), null, tint = Lime, modifier = Modifier.size(16.dp))
            Spacer(Modifier.width(6.dp))
            Kicker(stringResource(R.string.records) + ": ${blocks.size}", color = Bone.copy(alpha = 0.6f))
        }
        if (photos.isNotEmpty()) Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            photos.forEach { b ->
                coil3.compose.AsyncImage(
                    model = api.mediaUrl(b.media!!), contentDescription = null, contentScale = ContentScale.Crop,
                    modifier = Modifier.weight(1f).aspectRatio(1f).clip(RoundedCornerShape(8.dp)).background(StageLine),
                )
            }
            repeat(3 - photos.size) { Spacer(Modifier.weight(1f)) }
        }
        if (text != null) Text(text, style = Type.small.copy(fontSize = 14.sp, lineHeight = 20.sp), color = Bone.copy(alpha = 0.85f), maxLines = if (photos.isEmpty()) 7 else 3, overflow = TextOverflow.Ellipsis)
    }
}

/** Scans per day (last 30) — thin bars. */
@Composable
private fun Spark(days: List<Int>) {
    val last = days.takeLast(30)
    val max = maxOf(1, last.maxOrNull() ?: 0)
    Row(Modifier.height(26.dp).clearAndSetSemantics { }, horizontalArrangement = Arrangement.spacedBy(2.dp), verticalAlignment = Alignment.Bottom) {
        last.forEach { d ->
            Box(Modifier.width(3.dp).fillMaxHeight(maxOf(0.12f, d.toFloat() / max)).clip(RoundedCornerShape(1.dp)).background(if (d > 0) Lime else Color.White.copy(alpha = 0.15f)))
        }
    }
}

@Composable
private fun NewTile(onCreate: () -> Unit) {
    val q = LocalQr.current
    val shape = RoundedCornerShape(24.dp)
    Column(
        Modifier.fillMaxWidth().heightIn(min = 200.dp).clip(shape)
            .border(2.dp, q.line, shape)
            .clickable(role = Role.Button, onClick = onCreate)
            .padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Box(Modifier.size(56.dp).clip(RoundedCornerShape(16.dp)).background(Lime), contentAlignment = Alignment.Center) {
            Icon(Glyphs.Plus, null, tint = Night, modifier = Modifier.size(28.dp))
        }
        Spacer(Modifier.height(12.dp))
        Text(stringResource(R.string.dash_new), style = Type.h3, color = q.muted)
    }
}

@Composable
private fun FirstCode(onCreate: () -> Unit) {
    Column(
        Modifier.fillMaxWidth().clip(RoundedCornerShape(24.dp)).background(LocalQr.current.stage).dotGrid(Bone.copy(alpha = 0.07f))
            .clickable(role = Role.Button, onClick = onCreate).padding(28.dp),
    ) {
        Text(stringResource(R.string.first_code_title), style = Type.h1, color = Bone)
        Spacer(Modifier.height(8.dp))
        Text(stringResource(R.string.first_code_text), style = Type.body, color = Bone.copy(alpha = 0.7f))
        Spacer(Modifier.height(20.dp))
        Text(
            stringResource(R.string.first_code_cta) + "  →", style = Type.button, color = Night,
            modifier = Modifier.clip(co.qrspace.app.ui.RadiusSm).background(Lime).padding(horizontal = 18.dp, vertical = 14.dp),
        )
    }
}

private fun upcoming(codes: List<CodeView>): List<Pair<CodeView, Task>> =
    codes.filter { it.access == "owner" || it.access == "edit" }
        .flatMap { c -> c.tasks.orEmpty().map { c to it } }
        .filter { daysLeft(it.second.due) <= 14 }
        .sortedBy { it.second.due }

/** "To do": overdue and due in the next 2 weeks, across all codes; "Done" moves a repeating reminder on. */
@Composable
private fun Upcoming(items: List<Pair<CodeView, Task>>, onOpen: (CodeView) -> Unit, onDone: suspend (CodeView, Task) -> Unit) {
    val q = LocalQr.current
    val scope = rememberCoroutineScope()
    var busy by remember { mutableStateOf<String?>(null) }
    QCard(Modifier.fillMaxWidth()) {
        Text(stringResource(R.string.upcoming_title), style = Type.h2, color = q.ink, modifier = Modifier.semantics { heading() })
        Text(stringResource(R.string.upcoming_hint), style = Type.small, color = q.muted)
        Spacer(Modifier.height(4.dp))
        items.forEachIndexed { i, (c, t) ->
            if (i > 0) Box(Modifier.fillMaxWidth().height(1.dp).background(q.line))
            Row(Modifier.fillMaxWidth().padding(vertical = 10.dp), verticalAlignment = Alignment.Top) {
                val doneLabel = stringResource(R.string.mark_done) + ": " + t.text
                Box(
                    Modifier.size(32.dp).clip(CircleShape).border(2.dp, q.line, CircleShape)
                        .clickable(enabled = busy == null, role = Role.Button) {
                            busy = t.id
                            scope.launch { onDone(c, t); busy = null }
                        }
                        .semantics { contentDescription = doneLabel },
                    contentAlignment = Alignment.Center,
                ) {
                    if (busy == t.id) CircularProgressIndicator(Modifier.size(16.dp), color = q.accentInk, strokeWidth = 2.dp)
                    else Icon(Glyphs.Check, null, tint = q.muted.copy(alpha = 0.5f), modifier = Modifier.size(16.dp))
                }
                Spacer(Modifier.width(12.dp))
                Column(Modifier.weight(1f).padding(top = 4.dp)) {
                    Text(t.text, style = Type.bodyStrong, color = q.ink)
                    Row {
                        DueNote(t.due)
                        Text(" · ", style = Type.small, color = q.muted)
                        Text(
                            c.title ?: "", style = Type.small.copy(textDecoration = androidx.compose.ui.text.style.TextDecoration.Underline), color = q.muted, maxLines = 1, overflow = TextOverflow.Ellipsis,
                            modifier = Modifier.clickable(role = Role.Button) { onOpen(c) },
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun DueNote(due: String) {
    val q = LocalQr.current
    val days = daysLeft(due)
    val text = buildString {
        if (days < 0) append(stringResource(R.string.overdue) + " · ")
        append(if (days > 30) fmtDay(due) else fmtDays(days))
        if (kotlin.math.abs(days) > 1 && days <= 30) append(" · " + fmtDay(due))
    }
    Text(
        text, style = Type.small.copy(fontWeight = if (days <= 0) FontWeight.SemiBold else FontWeight.Medium),
        color = when { days < 0 -> q.warn; days == 0L -> q.ok; else -> q.muted },
    )
}

/** Codes other people opened to me — small tiles. */
@Composable
private fun Shared(codes: List<CodeView>, base: String, onView: (String) -> Unit) {
    val q = LocalQr.current
    Column(Modifier.padding(top = 12.dp)) {
        Text(stringResource(R.string.shared_title), style = Type.h1.copy(fontSize = 22.sp), color = q.ink, modifier = Modifier.semantics { heading() })
        Text(stringResource(R.string.shared_hint), style = Type.small, color = q.muted)
        Spacer(Modifier.height(12.dp))
        codes.chunked(2).forEach { row ->
            Row(Modifier.fillMaxWidth().padding(bottom = 10.dp), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                row.forEach { c ->
                    val title = c.title ?: stringResource(co.qrspace.app.ui.kindLabel(c.kind))
                    Column(Modifier.weight(1f).clip(Radius).background(q.card).border(1.dp, q.line, Radius).clickable(role = Role.Button) { onView(c.id) }.padding(10.dp)) {
                        CodeImage(c, base, stringResource(R.string.qr_of, title), Modifier.fillMaxWidth().aspectRatio(1f).clip(RoundedCornerShape(8.dp)).padding(0.dp))
                        Spacer(Modifier.height(8.dp))
                        Text(title, style = Type.h3, color = q.ink, maxLines = 1, overflow = TextOverflow.Ellipsis)
                        c.owner?.let { o -> Text(stringResource(R.string.owner_label) + ": " + (LocalContext.current.app.session.name(o) ?: o), style = Type.small, color = q.muted, maxLines = 1) }
                    }
                }
                if (row.size == 1) Spacer(Modifier.weight(1f))
            }
        }
    }
}
