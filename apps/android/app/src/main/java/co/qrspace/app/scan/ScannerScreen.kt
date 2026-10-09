package co.qrspace.app.scan

import android.Manifest
import android.app.Activity
import android.content.pm.PackageManager
import android.os.Build
import android.view.HapticFeedbackConstants
import android.widget.Toast
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.camera.core.resolutionselector.ResolutionSelector
import androidx.camera.core.resolutionselector.ResolutionStrategy
import androidx.camera.view.CameraController
import androidx.camera.view.LifecycleCameraController
import androidx.camera.view.PreviewView
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.BlendMode
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.CompositingStrategy
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.content.ContextCompat
import androidx.lifecycle.compose.LocalLifecycleOwner
import co.qrspace.app.R
import co.qrspace.app.app
import co.qrspace.app.data.record
import co.qrspace.app.ui.Bone
import co.qrspace.app.ui.BtnKind
import co.qrspace.app.ui.Glyphs
import co.qrspace.app.ui.Kicker
import co.qrspace.app.ui.Lime
import co.qrspace.app.ui.LocalQr
import co.qrspace.app.ui.Night
import co.qrspace.app.ui.QButton
import co.qrspace.app.ui.Type
import co.qrspace.app.ui.dotGrid
import kotlinx.coroutines.launch

