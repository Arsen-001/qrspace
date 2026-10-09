package co.qrspace.app.edit

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.ImageDecoder
import android.net.Uri
import android.os.Build
import android.provider.OpenableColumns
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
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
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import co.qrspace.app.R
import co.qrspace.app.app
import co.qrspace.app.codes.VideoPlayer
import co.qrspace.app.data.ApiException
import co.qrspace.app.data.Attachment
import co.qrspace.app.data.Block
import co.qrspace.app.data.CodeView
import co.qrspace.app.data.Storage
import co.qrspace.app.ui.Bone
import co.qrspace.app.ui.BtnKind
import co.qrspace.app.ui.Glyphs
import co.qrspace.app.ui.Kicker
import co.qrspace.app.ui.Lime
import co.qrspace.app.ui.LocalQr
import co.qrspace.app.ui.Night
import co.qrspace.app.ui.QButton
import co.qrspace.app.ui.QCard
import co.qrspace.app.ui.QField
import co.qrspace.app.ui.Segmented
import co.qrspace.app.ui.Type
import co.qrspace.app.ui.dotGrid
import co.qrspace.app.ui.fmtBytes
import co.qrspace.app.ui.fmtDate
import co.qrspace.app.ui.fmtNum
import coil3.compose.AsyncImage
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.ByteArrayOutputStream

private val VIDEO_TYPES = setOf("video/mp4", "video/quicktime", "video/webm")
private val PHOTO_TYPES = setOf("image/jpeg", "image/png", "image/webp", "image/heic", "image/heif", "image/gif")

private const val MAX_PHOTO_PX = 1600

/** Photos are shrunk on the phone to 1600 px JPEG, like the site does in the browser — faster and less space. */
private suspend fun shrinkPhoto(ctx: Context, uri: Uri): ByteArray = withContext(Dispatchers.IO) {
    val bmp: Bitmap = if (Build.VERSION.SDK_INT >= 28) {
        ImageDecoder.decodeBitmap(ImageDecoder.createSource(ctx.contentResolver, uri)) { d, info, _ ->
            val w = info.size.width
            val h = info.size.height
            val scale = minOf(1f, MAX_PHOTO_PX.toFloat() / maxOf(w, h))
            d.setTargetSize(maxOf(1, (w * scale).toInt()), maxOf(1, (h * scale).toInt()))
            d.allocator = ImageDecoder.ALLOCATOR_SOFTWARE
        }
    } else {
        val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        ctx.contentResolver.openInputStream(uri)?.use { BitmapFactory.decodeStream(it, null, bounds) }
        var sample = 1
        while (maxOf(bounds.outWidth, bounds.outHeight) / (sample * 2) >= MAX_PHOTO_PX) sample *= 2
        val raw = ctx.contentResolver.openInputStream(uri)?.use { BitmapFactory.decodeStream(it, null, BitmapFactory.Options().apply { inSampleSize = sample }) }
            ?: throw IllegalArgumentException("photo")
        val scale = minOf(1f, MAX_PHOTO_PX.toFloat() / maxOf(raw.width, raw.height))
        if (scale < 1f) Bitmap.createScaledBitmap(raw, (raw.width * scale).toInt(), (raw.height * scale).toInt(), true) else raw
    }
    ByteArrayOutputStream().use { out -> bmp.compress(Bitmap.CompressFormat.JPEG, 85, out); out.toByteArray() }
}

private fun meta(ctx: Context, uri: Uri): Pair<String, Long> {
    var name = "file"
    var size = -1L
    ctx.contentResolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME, OpenableColumns.SIZE), null, null, null)?.use { c ->
        if (c.moveToFirst()) {
            c.getColumnIndex(OpenableColumns.DISPLAY_NAME).takeIf { it >= 0 }?.let { name = c.getString(it) ?: name }
            c.getColumnIndex(OpenableColumns.SIZE).takeIf { it >= 0 && !c.isNull(it) }?.let { size = c.getLong(it) }
        }
    }
    if (size < 0) size = ctx.contentResolver.openAssetFileDescriptor(uri, "r")?.use { it.length } ?: 0
    return name to size
}

