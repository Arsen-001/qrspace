package co.qrspace.app.codes

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.GridItemSpan
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.material3.Text
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
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
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import co.qrspace.app.R
import co.qrspace.app.app
import co.qrspace.app.data.ApiException
import co.qrspace.app.data.CodeList
import co.qrspace.app.data.CodeView
import co.qrspace.app.ui.BtnKind
import co.qrspace.app.ui.ErrorBox
import co.qrspace.app.ui.Heading
import co.qrspace.app.ui.Kicker
import co.qrspace.app.ui.Loading
import co.qrspace.app.ui.LocalQr
import co.qrspace.app.ui.Pill
import co.qrspace.app.ui.QButton
import co.qrspace.app.ui.QCard
import co.qrspace.app.ui.Radius
import co.qrspace.app.ui.Screen
import co.qrspace.app.ui.Type
import co.qrspace.app.ui.kindLabel
import kotlinx.coroutines.launch

private sealed interface Load<out T> {
    data object Busy : Load<Nothing>
    data object Login : Load<Nothing>
    data object Failed : Load<Nothing>
    data class Ok<T>(val v: T) : Load<T>
}

@OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)
@Composable
fun CodesScreen(onOpen: (String) -> Unit, onSignIn: () -> Unit) {
    val ctx = LocalContext.current
    val api = ctx.app.api
    val epoch by ctx.app.session.epoch.collectAsState()
    var state by remember { mutableStateOf<Load<CodeList>>(Load.Busy) }
    var refreshing by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()

    suspend fun load() {
        state = runCatching { Load.Ok(api.codes()) }.getOrElse { if (it is ApiException && it.code == 401) Load.Login else Load.Failed }
    }
    LaunchedEffect(epoch) { load() }

    Screen {
        PullToRefreshBox(isRefreshing = refreshing, onRefresh = { scope.launch { refreshing = true; load(); refreshing = false } }, modifier = Modifier.fillMaxSize()) {
            LazyVerticalGrid(
                columns = GridCells.Adaptive(160.dp),
                contentPadding = PaddingValues(start = 20.dp, end = 20.dp, bottom = 120.dp),
                horizontalArrangement = Arrangement.spacedBy(12.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp),
                modifier = Modifier.fillMaxSize().statusBarsPadding(),
            ) {
                item(span = { GridItemSpan(maxLineSpan) }) {
                    Column(Modifier.padding(top = 20.dp, bottom = 4.dp)) {
                        Kicker("QR Space")
                        Spacer(Modifier.height(6.dp))
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Heading(stringResource(R.string.nav_codes), Modifier.weight(1f, fill = false))
                            (state as? Load.Ok)?.v?.mine?.size?.let { Spacer(Modifier.padding(4.dp)); Pill("$it") }
                        }
                    }
                }
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
                        if (s.v.mine.isEmpty()) item(span = { GridItemSpan(maxLineSpan) }) {
                            QCard(Modifier.fillMaxWidth()) {
                                Text(stringResource(R.string.empty_codes), style = Type.body, color = LocalQr.current.ink)
                                Spacer(Modifier.height(12.dp))
                                QButton(stringResource(R.string.open_in_browser), { co.qrspace.app.scan.Actions.open(ctx, "$base/account?tab=codes") }, kind = BtnKind.Ink)
                            }
                        }
                        items(s.v.mine, key = { "m" + it.id }) { CodeTile(it, base) { onOpen(it.id) } }
                        if (s.v.shared.isNotEmpty()) {
                            item(span = { GridItemSpan(maxLineSpan) }) {
                                Column(Modifier.padding(top = 20.dp)) {
                                    Text(stringResource(R.string.shared_title), style = Type.h2, color = LocalQr.current.ink)
                                    Text(stringResource(R.string.shared_hint), style = Type.small, color = LocalQr.current.muted)
                                }
                            }
                            items(s.v.shared, key = { "s" + it.id }) { CodeTile(it, base) { onOpen(it.id) } }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun CodeTile(c: CodeView, base: String, onClick: () -> Unit) {
    val q = LocalQr.current
    val title = c.title ?: stringResource(kindLabel(c.kind))
    Column(
        Modifier.clip(Radius).background(q.card).border(1.dp, q.line, Radius).clickable(role = Role.Button, onClick = onClick).padding(10.dp),
    ) {
        Box(Modifier.fillMaxWidth().aspectRatio(1f).clip(androidx.compose.foundation.shape.RoundedCornerShape(6.dp))) {
            QrImage(linkOf(base, c), c.style, stringResource(R.string.qr_of, title), Modifier.fillMaxSize())
        }
        Spacer(Modifier.height(10.dp))
        Kicker(stringResource(kindLabel(c.kind)) + (c.edition?.let { " · № ${it.no}" } ?: ""))
        Spacer(Modifier.height(2.dp))
        Text(title, style = Type.h3, color = q.ink, maxLines = 2, overflow = TextOverflow.Ellipsis)
        val scans = c.stats?.total ?: 0
        if (scans > 0) Text(stringResource(R.string.scanned_count, scans), style = Type.small, color = q.muted)
        if (c.content == null && c.blocks.isNullOrEmpty() && c.access == "owner") Text(stringResource(R.string.not_set_up), style = Type.small, color = q.warn)
    }
}
