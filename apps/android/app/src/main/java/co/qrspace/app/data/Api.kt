package co.qrspace.app.data

import android.content.ContentResolver
import android.content.Context
import android.content.SharedPreferences
import android.net.Uri
import co.qrspace.app.BuildConfig
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put
import okhttp3.Cookie
import okhttp3.CookieJar
import okhttp3.HttpUrl
import okhttp3.HttpUrl.Companion.toHttpUrl
import okhttp3.HttpUrl.Companion.toHttpUrlOrNull
import okhttp3.MediaType
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.MultipartBody
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.Response
import okio.BufferedSink
import java.io.IOException
import java.util.concurrent.TimeUnit

/** HTTP error from our API (401 = not signed in, 404 = no such code, 413 = no room under the code); [error] — the JSON "error". */
class ApiException(val code: Int, val error: String? = null) : IOException("HTTP $code")

/**
 * Cookie jar persisted in SharedPreferences: the server session is the httpOnly `qr-session` cookie (a year long), the
 * same one the website uses. Kept per host, so a debug build can switch between qrspace.co and a local server.
 */
class PersistentCookieJar(context: Context) : CookieJar {
    private val prefs: SharedPreferences = context.getSharedPreferences("cookie-jar", Context.MODE_PRIVATE)
    private val cache = mutableMapOf<String, Cookie>()

    init {
        val now = System.currentTimeMillis()
        prefs.all.forEach { (k, v) ->
            val parts = (v as? String)?.split('\n', limit = 2)
            if (parts == null || parts.size != 2) return@forEach
            val c = parts[0].toHttpUrlOrNull()?.let { Cookie.parse(it, parts[1]) }
            if (c != null && c.expiresAt > now) cache[k] = c
        }
        // v1 kept production cookies by name only.
        val old = context.getSharedPreferences("cookies", Context.MODE_PRIVATE)
        if (old.all.isNotEmpty()) {
            val base = "https://qrspace.co".toHttpUrl()
            saveFromResponse(base, old.all.values.filterIsInstance<String>().mapNotNull { Cookie.parse(base, it) })
            old.edit().clear().apply()
        }
    }

    private fun key(c: Cookie) = "${c.domain}|${c.path}|${c.name}"

    @Synchronized
    override fun saveFromResponse(url: HttpUrl, cookies: List<Cookie>) {
        val edit = prefs.edit()
        for (c in cookies) {
            val k = key(c)
            if (c.expiresAt <= System.currentTimeMillis()) {
                cache.remove(k); edit.remove(k)
            } else {
                cache[k] = c
                // Session cookies (no expiry) are kept too, so the sign-in survives an app restart.
                edit.putString(k, "${url.scheme}://${url.host}:${url.port}/\n" + c.toString() + if (!c.persistent) "; Max-Age=31536000" else "")
            }
        }
        edit.apply()
    }

    @Synchronized
    override fun loadForRequest(url: HttpUrl): List<Cookie> = cache.values.filter { it.matches(url) }

    /** Sign-out: forget this server's cookies. */
    @Synchronized
    fun clear(host: String) {
        val edit = prefs.edit()
        val gone = cache.filter { (_, c) -> c.domain == host || host.endsWith(".${c.domain}") }.keys
        gone.forEach { cache.remove(it); edit.remove(it) }
        edit.apply()
    }
}

/** A file streamed from the phone (the video picker) with upload progress. */
class UriBody(
    private val resolver: ContentResolver,
    private val uri: Uri,
    private val type: MediaType?,
    private val length: Long,
    private val onProgress: (Int) -> Unit,
) : RequestBody() {
    override fun contentType() = type
    override fun contentLength() = length
    override fun writeTo(sink: BufferedSink) {
        val input = resolver.openInputStream(uri) ?: throw IOException("unreadable")
        input.use {
            val buf = ByteArray(64 * 1024)
            var sent = 0L
            var last = -1
            while (true) {
                val n = it.read(buf)
                if (n < 0) break
                sink.write(buf, 0, n)
                sent += n
                val pct = if (length > 0) (sent * 100 / length).toInt() else 0
                if (pct != last) { last = pct; onProgress(pct) }
            }
        }
    }
}