private fun fits(c: CodeView, need: Long) = c.storage == null || c.storage.used + need <= c.storage.quota

/**
 * The memory under a code: space bar, "Add to memory" (text, photo, video) and the entries with edit/delete.
 * A file that doesn't fit shows the room offer first: its size, the free space, the plan it needs and the price —
 * "Pay $X and upload" buys the space and uploads straight away. The server measures again; 413 is handled.
 */
@Composable
fun MemoryEditor(code: CodeView, onChange: (CodeView) -> Unit) {
    val ctx = LocalContext.current
    val me by ctx.app.session.me.collectAsState()
    val q = LocalQr.current
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        code.storage?.let { SpaceBar(it.used, it.quota, it.until) }
        if (code.access == "owner" || code.access == "edit") Composer(code, onChange)
        val blocks = code.blocks.orEmpty()
        if (blocks.isEmpty()) Text(stringResource(R.string.memory_empty), style = Type.body, color = q.muted)
        blocks.asReversed().forEach { b -> Entry(code, b, me?.me, onChange) }
    }
}

@Composable
private fun SpaceBar(used: Long, quota: Long, until: String?) {
    val q = LocalQr.current
    Column {
        Row(verticalAlignment = Alignment.Bottom) {
            Kicker(stringResource(R.string.storage_title), modifier = Modifier.weight(1f))
            Text(stringResource(R.string.space_used, fmtBytes(used), fmtBytes(quota)), style = Type.small, color = q.muted)
        }
        Spacer(Modifier.height(6.dp))
        Box(Modifier.fillMaxWidth().height(6.dp).clip(RoundedCornerShape(3.dp)).background(q.field)) {
            Box(Modifier.fillMaxWidth(if (quota == 0L) 0f else (used.toFloat() / quota).coerceIn(0.02f, 1f)).fillMaxHeight().background(if (used >= quota) q.warn else Lime))
        }
        if (until != null) Text(stringResource(R.string.storage_paid_until) + " " + fmtDate(until), style = Type.small, color = q.muted, modifier = Modifier.padding(top = 4.dp))
    }
}