/** Main tab: our own camera scanner for QR codes and barcodes. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ScannerScreen(onOpenCode: (Scan.Ours) -> Unit, onHistory: () -> Unit, active: Boolean) {
    val ctx = LocalContext.current
    val view = LocalView.current
    val scope = rememberCoroutineScope()
    val dao = remember { ctx.app.history.scans() }
    val scanner = remember { Decoder.client() }
    DisposableEffect(Unit) { onDispose { scanner.close() } }

    var granted by remember { mutableStateOf(ContextCompat.checkSelfPermission(ctx, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) }
    var asked by rememberSaveable { mutableStateOf(false) }
    val permission = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { ok -> granted = ok; asked = true }
    val blocked = asked && !granted && (ctx as? Activity)?.shouldShowRequestPermissionRationale(Manifest.permission.CAMERA) == false

    var result by remember { mutableStateOf<Pair<Scan, CodeFormat>?>(null) }
    var torch by remember { mutableStateOf(false) }
    var hasFlash by remember { mutableStateOf(false) }

    val analyzer = remember { mutableStateOf<Analyzer?>(null) }

    fun handle(raw: String, format: CodeFormat) {
        view.performHapticFeedback(if (Build.VERSION.SDK_INT >= 30) HapticFeedbackConstants.CONFIRM else HapticFeedbackConstants.LONG_PRESS)
        scope.launch { dao.record(raw, format.name) }
        val scan = ScanParser.parse(raw, format)
        if (scan is Scan.Ours) {
            onOpenCode(scan)
            // Back from the code → scanning again.
            analyzer.value?.paused = false
        } else {
            result = scan to format
        }
    }

    val pick = rememberLauncherForActivityResult(ActivityResultContracts.PickVisualMedia()) { uri ->
        if (uri != null) {
            analyzer.value?.paused = true
            Decoder.fromImage(ctx, uri, scanner) { raw, f ->
                if (raw == null) {
                    Toast.makeText(ctx, R.string.verify_not_found, Toast.LENGTH_LONG).show()
                    analyzer.value?.paused = false
                } else {
                    handle(raw, if (f == CodeFormat.UNKNOWN) CodeFormat.QR else f)
                }
            }
        }
    }
    val pickImage = { pick.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly)) }

    Box(Modifier.fillMaxSize().background(Night)) {
        if (granted) {
            CameraPreview(active = active && result == null, torch = torch, onFlash = { hasFlash = it }, onAnalyzer = { analyzer.value = it }, onCode = { raw, f -> view.post { handle(raw, f) } }, scanner = scanner)
            Viewfinder()
        } else {
            PermissionPane(blocked = blocked, onAllow = { permission.launch(Manifest.permission.CAMERA) }, onSettings = { Actions.appSettings(ctx) })
        }

        // Top: wordmark + history.
        Row(
            Modifier.fillMaxWidth().statusBarsPadding().padding(horizontal = 20.dp, vertical = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(
                buildAnnotatedString {
                    withStyle(SpanStyle(color = Lime)) { append("QR") }
                    append(" Space")
                },
                style = Type.h2.copy(fontSize = 22.sp),
                color = Bone,
                modifier = Modifier.weight(1f),
            )
            RoundButton(Glyphs.History, stringResource(R.string.history), onClick = onHistory)
        }

        // Bottom: hint and controls.
        Column(
            Modifier.align(Alignment.BottomCenter).fillMaxWidth().padding(bottom = 104.dp).navigationBarsPadding(),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            if (granted) {
                Text(stringResource(R.string.scan_hint), style = Type.bodyStrong, color = Bone, textAlign = TextAlign.Center, modifier = Modifier.padding(horizontal = 32.dp))
                Spacer(Modifier.height(6.dp))
                Kicker(stringResource(R.string.scanner_offline), color = Bone.copy(alpha = 0.6f))
                Spacer(Modifier.height(20.dp))
            }
            Row(horizontalArrangement = Arrangement.spacedBy(20.dp)) {
                if (granted && hasFlash) RoundButton(Glyphs.Torch, stringResource(if (torch) R.string.torch_off else R.string.torch_on), on = torch, big = true) { torch = !torch }
                RoundButton(Glyphs.Gallery, stringResource(R.string.pick_image), big = true, onClick = pickImage)
            }
        }
    }

    result?.let { (scan, format) ->
        val sheet = rememberModalBottomSheetState(skipPartiallyExpanded = true)
        ModalBottomSheet(
            onDismissRequest = { result = null; analyzer.value?.paused = false },
            sheetState = sheet,
            containerColor = LocalQr.current.card,
            shape = RoundedCornerShape(topStart = 18.dp, topEnd = 18.dp),
        ) {
            Column(Modifier.padding(horizontal = 20.dp).padding(bottom = 28.dp)) {
                ResultCard(scan, format)
                Spacer(Modifier.height(10.dp))
                QButton(stringResource(R.string.scan_again), {
                    scope.launch { sheet.hide() }.invokeOnCompletion { result = null; analyzer.value?.paused = false }
                }, kind = BtnKind.Ink, modifier = Modifier.fillMaxWidth())
            }
        }
    }
}

@Composable
private fun CameraPreview(
    active: Boolean,
    torch: Boolean,
    onFlash: (Boolean) -> Unit,
    scanner: com.google.mlkit.vision.barcode.BarcodeScanner,
    onAnalyzer: (Analyzer) -> Unit,
    onCode: (String, CodeFormat) -> Unit,
) {
    val ctx = LocalContext.current
    val owner = LocalLifecycleOwner.current
    val controller = remember { LifecycleCameraController(ctx) }
    val analyzer = remember { Analyzer(scanner, onCode).also(onAnalyzer) }
    DisposableEffect(owner) {
        // Analysis only (no photo capture); 720p so small barcodes still have enough pixels.
        controller.setEnabledUseCases(CameraController.IMAGE_ANALYSIS)
        controller.imageAnalysisResolutionSelector = ResolutionSelector.Builder()
            .setResolutionStrategy(ResolutionStrategy(android.util.Size(1280, 720), ResolutionStrategy.FALLBACK_RULE_CLOSEST_HIGHER_THEN_LOWER))
            .build()
        controller.setImageAnalysisAnalyzer(ContextCompat.getMainExecutor(ctx), analyzer)
        controller.bindToLifecycle(owner)
        // Torch button only where the camera has a flash.
        controller.initializationFuture.addListener({ onFlash(controller.cameraInfo?.hasFlashUnit() == true) }, ContextCompat.getMainExecutor(ctx))
        onDispose { controller.clearImageAnalysisAnalyzer(); controller.unbind() }
    }
    // Pause analysis while a result is open or another tab is shown.
    analyzer.paused = !active
    DisposableEffect(torch) {
        controller.enableTorch(torch)
        onDispose { }
    }
    AndroidView(
        factory = { c -> PreviewView(c).apply { scaleType = PreviewView.ScaleType.FILL_CENTER; this.controller = controller } },
        modifier = Modifier.fillMaxSize(),
    )
}

/** Dark scrim with a clear square, lime corner brackets and a sweeping line — the site's "stage" look. */
@Composable
private fun Viewfinder() {
    val t = rememberInfiniteTransition(label = "sweep")
    val sweep by t.animateFloat(0f, 1f, infiniteRepeatable(tween(2200, easing = LinearEasing), RepeatMode.Reverse), label = "sweep")
    Canvas(Modifier.fillMaxSize().graphicsLayer(compositingStrategy = CompositingStrategy.Offscreen)) {
        val side = size.minDimension * 0.68f
        val left = (size.width - side) / 2
        val top = (size.height - side) / 2 - size.height * 0.04f
        val r = 22.dp.toPx()
        drawRect(Night.copy(alpha = 0.55f))
        drawRoundRect(Color.Black, Offset(left, top), Size(side, side), CornerRadius(r), blendMode = BlendMode.Clear)
        val w = 5.dp.toPx()
        val arm = side * 0.16f
        val stroke = Stroke(width = w, cap = StrokeCap.Round)
        // Four corner brackets.
        listOf(Offset(left, top) to Offset(1f, 1f), Offset(left + side, top) to Offset(-1f, 1f), Offset(left, top + side) to Offset(1f, -1f), Offset(left + side, top + side) to Offset(-1f, -1f)).forEach { (p, d) ->
            val path = androidx.compose.ui.graphics.Path().apply {
                moveTo(p.x, p.y + d.y * arm)
                lineTo(p.x, p.y + d.y * r)
                quadraticTo(p.x, p.y, p.x + d.x * r, p.y)
                lineTo(p.x + d.x * arm, p.y)
            }
            drawPath(path, Lime, style = stroke)
        }
        val y = top + side * (0.08f + 0.84f * sweep)
        drawRect(
            Brush.verticalGradient(listOf(Color.Transparent, Lime.copy(alpha = 0.35f), Color.Transparent), startY = y - 24.dp.toPx(), endY = y + 24.dp.toPx()),
            Offset(left + 12.dp.toPx(), y - 24.dp.toPx()), Size(side - 24.dp.toPx(), 48.dp.toPx()),
        )
        drawLine(Lime, Offset(left + 16.dp.toPx(), y), Offset(left + side - 16.dp.toPx(), y), strokeWidth = 2.dp.toPx())
    }
}