/** A photo or video to add under a code. */
sealed interface Attachment {
    val size: Long
    val mime: String
    val kind: String
    class Bytes(val bytes: ByteArray, override val mime: String, val name: String, override val kind: String) : Attachment { override val size = bytes.size.toLong() }
    class Stream(val uri: Uri, override val size: Long, override val mime: String, val name: String, override val kind: String) : Attachment
}

class Api(private val context: Context) {
    private val prefs = context.getSharedPreferences("server", Context.MODE_PRIVATE)

    /** Our server: production in release; a debug build defaults to the local web server and can be switched in Account. */
    @Volatile
    var base: String = (if (BuildConfig.DEBUG) prefs.getString("base", null) else null) ?: BuildConfig.API_BASE.trimEnd('/')
        private set

    /** Debug only: point the app at another server (cookies are per host, so each keeps its own sign-in). */
    fun setBase(url: String) {
        if (!BuildConfig.DEBUG) return
        base = url.trim().trimEnd('/')
        prefs.edit().putString("base", base).apply()
    }

    val host: String get() = base.toHttpUrlOrNull()?.host ?: base

    /** "qrspace.co" or "10.0.2.2:3720" — for "Sign in on …". */
    val siteName: String get() = base.toHttpUrlOrNull()?.let { if (it.port == 80 || it.port == 443) it.host else "${it.host}:${it.port}" } ?: base

    val cookies = PersistentCookieJar(context)
    val client: OkHttpClient = OkHttpClient.Builder()
        .cookieJar(cookies)
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .addInterceptor { chain ->
            chain.proceed(chain.request().newBuilder().header("User-Agent", "QRSpace-Android/${BuildConfig.VERSION_NAME}").build())
        }
        .build()

    /** Uploads (videos up to 1 GB on a slow network): long write/read timeouts. */
    private val uploadClient: OkHttpClient by lazy { client.newBuilder().writeTimeout(30, TimeUnit.MINUTES).readTimeout(5, TimeUnit.MINUTES).build() }

    /** Straight to file storage (another host): no cookie jar, no interceptors. */
    private val storageClient: OkHttpClient by lazy {
        OkHttpClient.Builder().connectTimeout(15, TimeUnit.SECONDS).writeTimeout(30, TimeUnit.MINUTES).readTimeout(5, TimeUnit.MINUTES).build()
    }

    val json = Json { ignoreUnknownKeys = true; explicitNulls = false; coerceInputValues = true }
    private val jsonType = "application/json".toMediaType()

    private fun fail(r: Response): Nothing {
        val err = runCatching { json.parseToJsonElement(r.body!!.string()).jsonObject["error"]?.jsonPrimitive?.content }.getOrNull()
        throw ApiException(r.code, err)
    }

    private suspend inline fun <reified T> call(req: Request, http: OkHttpClient = client): T = withContext(Dispatchers.IO) {
        http.newCall(req).execute().use { r ->
            if (!r.isSuccessful) fail(r)
            json.decodeFromString<T>(r.body!!.string())
        }
    }

    private fun url(path: String) = Request.Builder().url(base + path)
    private fun body(o: JsonObject) = o.toString().toRequestBody(jsonType)
    private suspend inline fun <reified T> get(path: String): T = call(url(path).build())
    private suspend inline fun <reified T> post(path: String, o: JsonObject): T = call(url(path).post(body(o)).build())
    private suspend inline fun <reified T> patch(path: String, o: JsonObject): T = call(url(path).patch(body(o)).build())
    private suspend inline fun <reified T> delete(path: String, o: JsonObject? = null): T = call(url(path).delete(o?.let { body(it) }).build())

    suspend fun me(): MeResponse = get("/api/me")

    /** Demo sign-in (only while the server's DEMO_LOGIN is on). */
    suspend fun demoLogin(personId: String) {
        post<JsonObject>("/api/me", buildJsonObject { put("personId", personId) })
    }

    /** Custom Tab sign-in: the one-time code from qrspace://auth?token=… → this app's own session cookie. */
    suspend fun exchangeToken(token: String): TokenResult = post("/api/auth/token", buildJsonObject { put("token", token) })

    /** Where the Custom Tab goes to sign in; the server ends at /app/callback → qrspace://auth?token=… */
    fun signInUrl(provider: String?): String = when (provider) {
        "google", "apple" -> "$base/api/auth/$provider?next=/app/callback"
        else -> "$base/login?next=/app/callback"
    }