@Composable
private fun Composer(code: CodeView, onChange: (CodeView) -> Unit) {
    val ctx = LocalContext.current
    val api = ctx.app.api
    val q = LocalQr.current
    val scope = rememberCoroutineScope()
    var kind by remember { mutableStateOf("text") }
    var text by remember { mutableStateOf("") }
    var file by remember { mutableStateOf<Attachment?>(null) }
    var fileName by remember { mutableStateOf<String?>(null) }
    var preparing by remember { mutableStateOf(false) }
    var busy by remember { mutableStateOf(false) }
    var progress by remember { mutableStateOf<Int?>(null) }
    var error by remember { mutableStateOf<Int?>(null) }
    /** Bytes this entry needs when it doesn't fit — shows the room offer. */
    var offer by remember { mutableStateOf<Long?>(null) }

    fun need(f: Attachment?, t: String) = (f?.size ?: 0L) + t.toByteArray().size

    /** current — the code after buying space (new quota), otherwise as now. */
    suspend fun submit(current: CodeView = code) {
        busy = true
        error = null
        val sentText = text
        val sent = file
        val n = need(sent, sentText)
        // First: how much space and does it fit — doesn't fit → the price, the file is not sent.
        if (!fits(current, n)) {
            offer = n; busy = false; return
        }
        offer = null
        try {
            val video = sent as? Attachment.Stream
            // A video asks the server first: room for exactly this size (413 if not), then either straight to file
            // storage (production: one PUT with the given headers) or the ordinary form (a server without storage).
            val u = if (video != null) api.uploadUrl(code.id, video.size, video.mime) else null
            if (video != null && u != null && u.direct) {
                api.putFile(u, video.uri, video.size) { progress = it }
                onChange(api.addUploaded(code.id, sentText, u.name))
            } else {
                onChange(api.addBlock(code.id, sentText, sent) { progress = it })
            }
            if (text == sentText) text = ""
            if (file === sent) { file = null; fileName = null }
        } catch (e: ApiException) {
            if (e.code == 413) {
                // The server measured and it doesn't fit (someone else added meanwhile, or our numbers were old).
                val fresh = runCatching { api.code(code.id) }.getOrNull()
                if (fresh != null) onChange(fresh)
                if (fresh != null && !fits(fresh, n)) offer = n else error = R.string.storage_full
            } else error = R.string.upload_error
        } catch (_: Exception) {
            error = R.string.upload_error
        } finally {
            busy = false
            progress = null
        }
    }

    // Paid for space — upload right away.
    fun payAndUpload(plan: String) {
        scope.launch {
            busy = true
            runCatching { api.buyStorage(code.id, plan) }
                .onSuccess { next -> onChange(next); submit(next) }
                .onFailure { error = R.string.upload_error; busy = false }
        }
    }

    val photoPicker = rememberLauncherForActivityResult(ActivityResultContracts.PickVisualMedia()) { uri ->
        if (uri == null) return@rememberLauncherForActivityResult
        error = null
        offer = null
        val mime = ctx.contentResolver.getType(uri) ?: ""
        if (mime !in PHOTO_TYPES) { error = R.string.file_unsupported; return@rememberLauncherForActivityResult }
        scope.launch {
            preparing = true
            runCatching { shrinkPhoto(ctx, uri) }
                .onSuccess { bytes ->
                    file = Attachment.Bytes(bytes, "image/jpeg", "photo.jpg", "photo")
                    fileName = meta(ctx, uri).first + " · " + fmtBytes(bytes.size.toLong())
                }
                .onFailure { error = R.string.file_unsupported }
            preparing = false
        }
    }
    val videoPicker = rememberLauncherForActivityResult(ActivityResultContracts.PickVisualMedia()) { uri ->
        if (uri == null) return@rememberLauncherForActivityResult
        error = null
        offer = null
        val mime = ctx.contentResolver.getType(uri) ?: ""
        if (mime !in VIDEO_TYPES) { error = R.string.file_unsupported; return@rememberLauncherForActivityResult }
        scope.launch {
            preparing = true
            val (name, size) = withContext(Dispatchers.IO) { meta(ctx, uri) }
            preparing = false
            when {
                size > Storage.MAX_FILE -> error = R.string.video_too_big
                else -> {
                    val f = Attachment.Stream(uri, size, mime, name, "video")
                    file = f
                    fileName = "$name · " + fmtBytes(size)
                    // Video: the size is known now — doesn't fit → the price of the space before "Save".
                    val n = need(f, text)
                    if (!fits(code, n)) offer = n
                }
            }
        }
    }

    val ready = if (kind == "text") text.isNotBlank() else file != null
    val shape = RoundedCornerShape(14.dp)
    Column(
        Modifier.fillMaxWidth().clip(shape).background(q.card)
            .drawBehind {
                drawRoundRect(q.line, cornerRadius = CornerRadius(14.dp.toPx()), style = Stroke(2.dp.toPx(), pathEffect = PathEffect.dashPathEffect(floatArrayOf(10f, 8f))))
            }
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.size(28.dp).clip(RoundedCornerShape(8.dp)).background(q.accent), contentAlignment = Alignment.Center) {
                Icon(Glyphs.Plus, null, tint = q.onAccent, modifier = Modifier.size(16.dp))
            }
            Spacer(Modifier.width(10.dp))
            Text(stringResource(R.string.composer_title), style = Type.h3, color = q.ink, modifier = Modifier.semantics { heading() })
        }
        Segmented(
            listOf("text" to stringResource(R.string.add_text), "photo" to stringResource(R.string.add_photo), "video" to stringResource(R.string.add_video)),
            kind,
            { kind = it; file = null; fileName = null; error = null; offer = null },
            icons = mapOf("text" to Glyphs.Text, "photo" to Glyphs.Camera, "video" to Glyphs.Video),
        )
        if (kind != "text") {
            Row(verticalAlignment = Alignment.CenterVertically) {
                QButton(
                    stringResource(if (file != null) R.string.replace else R.string.upload),
                    {
                        val type = if (kind == "photo") ActivityResultContracts.PickVisualMedia.ImageOnly else ActivityResultContracts.PickVisualMedia.VideoOnly
                        (if (kind == "photo") photoPicker else videoPicker).launch(PickVisualMediaRequest(type))
                    },
                    kind = BtnKind.Ghost, enabled = !busy && !preparing,
                    icon = if (kind == "photo") Glyphs.Camera else Glyphs.Video,
                )
                Spacer(Modifier.width(12.dp))
                if (preparing) CircularProgressIndicator(Modifier.size(18.dp), color = q.accentInk, strokeWidth = 2.dp)
                else Text(fileName ?: if (kind == "video") stringResource(R.string.video_limit) else "", style = Type.small, color = q.muted, maxLines = 3, overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f))
            }
        }
        QField(
            text, { text = it; if (offer != null) offer = need(file, it).takeIf { n -> !fits(code, n) } },
            stringResource(if (kind == "text") R.string.add_text else R.string.caption_placeholder),
            placeholder = if (kind == "text") stringResource(R.string.text_placeholder) else null,
            singleLine = false, minLines = if (kind == "text") 4 else 2,
        )
        offer?.let { n -> RoomOffer(code, n, busy, onPay = ::payAndUpload, onCancel = { offer = null }) }
        error?.let { Text(stringResource(it), style = Type.small, color = q.warn, modifier = Modifier.semantics { liveRegion = LiveRegionMode.Polite }) }
        if (offer == null) QButton(
            if (busy) stringResource(R.string.uploading) + (progress?.takeIf { it in 1..99 }?.let { " $it%" } ?: "") else stringResource(R.string.save),
            { scope.launch { submit() } },
            Modifier.fillMaxWidth(),
            enabled = ready && !busy && !preparing,
        )
    }
}

