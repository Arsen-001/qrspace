package co.qrspace.app.data

import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import java.util.Locale

/** Who is signed in (GET /api/me) and the public names the server shares with us. */
class Session(private val api: Api) {
    private val _me = MutableStateFlow<MeResponse?>(null)
    val me: StateFlow<MeResponse?> = _me
    private val _error = MutableStateFlow(false)
    val error: StateFlow<Boolean> = _error

    /** Bumped on sign-in/out so screens reload their data. */
    private val _epoch = MutableStateFlow(0)
    val epoch: StateFlow<Int> = _epoch

    suspend fun refresh() {
        runCatching { api.me() }
            .onSuccess { _me.value = it; _error.value = false }
            .onFailure { _error.value = true }
    }

    suspend fun signIn(personId: String) {
        api.demoLogin(personId)
        refresh()
        _epoch.value++
    }

    suspend fun signOut() {
        api.logout()
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
