package co.qrspace.app.codes

import androidx.compose.foundation.Canvas
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import co.qrspace.app.data.CodeView
import co.qrspace.app.data.SavedStyle
import com.google.zxing.EncodeHintType
import com.google.zxing.qrcode.decoder.ErrorCorrectionLevel
import com.google.zxing.qrcode.encoder.ByteMatrix
import com.google.zxing.qrcode.encoder.Encoder

/** The link printed in the code (src/lib/codes.ts linkOf): compact codes use the all-caps short link. */
fun linkOf(base: String, c: CodeView): String =
    if (c.compact && c.short.isNotEmpty()) "${base.uppercase()}/K/${c.short}" else "$base/c/${c.id}"

fun parseColor(hex: String?, fallback: Color): Color {
    val h = hex?.trim()?.removePrefix("#") ?: return fallback
    return runCatching {
        when (h.length) {
            3 -> Color(android.graphics.Color.parseColor("#" + h.map { "$it$it" }.joinToString("")))
            6, 8 -> Color(android.graphics.Color.parseColor("#$h"))
            else -> fallback
        }
    }.getOrDefault(fallback)
}

private fun encode(text: String): ByteMatrix =
    Encoder.encode(text, ErrorCorrectionLevel.M, mapOf(EncodeHintType.CHARACTER_SET to "UTF-8")).matrix

/**
 * QR drawn locally with ZXing: modules in the code's own colours and an approximation of its dot and eye shapes
 * (the full styles — textures, pictures, logos — are drawn by the website).
 */
@Composable
fun QrImage(text: String, style: SavedStyle?, label: String, modifier: Modifier = Modifier, quiet: Int = 2) {
    val m = remember(text) { runCatching { encode(text) }.getOrNull() }
    val fg = parseColor(style?.fg, Color(0xFF0B0B0C))
    val bg = parseColor(style?.bg, Color.White)
    val eyeColor = parseColor(style?.eyeColor, fg)
    val ballColor = parseColor(style?.eyeBallColor, eyeColor)
    Canvas(modifier.semantics { contentDescription = label }) {
        drawRect(bg)
        if (m == null) return@Canvas
        val n = m.width
        val cell = size.minDimension / (n + quiet * 2)
        val o = quiet * cell
        fun inEye(x: Int, y: Int) = (x < 7 && y < 7) || (x >= n - 7 && y < 7) || (x < 7 && y >= n - 7)
        val dot = style?.dot ?: "square"
        for (y in 0 until n) for (x in 0 until n) {
            if (m.get(x, y).toInt() != 1 || inEye(x, y)) continue
            module(dot, Offset(o + x * cell, o + y * cell), cell, fg)
        }
        listOf(0 to 0, n - 7 to 0, 0 to n - 7).forEach { (ex, ey) ->
            eye(style?.eye ?: "square", style?.eyeBall ?: "auto", Offset(o + ex * cell, o + ey * cell), cell, eyeColor, ballColor)
        }
    }
}

private fun DrawScope.module(shape: String, p: Offset, cell: Float, color: Color) {
    when (shape) {
        "dots", "circle", "heart", "star", "diamond" -> drawCircle(color, cell * 0.46f, Offset(p.x + cell / 2, p.y + cell / 2))
        "rounded", "soft", "blob", "fluid" -> drawRoundRect(color, Offset(p.x + cell * 0.04f, p.y + cell * 0.04f), Size(cell * 0.92f, cell * 0.92f), CornerRadius(cell * 0.35f))
        else -> drawRect(color, p, Size(cell + 0.5f, cell + 0.5f))
    }
}

private fun DrawScope.eye(frame: String, ball: String, p: Offset, cell: Float, color: Color, ballColor: Color) {
    val w = cell
    val outer = Size(cell * 7 - w, cell * 7 - w)
    val tl = Offset(p.x + w / 2, p.y + w / 2)
    when (frame) {
        "circle" -> drawCircle(color, cell * 3 - w / 2 + w / 2, Offset(p.x + cell * 3.5f, p.y + cell * 3.5f), style = Stroke(w))
        "rounded" -> drawRoundRect(color, tl, outer, CornerRadius(cell * 1.8f), style = Stroke(w))
        else -> drawRect(color, tl, outer, style = Stroke(w))
    }
    val b = when (ball) { "auto" -> frame; else -> ball }
    val bp = Offset(p.x + cell * 2, p.y + cell * 2)
    val bs = Size(cell * 3, cell * 3)
    when (b) {
        "circle" -> drawCircle(ballColor, cell * 1.5f, Offset(p.x + cell * 3.5f, p.y + cell * 3.5f))
        "rounded" -> drawRoundRect(ballColor, bp, bs, CornerRadius(cell * 0.8f))
        else -> drawRect(ballColor, bp, bs)
    }
}