/** Doesn't fit: file size, free space, the smallest plan it fits in and its price; only the owner can buy space. */
@Composable
fun RoomOffer(code: CodeView, need: Long, busy: Boolean, onPay: (String) -> Unit, onCancel: () -> Unit) {
    val st = code.storage ?: return
    val plan = Storage.planFor(st.used + need)
    val owner = code.access == "owner"
    Column(
        Modifier.fillMaxWidth().clip(RoundedCornerShape(14.dp)).background(LocalQr.current.stage).border(1.dp, LocalQr.current.stageLine, RoundedCornerShape(14.dp)).dotGrid(Bone.copy(alpha = 0.06f)).padding(16.dp)
            .semantics { liveRegion = LiveRegionMode.Assertive },
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Text(stringResource(R.string.up_too_big_title), style = Type.h3, color = Bone)
        Text(
            stringResource(R.string.up_sizes, fmtBytes(need), fmtBytes(maxOf(0, st.quota - st.used)), fmtBytes(st.quota)),
            style = Type.kicker.copy(letterSpacing = androidx.compose.ui.unit.TextUnit(0.02f, androidx.compose.ui.unit.TextUnitType.Em)), color = Bone.copy(alpha = 0.75f),
        )
        when {
            plan == null -> Text(stringResource(R.string.up_max, fmtBytes(Storage.PLANS.last().bytes)), style = Type.body, color = Bone.copy(alpha = 0.85f))
            !owner -> Text(stringResource(R.string.up_owner_only), style = Type.body, color = Bone.copy(alpha = 0.85f))
            else -> {
                Text(stringResource(R.string.up_need, fmtBytes(plan.bytes), fmtNum(plan.price)), style = Type.bodyStrong, color = Bone)
                Text(stringResource(R.string.buy_demo), style = Type.small, color = Lime)
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                    QButton(
                        if (busy) stringResource(R.string.uploading) else stringResource(R.string.up_pay, fmtNum(plan.price)),
                        { onPay(plan.id) }, Modifier.weight(1f), enabled = !busy,
                    )
                    QButton(stringResource(R.string.cancel), onCancel, kind = BtnKind.Stage)
                }
            }
        }
        if (plan == null || !owner) QButton(stringResource(R.string.cancel), onCancel, kind = BtnKind.Stage)
    }
}

