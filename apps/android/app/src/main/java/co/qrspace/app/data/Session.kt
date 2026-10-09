package co.qrspace.app.data

import android.content.Context
import co.qrspace.app.BuildConfig
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import java.util.Locale

/**
 * Push notifications: the phone's token goes to POST /api/devices after sign-in and is removed (DELETE) on sign-out.
 * TODO(FCM): needs a Firebase project — add google-services.json, the firebase-messaging dependency and a
 *  FirebaseMessagingService, turn on PUSH_ENABLED (app/build.gradle.kts), and return
 *  FirebaseMessaging.getInstance().token.await() from [token].
 */
class Push(context: Context) {
    private val prefs = context.getSharedPreferences("push", Context.MODE_PRIVATE)

    private fun token(): String? = if (BuildConfig.PUSH_ENABLED) null /* FCM token here */ else null

    suspend fun register(api: Api) {
        val t = token() ?: return
        runCatching { api.registerDevice(t) }.onSuccess { prefs.edit().putString("registered", t).apply() }
    }

    suspend fun unregister(api: Api) {
        val t = prefs.getString("registered", null) ?: return
        runCatching { api.unregisterDevice(t) }
        prefs.edit().remove("registered").apply()
    }
}

/** Who is signed in (GET /api/me) and the public names the server shares with us. */
class Session(private val api: Api, private val push: Push) {
    private val _me = MutableStateFlow<MeResponse?>(null)
    val me: StateFlow<MeResponse?> = _me
    private val _error = MutableStateFlow(false)
    val error: StateFlow<Boolean> = _error

    /** Bumped on sign-in/out and after changes, so screens reload their data. */
    private val _epoch = MutableStateFlow(0)
    val epoch: StateFlow<Int> = _epoch

    suspend fun refresh() {
        runCatching { api.me() }
            .onSuccess { _me.value = it; _error.value = false }
            .onFailure { _error.value = true }
    }

    /** Something changed on the server (a new code, an edit) — lists reload. */
    fun changed() {
        _epoch.value++
    }

    suspend fun signIn(personId: String) {
        api.demoLogin(personId)
        signedIn()
    }

    /** Back from the Custom Tab: qrspace://auth?token=… */
    suspend fun signInWithToken(token: String) {
        api.exchangeToken(token)
        signedIn()
    }

    private suspend fun signedIn() {
        refresh()
        _epoch.value++
        push.register(api)
    }

    /**
     * Delete the account (stores require it in-app): the push device goes first (needs the session), then
     * DELETE /api/profile; on success — signed out locally, [clearCaches] drops cached pictures. Failed → device back.
     */
    suspend fun deleteAccount(clearCaches: () -> Unit) {
        push.unregister(api)
        try {
            api.deleteAccount()
        } catch (e: Exception) {
            push.register(api)
            throw e
        }
        clearCaches()
        refresh()
        _epoch.value++
    }

    suspend fun signOut() {
        push.unregister(api)
        api.logout()
        refresh()
        _epoch.value++
    }

    /** Debug builds: another server (each keeps its own cookies). */
    suspend fun switchServer(url: String) {
        api.setBase(url)
        _me.value = null
        refresh()
        _epoch.value++
    }

    fun name(id: String?): String? {
        if (id.isNullOrEmpty()) return null
        return _me.value?.people?.firstOrNull { it.id == id }?.localName(lang()) ?: id
    }

    fun person(id: String?): Person? = _me.value?.people?.firstOrNull { it.id == id }

    companion object {
        /** Site language for names (hy/ru/en…); unknown → en. */
        fun lang(): String = Locale.getDefault().language.let { if (it in setOf("hy", "ru", "en", "es", "pt", "fr", "de")) it else "en" }
    }
}