    /** Delete the account and everything in it (403 "demo" for demo people). The server drops the session too. */
    suspend fun deleteAccount() {
        withContext(Dispatchers.IO) {
            client.newCall(url("/api/profile").delete().build()).execute().use { r -> if (!r.isSuccessful) fail(r) }
        }
        cookies.clear(host)
        synchronized(previews) { previews.clear() }
    }

    suspend fun logout() {
        runCatching { post<JsonObject>("/api/me", buildJsonObject { put("personId", JsonNull) }) }
        cookies.clear(host)
    }

    suspend fun codes(): CodeList = get("/api/codes")

    /** visit = true when opened from a scan: the server counts it as a scan (not for the owner). */
    suspend fun code(id: String, visit: Boolean = false): CodeView = get("/api/codes/${enc(id)}" + if (visit) "?visit=1" else "")

    suspend fun profile(): Profile = get("/api/profile")

    suspend fun notifications(): Notices = get("/api/notifications")

    /** Short link (/K/ABC123) → code id. The /verify endpoint resolves short numbers without following redirects. */
    suspend fun resolve(url: String): VerifyResult = get("/api/verify?u=${enc(url)}")

    // ── Creating and editing ────────────────────────────────────────────────────────────────────────────────────

    /** A memory code (memory, car, keys, pet): free to create, like on the site; paid when its picture is taken. */
    suspend fun createCode(title: String, kind: String, look: Look): CodeView =
        post("/api/codes", buildJsonObject { put("title", title); put("kind", kind); put("style", look.toJson()) })

    private fun content(type: String, fields: Map<String, String>) =
        buildJsonObject { put("type", type); put("fields", JsonObject(fields.mapValues { JsonPrimitive(it.value) })) }

    /**
     * A generator code (link, Wi‑Fi, contact…) — with the key paid in POST /api/purchases (one purchase = one code; no
     * unused purchase → 402 "pay"). Same content and look → the same code, no new payment. [title] — the name in My codes.
     */
    suspend fun quick(type: String, fields: Map<String, String>, look: Look, key: String, title: String?): QuickResult =
        post("/api/codes/quick", buildJsonObject {
            put("content", content(type, fields)); put("style", look.toJson()); put("key", key)
            if (!title.isNullOrBlank()) put("title", title)
        })

    suspend fun quote(key: String, tier: String): Quote = get("/api/purchases?key=${enc(key)}&tier=$tier")

    /** Demo payment — no money is charged. */
    suspend fun pay(key: String, tier: String): PayResult = post("/api/purchases", buildJsonObject { put("key", key); put("tier", tier) })

    suspend fun rename(id: String, title: String): CodeView = patch("/api/codes/${enc(id)}", buildJsonObject { put("title", title) })
    suspend fun setVisibility(id: String, v: String): CodeView = patch("/api/codes/${enc(id)}", buildJsonObject { put("visibility", v) })
    suspend fun setContent(id: String, type: String, fields: Map<String, String>): CodeView =
        patch("/api/codes/${enc(id)}", buildJsonObject { put("content", content(type, fields)) })

    suspend fun doneTask(id: String, taskId: String): CodeView = patch("/api/codes/${enc(id)}/tasks/${enc(taskId)}", buildJsonObject { put("done", true) })

    /** Space under the code for a month (demo payment) or "free" — back to 1 MB. */
    suspend fun buyStorage(id: String, plan: String): CodeView = post("/api/codes/${enc(id)}/storage", buildJsonObject { put("plan", plan) })

    /**
     * Permission for one big video: 413 if it doesn't fit (the server measures with the real size), 400 if not a video;
     * {direct:false} on a server without file storage (then the form takes the file).
     */
    suspend fun uploadUrl(id: String, size: Long, type: String): UploadUrl =
        post("/api/codes/${enc(id)}/upload-url", buildJsonObject { put("size", size); put("type", type) })

    /** The raw bytes straight to storage, with exactly the headers the server gave (no cookies, no Content-Type). */
    suspend fun putFile(u: UploadUrl, uri: Uri, size: Long, onProgress: (Int) -> Unit) = withContext(Dispatchers.IO) {
        val body = UriBody(context.contentResolver, uri, null, size, onProgress)
        val req = Request.Builder().url(u.url).method(u.method.ifEmpty { "PUT" }, body).apply { u.headers.forEach { (k, v) -> header(k, v) } }.build()
        storageClient.newCall(req).execute().use { r -> if (!r.isSuccessful) throw ApiException(r.code, "storage-put") }
    }

