package co.qrspace.app.ui

import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.PathFillType
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.graphics.vector.PathParser
import androidx.compose.ui.unit.dp

/** Our own line icons (24×24, 2px strokes, square-ish like the site), tinted by Icon(). */
object Glyphs {
    private fun icon(name: String, strokes: List<String> = emptyList(), fills: List<String> = emptyList()): ImageVector {
        val b = ImageVector.Builder(name, 24.dp, 24.dp, 24f, 24f)
        strokes.forEach {
            b.addPath(
                PathParser().parsePathString(it).toNodes(),
                stroke = SolidColor(Color.Black), strokeLineWidth = 2f, strokeLineCap = StrokeCap.Round, strokeLineJoin = StrokeJoin.Round,
            )
        }
        fills.forEach { b.addPath(PathParser().parsePathString(it).toNodes(), fill = SolidColor(Color.Black), pathFillType = PathFillType.EvenOdd) }
        return b.build()
    }

    val Qr = icon(
        "qr",
        fills = listOf(
            "M3,3h8v8H3z M5,5v4h4V5z", "M13,3h8v8h-8z M15,5v4h4V5z", "M3,13h8v8H3z M5,15v4h4v-4z",
            "M6,6h2v2H6z", "M16,6h2v2h-2z", "M6,16h2v2H6z",
            "M13,13h3v3h-3z", "M18,13h3v3h-3z", "M13,18h3v3h-3z", "M18,18h3v3h-3z",
        ),
    )
    val Codes = icon("codes", strokes = listOf("M4,4h6v6H4z", "M14,4h6v6h-6z", "M4,14h6v6H4z", "M14,14h6v6h-6z"))
    val Account = icon("account", strokes = listOf("M12,4a4,4 0 1 1 0,8a4,4 0 1 1 0,-8z", "M4,21c0,-4 3.6,-6 8,-6s8,2 8,6"))
    val Torch = icon("torch", strokes = listOf("M7,3h10v3l-2,4v11H9V10L7,6z", "M7,6h10", "M12,13v3"))
    val Gallery = icon("gallery", strokes = listOf("M3,5h18v14H3z", "M3,16l5,-5l4,4l3,-3l6,6"), fills = listOf("M15.5,7.5a1.5,1.5 0 1 1 0,3a1.5,1.5 0 1 1 0,-3z"))
    val History = icon("history", strokes = listOf("M4,12a8,8 0 1 0 2.4,-5.7", "M4,4v4h4", "M12,8v4l3,2"))
    val Wifi = icon("wifi", strokes = listOf("M2,9c5.5,-5 14.5,-5 20,0", "M5,12.5c4,-3.5 10,-3.5 14,0", "M8.5,16c2,-1.6 5,-1.6 7,0"), fills = listOf("M12,18.5a1.5,1.5 0 1 1 0,3a1.5,1.5 0 1 1 0,-3z"))
    val Barcode = icon("barcode", fills = listOf("M3,5h2v14H3z", "M7,5h1v14H7z", "M10,5h2v14h-2z", "M14,5h1v14h-1z", "M17,5h1v14h-1z", "M20,5h1v14h-1z"))
    val Link = icon("link", strokes = listOf("M10,14a4,4 0 0 0 5.7,0l3,-3a4,4 0 0 0 -5.7,-5.7l-1,1", "M14,10a4,4 0 0 0 -5.7,0l-3,3a4,4 0 0 0 5.7,5.7l1,-1"))
    val Text = icon("text", strokes = listOf("M4,6h16", "M4,11h16", "M4,16h10"))
    val Copy = icon("copy", strokes = listOf("M8,8h12v12H8z", "M16,8V4H4v12h4"))
    val Share = icon("share", strokes = listOf("M12,3v12", "M7,8l5,-5l5,5", "M5,13v8h14v-8"))
    val Open = icon("open", strokes = listOf("M14,4h6v6", "M20,4l-9,9", "M18,14v6H4V6h6"))
    val Phone = icon("phone", strokes = listOf("M5,3h4l2,5l-2.5,1.5a11,11 0 0 0 6,6L16,13l5,2v4a2,2 0 0 1 -2,2A16,16 0 0 1 3,5a2,2 0 0 1 2,-2"))
    val Mail = icon("mail", strokes = listOf("M3,5h18v14H3z", "M3,6l9,7l9,-7"))
    val Sms = icon("sms", strokes = listOf("M4,4h16v12H9l-5,4z"))
    val Pin = icon("pin", strokes = listOf("M12,21s-7,-6.5 -7,-12a7,7 0 0 1 14,0c0,5.5 -7,12 -7,12z", "M12,7a2,2 0 1 1 0,4a2,2 0 1 1 0,-4z"))
    val Person = Account
    val Search = icon("search", strokes = listOf("M11,4a7,7 0 1 1 0,14a7,7 0 1 1 0,-14z", "M16,16l5,5"))
    val Calendar = icon("calendar", strokes = listOf("M3,5h18v16H3z", "M3,10h18", "M8,3v4", "M16,3v4"))
    val Lock = icon("lock", strokes = listOf("M5,11h14v10H5z", "M8,11V7a4,4 0 0 1 8,0v4"))
    val Back = icon("back", strokes = listOf("M15,5l-7,7l7,7"))
    val Close = icon("close", strokes = listOf("M6,6l12,12", "M18,6L6,18"))
    val Trash = icon("trash", strokes = listOf("M4,7h16", "M9,7V4h6v3", "M6,7l1,14h10l1,-14"))
    val Chevron = icon("chevron", strokes = listOf("M9,5l7,7l-7,7"))
    val Bell = icon("bell", strokes = listOf("M6,17V11a6,6 0 0 1 12,0v6l2,2H4z", "M10,21h4"))
    val Exit = icon("exit", strokes = listOf("M10,4H4v16h6", "M14,8l4,4l-4,4", "M18,12H9"))
    val Play = icon("play", fills = listOf("M8,5l11,7l-11,7z"))
    val Plus = icon("plus", strokes = listOf("M12,5v14", "M5,12h14"))
    val Pencil = icon("pencil", strokes = listOf("M4,20h4L19,9l-4,-4L4,16z", "M13,7l4,4"))
    val Eye = icon("eye", strokes = listOf("M2,12s4,-7 10,-7s10,7 10,7s-4,7 -10,7s-10,-7 -10,-7z", "M12,9a3,3 0 1 1 0,6a3,3 0 1 1 0,-6z"))
    val Globe = icon("globe", strokes = listOf("M12,3a9,9 0 1 1 0,18a9,9 0 1 1 0,-18z", "M3,12h18", "M12,3a14,14 0 0 1 0,18", "M12,3a14,14 0 0 0 0,18"))
    val People = icon("people", strokes = listOf("M9,4.5a3.5,3.5 0 1 1 0,7a3.5,3.5 0 1 1 0,-7z", "M2.5,20a6.5,6.5 0 0 1 13,0", "M16,4.5a3.5,3.5 0 0 1 0,7", "M18,14.2a6.5,6.5 0 0 1 3.5,5.8"))
    val Card = icon("card", strokes = listOf("M4,3h15v18H4z", "M11.5,7.4a2.6,2.6 0 1 1 0,5.2a2.6,2.6 0 1 1 0,-5.2z", "M7.5,17a4,4 0 0 1 8,0", "M19,7h2", "M19,12h2"))
    val Check = icon("check", strokes = listOf("M5,12.5l4.5,4.5l9.5,-10"))
    val Camera = icon("camera", strokes = listOf("M4,7h3l2,-2.5h6L17,7h3v12H4z", "M12,9.5a3.5,3.5 0 1 1 0,7a3.5,3.5 0 1 1 0,-7z"))
    val Video = icon("video", strokes = listOf("M3,6.5h12v11H3z", "M15,10.5l6,-3.5v10l-6,-3.5"))
    val Send = icon("send", strokes = listOf("M21,3L3,10.5l7,2.5l2.5,7z", "M21,3L10,13"))
    val At = icon("at", strokes = listOf("M12,8a4,4 0 1 1 0,8a4,4 0 1 1 0,-8z", "M16,12v1.5a2.5,2.5 0 0 0 5,0V12a9,9 0 1 0 -3.5,7.1"))
    val Car = icon("car", strokes = listOf("M3,13l2,-6h14l2,6v5h-3v-2H6v2H3z", "M3,13h18", "M7,16h.01", "M17,16h.01"))
    val Key = icon("key", strokes = listOf("M7.5,10.5a3.5,3.5 0 1 1 0,7a3.5,3.5 0 1 1 0,-7z", "M11,14h10", "M18,14v3", "M15,14v2"))
    val Heart = icon("heart", strokes = listOf("M12,20s-8,-5 -8,-11a4.5,4.5 0 0 1 8,-2.5a4.5,4.5 0 0 1 8,2.5c0,6 -8,11 -8,11z"))
    val Book = icon("book", strokes = listOf("M4,5a2,2 0 0 1 2,-2h13v16H6a2,2 0 0 0 -2,2z", "M4,21V5", "M8,7h7"))

    /** Content type → icon (TypeIcon on the site). */
    fun type(t: String) = when (t) {
        "url" -> Link
        "text" -> Text
        "wifi" -> Wifi
        "phone", "viber" -> Phone
        "sms", "whatsapp" -> Sms
        "email" -> Mail
        "contact" -> Person
        "location" -> Pin
        "event" -> Calendar
        "telegram" -> Send
        else -> At
    }

    /** Code kind → icon (KindIcon on the site). */
    fun kind(k: String) = when (k) {
        "car" -> Car
        "lost", "item" -> Key
        "pet" -> Heart
        "link" -> Link
        else -> Book
    }

    fun visibility(v: String) = when (v) {
        "all" -> Globe
        "people" -> People
        "contacts" -> Card
        else -> Lock
    }
}
