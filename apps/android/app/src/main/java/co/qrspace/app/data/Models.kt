package co.qrspace.app.data

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonElement

// Mirrors of the web app's JSON (src/lib/codes.ts, src/app/api/**). Unknown fields are ignored, missing ones defaulted,
// so server additions don't break old app versions.

@Serializable
data class Person(
    val id: String,
    val name: Map<String, String> = emptyMap(),
    val color: String = "#334155",
    val demo: Map<String, String> = emptyMap(),
    val designer: Boolean = false,
    val admin: Boolean = false,
) {
    fun localName(lang: String) = name[lang] ?: name["en"] ?: name.values.firstOrNull() ?: id
    fun localDemo(lang: String) = demo[lang] ?: demo["en"] ?: ""
}

@Serializable
data class Providers(val google: Boolean = false, val apple: Boolean = false)

@Serializable
data class MeResponse(
    val me: String? = null,
    val base: String = "https://qrspace.co",
    val people: List<Person> = emptyList(),
    val demo: Boolean = false,
    val providers: Providers = Providers(),
    val admin: Boolean = false,
)

/** A saved code's look (src/lib/qr/style.ts SavedStyle). Pictures and logos stay as raw JSON — only for cache keys. */
@Serializable
data class SavedStyle(
    val fg: String = "#0b0b0c",
    val bg: String = "#ffffff",
    val dot: String = "square",
    val eye: String = "square",
    val eyeBall: String = "auto",
    val eyeColor: String? = null,
    val eyeBallColor: String? = null,
    val gradient: JsonElement? = null,
    val rotate: Int = 0,
    val effect: String = "none",
    val texture: String? = null,
    val logo: JsonElement? = null,
    val eyeIcon: JsonElement? = null,
    val picture: JsonElement? = null,
    val caption: String? = null,
    val captionPhone: String? = null,
)

@Serializable
data class Block(
    val id: String,
    val kind: String,
    val text: String = "",
    val media: String? = null,
    val author: String = "",
    val at: String = "",
)

@Serializable
data class Content(val type: String, val fields: Map<String, String> = emptyMap())

@Serializable
data class StorageInfo(val used: Long = 0, val quota: Long = 0, val plan: String? = null, val until: String? = null)

@Serializable
data class Edition(val design: String, val no: Int, val of: Int? = null)

@Serializable
data class ScanStats(val days: List<Int> = emptyList(), val total: Int = 0, val week: Int = 0, val people: Int = 0)

@Serializable
data class TaskDone(val by: String = "", val at: String = "")

/** A reminder on a code: what and when; every — repeat (after "Done" the date moves). */
@Serializable
data class Task(val id: String, val text: String = "", val due: String = "", val every: String = "none", val done: List<TaskDone> = emptyList())

@Serializable
data class CodeMessage(val id: String, val read: Boolean = true)

@Serializable
data class AccessRequest(val personId: String, val at: String = "")

@Serializable
data class CodeView(
    val id: String,
    val kind: String = "memory",
    val owner: String? = null,
    val title: String? = null,
    val short: String = "",
    val compact: Boolean = false,
    val access: String = "closed",
    val visibility: String = "me",
    val blocks: List<Block>? = null,
    val requested: Boolean = false,
    val style: SavedStyle? = null,
    val content: Content? = null,
    val blocked: Boolean = false,
    val lost: Boolean = false,
    val reward: String = "",
    val edition: Edition? = null,
    val storage: StorageInfo? = null,
    val stats: ScanStats? = null,
    val styleLocked: Boolean = false,
    val publicAdd: Boolean = false,
    val tasks: List<Task>? = null,
    val messages: List<CodeMessage>? = null,
    val requests: List<AccessRequest>? = null,
) {
    /** Unread messages and access requests — a badge on the dashboard card. */
    val unread: Int get() = (messages?.count { !it.read } ?: 0) + (requests?.size ?: 0)
}

@Serializable
data class CodeList(
    val base: String = "https://qrspace.co",
    val mine: List<CodeView> = emptyList(),
    val shared: List<CodeView> = emptyList(),
)

@Serializable
data class Purchase(
    val key: String = "",
    val tier: String = "simple",
    val price: Double = 0.0,
    val free: Boolean = false,
    val at: String = "",
    val pack: String? = null,
)

@Serializable
data class Pack(val id: String, val plan: String = "", val codes: Int = 0, val used: Int = 0, val bytes: Long = 0, val price: Double = 0.0, val at: String = "")

@Serializable
data class ProfileStats(
    val scans30: Int = 0,
    val scans: Int = 0,
    val used: Long = 0,
    val quota: Long = 0,
    val paidSpace: Int = 0,
    val packsLeft: Int = 0,
    val spent: Double = 0.0,
    val earned: Double = 0.0,
)

@Serializable
data class Profile(
    val id: String,
    val name: String = "",
    val email: String = "",
    val provider: String = "demo",
    val codes: Int = 0,
    val stats: ProfileStats = ProfileStats(),
    val purchases: List<Purchase> = emptyList(),
    val packs: List<Pack> = emptyList(),
)

@Serializable
data class Notice(val id: String, val kind: String, val params: Map<String, String> = emptyMap(), val link: String = "", val at: String = "", val read: Boolean = false)

@Serializable
data class Notices(val items: List<Notice> = emptyList(), val unread: Int = 0, val due: Int = 0)

@Serializable
data class VerifyResult(val result: String, val id: String? = null, val kind: String? = null, val title: String? = null, val host: String? = null)

@Serializable
data class LoginBody(val personId: String?)

/** What downloading (here: creating) a code costs this person (GET /api/purchases). */
@Serializable
data class PackQuote(val left: Int = 0, val bytes: Long = 0)

@Serializable
data class Quote(val paid: Boolean = false, val price: Double = 0.0, val free: Boolean = false, val pack: PackQuote? = null)

@Serializable
data class PayResult(val ok: Boolean = false, val price: Double = 0.0)

@Serializable
data class QuickResult(val id: String, val link: String = "")

/** POST /api/codes/{id}/upload-url: locally {direct:false} (send the form); in production a one-file, exact-size PUT. */
@Serializable
data class UploadUrl(
    val direct: Boolean = false,
    val name: String = "",
    val url: String = "",
    val method: String = "PUT",
    val headers: Map<String, String> = emptyMap(),
)

@Serializable
data class TokenResult(val me: String? = null)
