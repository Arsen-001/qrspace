package co.qrspace.app.codes

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import co.qrspace.app.app
import co.qrspace.app.data.CodeView
import coil3.compose.AsyncImage

/**
 * The code exactly as the site draws it: the server's PNG (`/api/codes/{id}/image`, logos and photos inside), kept in
 * Coil's disk cache — so it shows offline too. Never loaded and offline → our own ZXing drawing of the same link.
 */
@Composable
fun CodeImage(c: CodeView, base: String, label: String, modifier: Modifier = Modifier) {
    val api = LocalContext.current.app.api
    val url = api.imageUrl(c)
    var failed by remember(url) { mutableStateOf(false) }
    Box(modifier.background(parseColor(c.style?.bg, Color.White))) {
        if (failed) {
            QrImage(linkOf(base, c), c.style, label, Modifier.fillMaxSize())
        } else {
            AsyncImage(
                model = url,
                contentDescription = label,
                contentScale = ContentScale.Fit,
                onError = { failed = true },
                modifier = Modifier.fillMaxSize(),
            )
        }
    }
}
