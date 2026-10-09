package co.qrspace.app.ui

import androidx.annotation.StringRes
import co.qrspace.app.R
import java.text.DateFormat
import java.text.NumberFormat
import java.time.Instant
import java.util.Date
import java.util.Locale

/** «0,4 MB», «120 KB» — like fmtBytes on the site. */
fun fmtBytes(n: Long): String {
    val nf = NumberFormat.getNumberInstance().apply { maximumFractionDigits = 1 }
    return when {
        n >= 1024L * 1024 * 1024 -> nf.format(n / 1024.0 / 1024 / 1024) + " GB"
        n >= 1024L * 1024 -> nf.format(n / 1024.0 / 1024) + " MB"
        n == 0L -> "0 KB"
        else -> "${maxOf(1, Math.round(n / 1024.0))} KB"
    }
}

fun fmtUsd(v: Double): String = NumberFormat.getCurrencyInstance(Locale.US).format(v).replace(".00", "")

fun fmtDate(iso: String): String = runCatching { DateFormat.getDateInstance(DateFormat.MEDIUM).format(Date.from(Instant.parse(iso))) }.getOrDefault(iso.take(10))

@StringRes
fun kindLabel(kind: String): Int = when (kind) {
    "car" -> R.string.tpl_car
    "lost" -> R.string.tpl_lost
    "pet" -> R.string.tpl_pet
    "item" -> R.string.tpl_item
    "link" -> R.string.tpl_link
    else -> R.string.tpl_memory
}
