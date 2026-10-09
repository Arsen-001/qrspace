package co.qrspace.app.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.windowInsetsTopHeight
import androidx.compose.foundation.layout.statusBars
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.selection.selectableGroup
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import co.qrspace.app.R

val Radius = RoundedCornerShape(10.dp)
val RadiusSm = RoundedCornerShape(6.dp)

/** The site's background: QR "modules" — faint dots on a 22dp grid. */
fun Modifier.dotGrid(color: Color, step: Dp = 22.dp): Modifier = drawBehind {
    val s = step.toPx()
    val r = 1.1.dp.toPx()
    var y = s / 2
    while (y < size.height) {
        var x = s / 2
        while (x < size.width) {
            drawCircle(color, r, Offset(x, y)); x += s
        }
        y += s
    }
}

@Composable
fun Screen(modifier: Modifier = Modifier, content: @Composable androidx.compose.foundation.layout.BoxScope.() -> Unit) {
    val c = LocalQr.current
    Box(modifier.fillMaxSize().background(c.bg).dotGrid(c.ink.copy(alpha = 0.07f))) { content() }
}

/** Mono uppercase label above a heading, like the site's section kickers. */
@Composable
fun Kicker(text: String, modifier: Modifier = Modifier, color: Color = LocalQr.current.muted) {
    Text(text.uppercase(), style = Type.kicker, color = color, modifier = modifier)
}

@Composable
fun Heading(text: String, modifier: Modifier = Modifier, color: Color = LocalQr.current.ink) {
    Text(text, style = Type.h1, color = color, modifier = modifier.semantics { heading() })
}

@Composable
fun QCard(modifier: Modifier = Modifier, padding: PaddingValues = PaddingValues(16.dp), content: @Composable ColumnScope.() -> Unit) {
    val c = LocalQr.current
    Column(modifier.clip(Radius).background(c.card).border(1.dp, c.line, Radius).padding(padding), content = content)
}

enum class BtnKind { Lime, Ink, Ghost, Stage }