@Composable
private fun PermissionPane(blocked: Boolean, onAllow: () -> Unit, onSettings: () -> Unit) {
    Box(Modifier.fillMaxSize().dotGrid(Bone.copy(alpha = 0.08f)), contentAlignment = Alignment.Center) {
        Column(Modifier.padding(horizontal = 28.dp).padding(bottom = 120.dp)) {
            Box(Modifier.size(64.dp).clip(RoundedCornerShape(14.dp)).background(Lime), contentAlignment = Alignment.Center) {
                Icon(Glyphs.Qr, contentDescription = null, tint = Night, modifier = Modifier.size(34.dp))
            }
            Spacer(Modifier.height(22.dp))
            Text(stringResource(R.string.camera_title), style = Type.hero, color = Bone)
            Spacer(Modifier.height(12.dp))
            Text(stringResource(if (blocked) R.string.camera_denied else R.string.camera_text), style = Type.body, color = Bone.copy(alpha = 0.75f))
            Spacer(Modifier.height(24.dp))
            if (blocked) {
                QButton(stringResource(R.string.open_settings), onSettings, modifier = Modifier.fillMaxWidth())
            } else {
                QButton(stringResource(R.string.camera_allow), onAllow, modifier = Modifier.fillMaxWidth())
            }
        }
    }
}

@Composable
private fun RoundButton(icon: ImageVector, label: String, on: Boolean = false, big: Boolean = false, onClick: () -> Unit) {
    val s = if (big) 60.dp else 46.dp
    Box(
        Modifier
            .size(s)
            .clip(CircleShape)
            .background(if (on) Lime else Night.copy(alpha = 0.6f))
            .border(1.dp, if (on) Lime else Bone.copy(alpha = 0.25f), CircleShape)
            .clickable(role = Role.Button, onClick = onClick)
            .semantics { contentDescription = label },
        contentAlignment = Alignment.Center,
    ) {
        Icon(icon, contentDescription = null, tint = if (on) Night else Bone, modifier = Modifier.size(if (big) 26.dp else 22.dp))
    }
}

