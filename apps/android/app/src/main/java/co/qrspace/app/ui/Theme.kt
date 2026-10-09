package co.qrspace.app.ui

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Typography
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontVariation
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.em
import androidx.compose.ui.unit.sp
import co.qrspace.app.R

/** The site's tokens (src/app/globals.css): concrete, ink and acid lime; light and dark. */
@Immutable
data class QrColors(
    val bg: Color,
    val card: Color,
    val field: Color,
    val line: Color,
    val ink: Color,
    val muted: Color,
    val accent: Color,
    val onAccent: Color,
    /** Lime is a fill; as text/border on light it isn't readable — accentInk is. */
    val accentInk: Color,
    val ok: Color,
    val warn: Color,
    val warnSoft: Color,
    /** Black "stage": camera, hero blocks. */
    val stage: Color,
    val onStage: Color,
    val stageLine: Color,
    val dark: Boolean,
) {
    /** A selected choice: the black stage with lime on light; on the black page — a lime tint and lime edge. */
    val picked: Color get() = if (dark) Lime.copy(alpha = 0.14f) else Night
    val pickedLine: Color get() = if (dark) Lime else Night
}

val Lime = Color(0xFFC6FF2E)
val Night = Color(0xFF0B0B0C)
val Bone = Color(0xFFF3F2EC)

private val LightColors = QrColors(
    bg = Color(0xFFEDEBE4), card = Color(0xFFF9F8F4), field = Color(0xFFF2F0E9), line = Color(0xFFD8D5CA),
    ink = Night, muted = Color(0xFF5D5B55), accent = Lime, onAccent = Night, accentInk = Night,
    ok = Color(0xFF15803D), warn = Color(0xFFC2410C), warnSoft = Color(0xFFFDF0E8),
    stage = Night, onStage = Bone, stageLine = Color(0xFF2A2A2E), dark = false,
)

private val DarkColors = QrColors(
    bg = Night, card = Color(0xFF141416), field = Color(0xFF1B1B1E), line = Color(0xFF2B2B30),
    ink = Bone, muted = Color(0xFF9C9A92), accent = Lime, onAccent = Night, accentInk = Lime,
    ok = Color(0xFF22C55E), warn = Color(0xFFFB923C), warnSoft = Color(0xFF2A1A10),
    stage = Color(0xFF141416), onStage = Bone, stageLine = Color(0xFF2B2B30), dark = true,
)

val LocalQr = staticCompositionLocalOf { LightColors }

@OptIn(androidx.compose.ui.text.ExperimentalTextApi::class)
private fun variable(res: Int, w: Int) = Font(res, FontWeight(w), variationSettings = FontVariation.Settings(FontVariation.weight(w)))

/** Unbounded — the site's display face (wide, heavy). Armenian falls back to the system Noto. */
val Display = FontFamily(variable(R.font.unbounded, 500), variable(R.font.unbounded, 700), variable(R.font.unbounded, 800), variable(R.font.unbounded, 900))
/** Onest — body text. */
val Body = FontFamily(variable(R.font.onest, 400), variable(R.font.onest, 500), variable(R.font.onest, 600), variable(R.font.onest, 700))
/** JetBrains Mono — kickers, numbers, barcodes. */
val Mono = FontFamily(variable(R.font.jetbrains_mono, 400), variable(R.font.jetbrains_mono, 600))

object Type {
    val hero = TextStyle(fontFamily = Display, fontWeight = FontWeight(900), fontSize = 34.sp, lineHeight = 36.sp, letterSpacing = (-0.03).em)
    val h1 = TextStyle(fontFamily = Display, fontWeight = FontWeight(800), fontSize = 26.sp, lineHeight = 30.sp, letterSpacing = (-0.02).em)
    val h2 = TextStyle(fontFamily = Display, fontWeight = FontWeight(800), fontSize = 19.sp, lineHeight = 24.sp, letterSpacing = (-0.02).em)
    val h3 = TextStyle(fontFamily = Display, fontWeight = FontWeight(700), fontSize = 15.sp, lineHeight = 20.sp, letterSpacing = (-0.01).em)
    val body = TextStyle(fontFamily = Body, fontWeight = FontWeight(400), fontSize = 16.sp, lineHeight = 23.sp)
    val bodyStrong = TextStyle(fontFamily = Body, fontWeight = FontWeight(600), fontSize = 16.sp, lineHeight = 22.sp)
    val small = TextStyle(fontFamily = Body, fontWeight = FontWeight(500), fontSize = 13.sp, lineHeight = 18.sp)
    val kicker = TextStyle(fontFamily = Mono, fontWeight = FontWeight(600), fontSize = 11.sp, lineHeight = 14.sp, letterSpacing = 0.12.em)
    val mono = TextStyle(fontFamily = Mono, fontWeight = FontWeight(600), fontSize = 20.sp, lineHeight = 26.sp, letterSpacing = 0.04.em)
    val stat = TextStyle(fontFamily = Display, fontWeight = FontWeight(900), fontSize = 30.sp, lineHeight = 32.sp, letterSpacing = (-0.03).em)
    val button = TextStyle(fontFamily = Display, fontWeight = FontWeight(700), fontSize = 14.sp, lineHeight = 18.sp, letterSpacing = (-0.01).em)
}

@Composable
fun QrTheme(dark: Boolean = isSystemInDarkTheme(), content: @Composable () -> Unit) {
    val c = if (dark) DarkColors else LightColors
    val scheme = if (dark) {
        darkColorScheme(primary = Lime, onPrimary = Night, background = c.bg, onBackground = c.ink, surface = c.card, onSurface = c.ink, surfaceVariant = c.field, onSurfaceVariant = c.muted, outline = c.line, surfaceContainerLow = c.card, surfaceContainer = c.card, surfaceContainerHigh = c.field)
    } else {
        lightColorScheme(primary = Night, onPrimary = Lime, background = c.bg, onBackground = c.ink, surface = c.card, onSurface = c.ink, surfaceVariant = c.field, onSurfaceVariant = c.muted, outline = c.line, surfaceContainerLow = c.card, surfaceContainer = c.card, surfaceContainerHigh = c.field)
    }
    CompositionLocalProvider(LocalQr provides c) {
        MaterialTheme(colorScheme = scheme, typography = Typography(bodyLarge = Type.body, bodyMedium = Type.small, titleLarge = Type.h2, labelLarge = Type.button), content = content)
    }
}
