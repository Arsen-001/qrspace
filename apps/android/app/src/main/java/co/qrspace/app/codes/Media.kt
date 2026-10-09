package co.qrspace.app.codes

import androidx.annotation.OptIn
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Icon
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.media3.common.MediaItem
import androidx.media3.common.util.UnstableApi
import androidx.media3.datasource.okhttp.OkHttpDataSource
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.exoplayer.source.DefaultMediaSourceFactory
import androidx.media3.ui.PlayerView
import co.qrspace.app.R
import co.qrspace.app.app
import co.qrspace.app.ui.Glyphs
import co.qrspace.app.ui.Lime
import co.qrspace.app.ui.LocalQr
import co.qrspace.app.ui.Night
import co.qrspace.app.ui.Radius

/** Video from /api/media (cookie-protected) — played through the same OkHttp client, starts on tap. */
@OptIn(UnstableApi::class)
@Composable
fun VideoPlayer(url: String) {
    val ctx = LocalContext.current
    var started by remember { mutableStateOf(false) }
    val label = stringResource(R.string.video)
    if (!started) {
        Box(
            Modifier.fillMaxWidth().aspectRatio(16f / 9f).background(LocalQr.current.stage).clickable(role = Role.Button) { started = true }.semantics { contentDescription = label },
            contentAlignment = Alignment.Center,
        ) {
            Box(Modifier.size(60.dp).clip(CircleShape).background(Lime), contentAlignment = Alignment.Center) {
                Icon(Glyphs.Play, null, tint = Night, modifier = Modifier.size(28.dp))
            }
        }
        return
    }
    val player = remember {
        ExoPlayer.Builder(ctx)
            .setMediaSourceFactory(DefaultMediaSourceFactory(OkHttpDataSource.Factory(ctx.app.api.client)))
            .build()
            .apply { setMediaItem(MediaItem.fromUri(url)); prepare(); playWhenReady = true }
    }
    DisposableEffect(player) { onDispose { player.release() } }
    AndroidView(
        factory = { PlayerView(it).apply { this.player = player } },
        modifier = Modifier.fillMaxWidth().aspectRatio(16f / 9f).clip(Radius),
    )
}