    /** After the PUT: the entry itself; the server measures the stored file again. */
    suspend fun addUploaded(id: String, text: String, name: String): CodeView {
        val form = MultipartBody.Builder().setType(MultipartBody.FORM).addFormDataPart("text", text).addFormDataPart("uploaded", name)
        return call(url("/api/codes/${enc(id)}/blocks").post(form.build()).build())
    }

    /** Add to memory: text, or a photo/video with a caption (multipart; the server measures the file itself). */
    suspend fun addBlock(id: String, text: String, file: Attachment?, onProgress: (Int) -> Unit = {}): CodeView {
        val form = MultipartBody.Builder().setType(MultipartBody.FORM).addFormDataPart("text", text)
        when (file) {
            is Attachment.Bytes -> form.addFormDataPart("file", file.name, file.bytes.toRequestBody(file.mime.toMediaTypeOrNull()))
            is Attachment.Stream -> form.addFormDataPart("file", file.name, UriBody(context.contentResolver, file.uri, file.mime.toMediaTypeOrNull(), file.size, onProgress))
            null -> {}
        }
        return call(url("/api/codes/${enc(id)}/blocks").post(form.build()).build(), uploadClient)
    }

    suspend fun editBlock(id: String, blockId: String, text: String): CodeView = patch("/api/codes/${enc(id)}/blocks/${enc(blockId)}", buildJsonObject { put("text", text) })
    suspend fun removeBlock(id: String, blockId: String): CodeView = delete("/api/codes/${enc(id)}/blocks/${enc(blockId)}")

    // ── Pictures ────────────────────────────────────────────────────────────────────────────────────────────────

    /**
     * The code's exact drawing, rendered by the server like the site (logos and photos inside). The `v` part changes
     * when the look, the link or the paid state changes (unpaid codes come at most 256 px; paid — full size), so the
     * image cache never shows an old or a thumbnail-size drawing. Coil's disk cache keys by URL and ignores ETag.
     */
    fun imageUrl(c: CodeView, size: Int = IMAGE_SIZE): String {
        val paid = c.styleLocked || c.edition != null || c.content != null
        val v = Integer.toHexString(listOf(c.style, c.compact, c.short, base, paid).hashCode())
        return "$base/api/codes/${enc(c.id)}/image?format=png&size=$size&v=$v"
    }

    private val previews = object : LinkedHashMap<String, ByteArray>(32, 0.75f, true) {
        override fun removeEldestEntry(eldest: MutableMap.MutableEntry<String, ByteArray>?) = size > 40
    }

    /** A look before the code exists (POST /api/preview) — PNG bytes, or SVG on a server without sharp. Cached in memory. */
    suspend fun preview(look: Look, size: Int): ByteArray {
        val req = buildJsonObject { put("style", look.toJson()); put("format", "png"); put("size", size) }.toString()
        synchronized(previews) { previews[req] }?.let { return it }
        return withContext(Dispatchers.IO) {
            client.newCall(url("/api/preview").post(req.toRequestBody(jsonType)).build()).execute().use { r ->
                if (!r.isSuccessful) fail(r)
                r.body!!.bytes()
            }
        }.also { synchronized(previews) { previews[req] = it } }
    }

    /** The drawing itself (for sharing). */
    suspend fun imageBytes(c: CodeView, size: Int = 1024): Pair<ByteArray, String> = withContext(Dispatchers.IO) {
        client.newCall(Request.Builder().url(imageUrl(c, size)).build()).execute().use { r ->
            if (!r.isSuccessful) fail(r)
            r.body!!.bytes() to (r.header("content-type") ?: "image/png")
        }
    }

    // ── Push ────────────────────────────────────────────────────────────────────────────────────────────────────

    suspend fun registerDevice(token: String) {
        post<JsonObject>("/api/devices", buildJsonObject { put("token", token); put("platform", "android") })
    }

    suspend fun unregisterDevice(token: String) {
        delete<JsonObject>("/api/devices", buildJsonObject { put("token", token) })
    }

    fun mediaUrl(name: String) = "$base/api/media/$name"

    private fun enc(s: String) = java.net.URLEncoder.encode(s, "UTF-8")

    companion object {
        const val IMAGE_SIZE = 768
    }
}
