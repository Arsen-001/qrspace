package co.qrspace.app.data

import android.content.Context
import android.content.SharedPreferences
import co.qrspace.app.BuildConfig
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
import okhttp3.Cookie
import okhttp3.CookieJar
import okhttp3.HttpUrl
import okhttp3.HttpUrl.Companion.toHttpUrl
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.io.IOException
import java.util.concurrent.TimeUnit

/** HTTP error from our API (401 = not signed in, 404 = no such code). */
class ApiException(val code: Int) : IOException("HTTP $code")

/**
 * Cookie jar persisted in SharedPreferences: the server session is the httpOnly `qr-session` cookie (a year long),
 * the same one the website uses. Only cookies for our host are kept.
 */
class PersistentCookieJar(context: Context) : CookieJar {
    private val prefs: SharedPreferences = context.getSharedPreferences("cookies", Context.MODE_PRIVATE)
    private val cache = mutableMapOf<String, Cookie>()

    init {
        val base = BuildConfig.API_BASE.toHttpUrl()
        prefs.all.values.filterIsInstance<String>().forEach { line ->
            Cookie.parse(base, line)?.let { if (it.expiresAt > System.currentTimeMillis()) cache[it.name] = it }
        }
    }

    @Synchronized
    override fun saveFromResponse(url: HttpUrl, cookies: List<Cookie>) {
        val edit = prefs.edit()
        for (c in cookies) {
            if (c.expiresAt <= System.currentTimeMillis()) {
                cache.remove(c.name); edit.remove(c.name)
            } else {
                cache[c.name] = c
                // Session cookies (no expiry) are kept too, so the sign-in survives an app restart.
                edit.putString(c.name, c.toString() + if (!c.persistent) "; Max-Age=31536000" else "")
            }
        }
        edit.apply()
    }

    @Synchronized
    override fun loadForRequest(url: HttpUrl): List<Cookie> = cache.values.filter { it.matches(url) }

    @Synchronized
    fun clear() {
        cache.clear(); prefs.edit().clear().apply()
    }
}

class Api(context: Context) {
    val base: String = BuildConfig.API_BASE.trimEnd('/')
    val cookies = PersistentCookieJar(context)
    val client: OkHttpClient = OkHttpClient.Builder()
        .cookieJar(cookies)
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .addInterceptor { chain ->
            chain.proceed(chain.request().newBuilder().header("User-Agent", "QRSpace-Android/${BuildConfig.VERSION_NAME}").build())
        }
        .build()

    val json = Json { ignoreUnknownKeys = true; explicitNulls = false; coerceInputValues = true }
    private val jsonType = "application/json".toMediaType()

    private suspend inline fun <reified T> get(path: String): T = withContext(Dispatchers.IO) {
        client.newCall(Request.Builder().url(base + path).build()).execute().use { r ->
            if (!r.isSuccessful) throw ApiException(r.code)
            json.decodeFromString<T>(r.body!!.string())
        }
    }

    private suspend inline fun <reified B, reified T> post(path: String, body: B): T = withContext(Dispatchers.IO) {
        val req = Request.Builder().url(base + path).post(json.encodeToString(body).toRequestBody(jsonType)).build()
        client.newCall(req).execute().use { r ->
            if (!r.isSuccessful) throw ApiException(r.code)
            json.decodeFromString<T>(r.body!!.string())
        }
    }

    suspend fun me(): MeResponse = get("/api/me")

    /** Demo sign-in (only while the server's DEMO_LOGIN is on). TODO: Google/Apple via Custom Tabs + app link. */
    suspend fun demoLogin(personId: String) {
        post<LoginBody, Map<String, String?>>("/api/me", LoginBody(personId))
    }

    suspend fun logout() {
        runCatching { post<LoginBody, Map<String, String?>>("/api/me", LoginBody(null)) }
        cookies.clear()
    }

    suspend fun codes(): CodeList = get("/api/codes")

    /** visit = true when opened from a scan: the server counts it as a scan (not for the owner). */
    suspend fun code(id: String, visit: Boolean = false): CodeView = get("/api/codes/${enc(id)}" + if (visit) "?visit=1" else "")

    suspend fun profile(): Profile = get("/api/profile")

    suspend fun notifications(): Notices = get("/api/notifications")

    /** Short link (/K/ABC123) → code id. The /verify endpoint resolves short numbers without following redirects. */
    suspend fun resolve(url: String): VerifyResult = get("/api/verify?u=${enc(url)}")

    fun mediaUrl(name: String) = "$base/api/media/$name"

    private fun enc(s: String) = java.net.URLEncoder.encode(s, "UTF-8")
}
