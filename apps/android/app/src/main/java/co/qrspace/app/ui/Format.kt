package co.qrspace.app.ui

import android.icu.text.RelativeDateTimeFormatter
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
        n >= 1024L * 1024 - 512 -> nf.format(n / 1024.0 / 1024) + " MB"
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

/** A price inside a sentence that already has "$": 1 → "1", 2.5 → "2.5". */
fun fmtNum(v: Double): String = if (v % 1.0 == 0.0) v.toLong().toString() else java.math.BigDecimal.valueOf(v).stripTrailingZeros().toPlainString()

/** Days until "2026-10-21" (negative — overdue), like daysLeft on the site. */
fun daysLeft(due: String): Long =
    runCatching { java.time.temporal.ChronoUnit.DAYS.between(java.time.LocalDate.now(), java.time.LocalDate.parse(due)) }.getOrDefault(0)

/** "today", "tomorrow", "in 3 days", "2 days ago" — the phone's language. */
fun fmtDays(days: Long): String {
    val f = RelativeDateTimeFormatter.getInstance()
    val u = RelativeDateTimeFormatter.AbsoluteUnit.DAY
    return when {
        days == 0L -> f.format(RelativeDateTimeFormatter.Direction.THIS, u)
        days == 1L -> f.format(RelativeDateTimeFormatter.Direction.NEXT, u)
        days == -1L -> f.format(RelativeDateTimeFormatter.Direction.LAST, u)
        days > 0 -> f.format(days.toDouble(), RelativeDateTimeFormatter.Direction.NEXT, RelativeDateTimeFormatter.RelativeUnit.DAYS)
        else -> f.format(-days.toDouble(), RelativeDateTimeFormatter.Direction.LAST, RelativeDateTimeFormatter.RelativeUnit.DAYS)
    }
}

/** "21 Oct 2026" from "2026-10-21". */
fun fmtDay(ymd: String): String =
    runCatching { java.time.LocalDate.parse(ymd).format(java.time.format.DateTimeFormatter.ofLocalizedDate(java.time.format.FormatStyle.MEDIUM)) }.getOrDefault(ymd)
