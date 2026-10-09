package co.qrspace.app.scan

import android.content.Context
import android.net.Uri
import androidx.annotation.OptIn
import androidx.camera.core.ExperimentalGetImage
import androidx.camera.core.ImageAnalysis
import androidx.camera.core.ImageProxy
import com.google.mlkit.vision.barcode.BarcodeScanner
import com.google.mlkit.vision.barcode.BarcodeScannerOptions
import com.google.mlkit.vision.barcode.BarcodeScanning
import com.google.mlkit.vision.barcode.common.Barcode
import com.google.mlkit.vision.common.InputImage

/** ML Kit (bundled model: works offline, no Play Services download) for QR and the common barcodes. */
object Decoder {
    private val options = BarcodeScannerOptions.Builder()
        .setBarcodeFormats(
            Barcode.FORMAT_QR_CODE, Barcode.FORMAT_AZTEC, Barcode.FORMAT_DATA_MATRIX, Barcode.FORMAT_PDF417,
            Barcode.FORMAT_EAN_13, Barcode.FORMAT_EAN_8, Barcode.FORMAT_UPC_A, Barcode.FORMAT_UPC_E,
            Barcode.FORMAT_CODE_128, Barcode.FORMAT_CODE_39, Barcode.FORMAT_CODE_93, Barcode.FORMAT_ITF, Barcode.FORMAT_CODABAR,
        )
        .build()

    fun client(): BarcodeScanner = BarcodeScanning.getClient(options)

    fun format(f: Int): CodeFormat = when (f) {
        Barcode.FORMAT_QR_CODE -> CodeFormat.QR
        Barcode.FORMAT_AZTEC -> CodeFormat.AZTEC
        Barcode.FORMAT_DATA_MATRIX -> CodeFormat.DATA_MATRIX
        Barcode.FORMAT_PDF417 -> CodeFormat.PDF417
        Barcode.FORMAT_EAN_13 -> CodeFormat.EAN_13
        Barcode.FORMAT_EAN_8 -> CodeFormat.EAN_8
        Barcode.FORMAT_UPC_A -> CodeFormat.UPC_A
        Barcode.FORMAT_UPC_E -> CodeFormat.UPC_E
        Barcode.FORMAT_CODE_128 -> CodeFormat.CODE_128
        Barcode.FORMAT_CODE_39 -> CodeFormat.CODE_39
        Barcode.FORMAT_CODE_93 -> CodeFormat.CODE_93
        Barcode.FORMAT_ITF -> CodeFormat.ITF
        Barcode.FORMAT_CODABAR -> CodeFormat.CODABAR
        else -> CodeFormat.UNKNOWN
    }

    private fun Barcode.value(): String? = rawValue ?: rawBytes?.toString(Charsets.UTF_8)

    /** Decode a picture from the gallery. Calls back with null when there's no code in it. */
    fun fromImage(ctx: Context, uri: Uri, scanner: BarcodeScanner, done: (String?, CodeFormat) -> Unit) {
        val image = runCatching { InputImage.fromFilePath(ctx, uri) }.getOrNull() ?: return done(null, CodeFormat.UNKNOWN)
        scanner.process(image)
            .addOnSuccessListener { list ->
                // Prefer a 2D code (QR) if the photo has several.
                val b = list.firstOrNull { it.format == Barcode.FORMAT_QR_CODE && it.value() != null } ?: list.firstOrNull { it.value() != null }
                done(b?.value(), b?.let { format(it.format) } ?: CodeFormat.UNKNOWN)
            }
            .addOnFailureListener { done(null, CodeFormat.UNKNOWN) }
    }
}

/**
 * Camera frames → first readable code. 1D barcodes must read the same twice in a row (single-frame misreads
 * of EAN/Code 39 happen); QR has its own error correction, one frame is enough.
 */
class Analyzer(private val scanner: BarcodeScanner, private val onCode: (String, CodeFormat) -> Unit) : ImageAnalysis.Analyzer {
    @Volatile var paused = false
    private var lastLinear: String? = null

    @OptIn(ExperimentalGetImage::class)
    override fun analyze(proxy: ImageProxy) {
        val media = proxy.image
        if (paused || media == null) return proxy.close()
        val image = InputImage.fromMediaImage(media, proxy.imageInfo.rotationDegrees)
        scanner.process(image)
            .addOnSuccessListener { list ->
                if (paused) return@addOnSuccessListener
                val b = list.firstOrNull { (it.rawValue ?: it.rawBytes?.toString(Charsets.UTF_8)) != null } ?: return@addOnSuccessListener
                val value = b.rawValue ?: b.rawBytes!!.toString(Charsets.UTF_8)
                val f = Decoder.format(b.format)
                if (f.linear && lastLinear != value) {
                    lastLinear = value
                    return@addOnSuccessListener
                }
                lastLinear = null
                paused = true
                onCode(value, f)
            }
            .addOnCompleteListener { proxy.close() }
    }
}
