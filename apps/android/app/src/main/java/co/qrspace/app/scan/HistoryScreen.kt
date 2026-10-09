package co.qrspace.app.scan

import android.text.format.DateUtils
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
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
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import co.qrspace.app.R
import co.qrspace.app.app
import co.qrspace.app.data.ScanEntry
import co.qrspace.app.ui.Glyphs
import co.qrspace.app.ui.Heading
import co.qrspace.app.ui.Kicker
import co.qrspace.app.ui.LocalQr
import co.qrspace.app.ui.QCard
import co.qrspace.app.ui.RadiusSm
import co.qrspace.app.ui.Screen
import co.qrspace.app.ui.Type
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HistoryScreen(onBack: () -> Unit, onOpenCode: (Scan.Ours) -> Unit) {
    val ctx = LocalContext.current
    val c = LocalQr.current
    val dao = remember { ctx.app.history.scans() }
    val items by dao.all().collectAsState(initial = null)
    val scope = rememberCoroutineScope()
    var open by remember { mutableStateOf<ScanEntry?>(null) }

    Screen {
        Column(Modifier.fillMaxSize().statusBarsPadding()) {
            Row(Modifier.fillMaxWidth().padding(start = 4.dp, end = 8.dp, top = 4.dp), verticalAlignment = Alignment.CenterVertically) {
                IconButton(onClick = onBack) { Icon(Glyphs.Back, stringResource(R.string.back), tint = c.ink) }
                Spacer(Modifier.weight(1f))
                if (!items.isNullOrEmpty()) {
                    Text(
                        stringResource(R.string.history_clear),
                        style = Type.small,
                        color = c.warn,
                        modifier = Modifier.clip(RadiusSm).clickable { scope.launch { dao.clear() } }.padding(12.dp),
                    )
                }
            }
            Heading(stringResource(R.string.history), Modifier.padding(horizontal = 20.dp))
            Spacer(Modifier.height(16.dp))
            val list = items
            when {
                list == null -> Unit
                list.isEmpty() -> QCard(Modifier.padding(horizontal = 20.dp).fillMaxWidth()) {
                    Icon(Glyphs.History, null, tint = c.muted, modifier = Modifier.size(28.dp))
                    Spacer(Modifier.height(10.dp))
                    Text(stringResource(R.string.history_empty), style = Type.body, color = c.muted)
                }
                else -> LazyColumn(contentPadding = PaddingValues(start = 20.dp, end = 20.dp, bottom = 120.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    items(list, key = { it.id }) { e ->
                        val format = runCatching { CodeFormat.valueOf(e.format) }.getOrDefault(CodeFormat.QR)
                        val scan = remember(e.raw) { ScanParser.parse(e.raw, format) }
                        Row(
                            Modifier.fillMaxWidth().clip(RadiusSm).background(c.card).clickable {
                                if (scan is Scan.Ours) onOpenCode(scan) else open = e
                            }.padding(12.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Box(Modifier.size(40.dp).clip(RoundedCornerShape(6.dp)).background(if (scan is Scan.Ours) c.accent else c.field), contentAlignment = Alignment.Center) {
                                Icon(scanIcon(scan), null, tint = if (scan is Scan.Ours) c.onAccent else c.ink, modifier = Modifier.size(20.dp))
                            }
                            Spacer(Modifier.width(12.dp))
                            Column(Modifier.weight(1f)) {
                                Kicker(scanLabel(scan) + " · " + DateUtils.getRelativeTimeSpanString(e.at, System.currentTimeMillis(), DateUtils.SECOND_IN_MILLIS))
                                Spacer(Modifier.height(2.dp))
                                Text(scanTitle(scan), style = Type.bodyStrong, color = c.ink, maxLines = 1, overflow = TextOverflow.Ellipsis)
                            }
                            IconButton(onClick = { scope.launch { dao.delete(e.id) } }) {
                                Icon(Glyphs.Trash, stringResource(R.string.history_delete), tint = c.muted, modifier = Modifier.size(20.dp))
                            }
                        }
                    }
                }
            }
        }
    }

    open?.let { e ->
        val format = runCatching { CodeFormat.valueOf(e.format) }.getOrDefault(CodeFormat.QR)
        ModalBottomSheet(onDismissRequest = { open = null }, containerColor = c.card, shape = RoundedCornerShape(topStart = 18.dp, topEnd = 18.dp)) {
            Column(Modifier.padding(horizontal = 20.dp).padding(bottom = 28.dp)) {
                ResultCard(ScanParser.parse(e.raw, format), format)
            }
        }
    }
}