@Composable
private fun Entry(code: CodeView, b: Block, me: String?, onChange: (CodeView) -> Unit) {
    val ctx = LocalContext.current
    val api = ctx.app.api
    val session = ctx.app.session
    val q = LocalQr.current
    val scope = rememberCoroutineScope()
    var editing by remember { mutableStateOf<String?>(null) }
    var sure by remember { mutableStateOf(false) }
    var busy by remember { mutableStateOf(false) }
    val canChange = code.access == "owner" || (code.access == "edit" && b.author == me)

    fun run(fn: suspend () -> CodeView) {
        scope.launch {
            busy = true
            runCatching { fn() }.onSuccess { onChange(it); editing = null }.onFailure { sure = false }
            busy = false
        }
    }

    QCard(Modifier.fillMaxWidth(), padding = PaddingValues(0.dp)) {
        when (b.kind) {
            "photo" -> AsyncImage(
                model = api.mediaUrl(b.media ?: ""), contentDescription = b.text.ifEmpty { stringResource(R.string.photo) },
                contentScale = ContentScale.FillWidth, modifier = Modifier.fillMaxWidth().heightIn(min = 120.dp).background(q.field),
            )
            "video" -> VideoPlayer(api.mediaUrl(b.media ?: ""))
        }
        Column(Modifier.padding(16.dp)) {
            val e = editing
            if (e != null) QField(e, { editing = it }, stringResource(R.string.edit), singleLine = false, minLines = 3)
            else if (b.text.isNotEmpty()) Text(b.text, style = Type.body, color = q.ink)
            Spacer(Modifier.height(8.dp))
            val who = if (b.author == me) stringResource(R.string.you) else session.name(b.author)
            Kicker(listOfNotNull(who?.takeIf { it.isNotEmpty() }, b.at.takeIf { it.isNotEmpty() }?.let { fmtDate(it) }).joinToString(" · "))
            if (canChange) Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End, verticalAlignment = Alignment.CenterVertically) {
                when {
                    e != null -> {
                        TextButton({ run { api.editBlock(code.id, b.id, e) } }, enabled = !busy) { Text(stringResource(R.string.save), color = q.accentInk, style = Type.button) }
                        TextButton({ editing = null }) { Text(stringResource(R.string.cancel), color = q.muted) }
                    }
                    sure -> {
                        Text(stringResource(R.string.delete_confirm), style = Type.small, color = q.warn, modifier = Modifier.weight(1f))
                        TextButton({ run { api.removeBlock(code.id, b.id) } }, enabled = !busy) { Text(stringResource(R.string.delete), color = q.warn, style = Type.button) }
                        TextButton({ sure = false }) { Text(stringResource(R.string.cancel), color = q.muted) }
                    }
                    else -> {
                        TextButton({ editing = b.text }) { Text(stringResource(R.string.edit), color = q.ink) }
                        TextButton({ sure = true }) { Text(stringResource(R.string.delete), color = q.muted) }
                    }
                }
            }
        }
    }
}