/** Heavy, squared buttons: lime fill for the main action, ink for secondary, outline for the rest. */
@Composable
fun QButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    kind: BtnKind = BtnKind.Lime,
    icon: ImageVector? = null,
    enabled: Boolean = true,
) {
    val c = LocalQr.current
    val (bg, fg) = when (kind) {
        BtnKind.Lime -> c.accent to c.onAccent
        BtnKind.Ink -> c.ink to c.bg
        BtnKind.Ghost -> Color.Transparent to c.ink
        BtnKind.Stage -> Color.Transparent to Bone
    }
    Row(
        modifier
            .heightIn(min = 48.dp)
            .clip(RadiusSm)
            .background(if (enabled) bg else bg.copy(alpha = 0.4f))
            .then(
                when (kind) {
                    BtnKind.Ghost -> Modifier.border(1.5.dp, c.line, RadiusSm)
                    BtnKind.Stage -> Modifier.border(1.5.dp, Bone.copy(alpha = 0.35f), RadiusSm)
                    else -> Modifier
                },
            )
            .clickable(enabled = enabled, role = Role.Button, onClick = onClick)
            .padding(horizontal = 16.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.Center,
    ) {
        if (icon != null) {
            Icon(icon, contentDescription = null, tint = fg, modifier = Modifier.size(18.dp))
            Spacer(Modifier.width(8.dp))
        }
        Text(text, style = Type.button, color = fg, textAlign = TextAlign.Center)
    }
}

@Composable
fun Loading(modifier: Modifier = Modifier, label: String = stringResource(R.string.loading)) {
    val c = LocalQr.current
    Column(modifier.fillMaxWidth().padding(48.dp), horizontalAlignment = Alignment.CenterHorizontally) {
        CircularProgressIndicator(color = c.accentInk, strokeWidth = 3.dp, modifier = Modifier.size(32.dp))
        Spacer(Modifier.height(12.dp))
        Text(label, style = Type.small, color = c.muted)
    }
}

@Composable
fun ErrorBox(text: String, onRetry: (() -> Unit)?, modifier: Modifier = Modifier) {
    val c = LocalQr.current
    QCard(modifier.fillMaxWidth()) {
        Text(text, style = Type.body, color = c.ink)
        if (onRetry != null) {
            Spacer(Modifier.height(12.dp))
            QButton(stringResource(R.string.err_retry), onRetry, kind = BtnKind.Ink)
        }
    }
}

/** Small lime pill for a status or count. */
@Composable
fun Pill(text: String, modifier: Modifier = Modifier, bg: Color = LocalQr.current.accent, fg: Color = LocalQr.current.onAccent) {
    Text(text, style = Type.kicker, color = fg, modifier = modifier.clip(RoundedCornerShape(4.dp)).background(bg).padding(horizontal = 8.dp, vertical = 4.dp))
}

/** Text field in the site's look: field background, hairline border, ink focus. */
@Composable
fun QField(
    value: String,
    onChange: (String) -> Unit,
    label: String,
    modifier: Modifier = Modifier,
    placeholder: String? = null,
    singleLine: Boolean = true,
    minLines: Int = 1,
    keyboard: androidx.compose.ui.text.input.KeyboardType = androidx.compose.ui.text.input.KeyboardType.Text,
    password: Boolean = false,
    maxLength: Int = 5000,
    trailing: (@Composable () -> Unit)? = null,
) {
    val c = LocalQr.current
    androidx.compose.material3.OutlinedTextField(
        value = value,
        onValueChange = { onChange(it.take(maxLength)) },
        label = { Text(label) },
        placeholder = placeholder?.let { { Text(it, color = c.muted) } },
        singleLine = singleLine,
        minLines = minLines,
        maxLines = if (singleLine) 1 else 12,
        keyboardOptions = androidx.compose.foundation.text.KeyboardOptions(keyboardType = keyboard),
        visualTransformation = if (password) androidx.compose.ui.text.input.PasswordVisualTransformation() else androidx.compose.ui.text.input.VisualTransformation.None,
        trailingIcon = trailing,
        textStyle = Type.body.copy(color = c.ink),
        shape = RadiusSm,
        colors = androidx.compose.material3.OutlinedTextFieldDefaults.colors(
            focusedBorderColor = c.accentInk,
            unfocusedBorderColor = c.line,
            focusedLabelColor = c.ink,
            unfocusedLabelColor = c.muted,
            focusedContainerColor = c.field,
            unfocusedContainerColor = c.field,
            cursorColor = c.ink,
        ),
        modifier = modifier.fillMaxWidth(),
    )
}

/** A choice tile: selected — black stage with lime, like the site's segmented choices. */
@Composable
fun Chip(
    text: String,
    selected: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    icon: ImageVector? = null,
    role: Role = Role.RadioButton,
) {
    val c = LocalQr.current
    Row(
        modifier
            .heightIn(min = 44.dp)
            .clip(RadiusSm)
            .background(if (selected) c.picked else c.field)
            .border(1.dp, if (selected) c.pickedLine else c.line, RadiusSm)
            .then(
                if (role == Role.RadioButton) Modifier.selectable(selected, role = Role.RadioButton, onClick = onClick)
                else Modifier.clickable(role = role, onClick = onClick),
            )
            .padding(horizontal = 12.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.Center,
    ) {
        if (icon != null) {
            Icon(icon, null, tint = if (selected) Lime else c.ink, modifier = Modifier.size(18.dp))
            Spacer(Modifier.width(8.dp))
        }
        Text(text, style = Type.small.copy(fontWeight = androidx.compose.ui.text.font.FontWeight.SemiBold), color = if (selected) Bone else c.ink, textAlign = TextAlign.Center)
    }
}

/** Several options in one row (Text · Photo · Video). */
@Composable
fun <T> Segmented(options: List<Pair<T, String>>, value: T, onChange: (T) -> Unit, modifier: Modifier = Modifier, icons: Map<T, ImageVector> = emptyMap()) {
    Row(modifier.fillMaxWidth().selectableGroup(), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
        options.forEach { (id, label) -> Chip(label, value == id, { onChange(id) }, Modifier.weight(1f), icon = icons[id]) }
    }
}

/** Who sees it: icon + label, on a light or a stage background. */
@Composable
fun VisBadge(v: String, onStage: Boolean = false) {
    val c = LocalQr.current
    val label = SiteText.vis[v]?.let { stringResource(it) } ?: v
    Row(
        Modifier.clip(RoundedCornerShape(50)).background(if (onStage) Bone.copy(alpha = 0.1f) else c.field).padding(horizontal = 10.dp, vertical = 5.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(Glyphs.visibility(v), null, tint = if (onStage) Bone.copy(alpha = 0.8f) else c.muted, modifier = Modifier.size(14.dp))
        Spacer(Modifier.width(6.dp))
        Text(label, style = Type.small.copy(fontSize = androidx.compose.ui.unit.TextUnit(12f, androidx.compose.ui.unit.TextUnitType.Sp)), color = if (onStage) Bone.copy(alpha = 0.85f) else c.muted)
    }
}

/** A section card with a numbered step badge (the generator's steps 1–2). */
@Composable
fun StepCard(step: Int?, title: String, modifier: Modifier = Modifier, content: @Composable ColumnScope.() -> Unit) {
    val c = LocalQr.current
    QCard(modifier.fillMaxWidth()) {
        Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(bottom = 14.dp)) {
            if (step != null) {
                Box(Modifier.size(28.dp).clip(RoundedCornerShape(8.dp)).background(Night), contentAlignment = Alignment.Center) {
                    Text("$step", style = Type.button, color = Lime)
                }
                Spacer(Modifier.width(10.dp))
            }
            Text(title, style = Type.h2, color = c.ink, modifier = Modifier.semantics { heading() })
        }
        content()
    }
}

/** Edge-to-edge pages scroll under the status bar — a strip of the page colour keeps the clock readable. */
@Composable
fun androidx.compose.foundation.layout.BoxScope.StatusScrim(color: Color) {
    Box(
        Modifier.align(Alignment.TopCenter).fillMaxWidth()
            .windowInsetsTopHeight(androidx.compose.foundation.layout.WindowInsets.statusBars)
            .background(color.copy(alpha = 0.94f)),
    )
}
