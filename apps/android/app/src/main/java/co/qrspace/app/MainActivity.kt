package co.qrspace.app

import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.SystemBarStyle
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.NavHostController
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import co.qrspace.app.account.AccountScreen
import co.qrspace.app.codes.CodeDetailScreen
import co.qrspace.app.create.CreateScreen
import co.qrspace.app.edit.EditScreen
import co.qrspace.app.home.HomeScreen
import co.qrspace.app.scan.HistoryScreen
import co.qrspace.app.scan.Scan
import co.qrspace.app.scan.ScanParser
import co.qrspace.app.scan.ScannerScreen
import co.qrspace.app.ui.Bone
import co.qrspace.app.ui.Glyphs
import co.qrspace.app.ui.Lime
import co.qrspace.app.ui.Night
import co.qrspace.app.ui.QrTheme
import co.qrspace.app.ui.Type

class MainActivity : ComponentActivity() {
    /** Our link opened from outside (app link / share) → the code inside the app. */
    private val incoming = mutableStateOf<Scan.Ours?>(null)

    /** Back from the sign-in Custom Tab: qrspace://auth?token=… (one-time, 5 minutes). */
    private val authToken = mutableStateOf<String?>(null)

    override fun onCreate(savedInstanceState: Bundle?) {
        enableEdgeToEdge(statusBarStyle = SystemBarStyle.dark(android.graphics.Color.TRANSPARENT))
        super.onCreate(savedInstanceState)
        handle(intent)
        setContent {
            QrTheme {
                App(incoming.value, authToken.value, { incoming.value = null }, { authToken.value = null })
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        handle(intent)
    }

    private fun handle(i: Intent?) {
        val data = i?.data
        if (data?.scheme == "qrspace" && data.host == "auth") {
            data.getQueryParameter("token")?.takeIf { it.isNotBlank() }?.let { authToken.value = it }
            return
        }
        val url = i?.dataString ?: i?.getStringExtra(Intent.EXTRA_TEXT) ?: return
        ScanParser.ours(url.trim())?.let { incoming.value = it }
    }
}

private enum class Tab(val route: String, val label: Int, val icon: ImageVector) {
    Scan("scan", R.string.tab_scan, Glyphs.Qr),
    Home("home", R.string.nav_codes, Glyphs.Codes),
    Account("account", R.string.account_title, Glyphs.Account),
}

fun codeRoute(s: Scan.Ours, visit: Boolean) = "code?id=${s.id ?: ""}&short=${s.short ?: ""}&visit=$visit"

@Composable
private fun App(incoming: Scan.Ours?, token: String?, consumed: () -> Unit, tokenUsed: () -> Unit) {
    val nav = rememberNavController()
    val ctx = androidx.compose.ui.platform.LocalContext.current
    val session = ctx.app.session
    LaunchedEffect(Unit) { session.refresh() }
    // Signed in on the site in a Custom Tab → exchange the one-time code for our own session → home ("My QR codes").
    LaunchedEffect(token) {
        if (token == null) return@LaunchedEffect
        android.widget.Toast.makeText(ctx, R.string.signin_wait, android.widget.Toast.LENGTH_SHORT).show()
        runCatching { session.signInWithToken(token) }
            .onSuccess { nav.tab(Tab.Home) }
            .onFailure { android.widget.Toast.makeText(ctx, R.string.signin_failed, android.widget.Toast.LENGTH_LONG).show() }
        tokenUsed()
    }
    LaunchedEffect(incoming) {
        if (incoming != null) {
            nav.navigate(codeRoute(incoming, visit = true))
            consumed()
        }
    }
    val entry by nav.currentBackStackEntryAsState()
    val route = entry?.destination?.route
    // Status bar icons: light on the black stage (scanner, code, account), dark on light screens.
    val view = androidx.compose.ui.platform.LocalView.current
    val lightBg = !co.qrspace.app.ui.LocalQr.current.dark && (route == Tab.Home.route || route == "history" || route == "create")
    LaunchedEffect(lightBg) {
        (view.context as? android.app.Activity)?.window?.let { w ->
            androidx.core.view.WindowCompat.getInsetsController(w, view).isAppearanceLightStatusBars = lightBg
        }
    }

    Box(Modifier.fillMaxSize().background(Night)) {
        NavHost(nav, startDestination = Tab.Scan.route, modifier = Modifier.fillMaxSize()) {
            composable(Tab.Scan.route) {
                ScannerScreen(onOpenCode = { nav.navigate(codeRoute(it, visit = true)) }, onHistory = { nav.navigate("history") }, active = true)
            }
            composable(Tab.Home.route) {
                HomeScreen(
                    onCreate = { nav.navigate("create") },
                    onEdit = { nav.navigate("edit/$it") },
                    onView = { nav.navigate("code?id=$it&short=&visit=false") },
                    onSignIn = { nav.tab(Tab.Account) },
                )
            }
            composable(Tab.Account.route) { AccountScreen(onSignedIn = { nav.tab(Tab.Home) }) }
            composable("create") {
                CreateScreen(
                    onBack = { nav.popBackStack() },
                    onCreated = { id -> nav.navigate("edit/$id") { popUpTo("create") { inclusive = true } } },
                    onSignIn = { nav.tab(Tab.Account) },
                )
            }
            composable("edit/{id}", arguments = listOf(navArgument("id") { type = NavType.StringType })) { e ->
                EditScreen(
                    id = e.arguments?.getString("id").orEmpty(),
                    onBack = { if (!nav.popBackStack()) nav.tab(Tab.Home) },
                    onView = { nav.navigate("code?id=$it&short=&visit=false") },
                )
            }
            composable("history") {
                HistoryScreen(onBack = { nav.popBackStack() }, onOpenCode = { nav.navigate(codeRoute(it, visit = false)) })
            }
            composable(
                "code?id={id}&short={short}&visit={visit}",
                arguments = listOf(
                    navArgument("id") { type = NavType.StringType; defaultValue = "" },
                    navArgument("short") { type = NavType.StringType; defaultValue = "" },
                    navArgument("visit") { type = NavType.BoolType; defaultValue = false },
                ),
            ) { e ->
                val a = e.arguments
                CodeDetailScreen(
                    id = a?.getString("id")?.ifEmpty { null },
                    short = a?.getString("short")?.ifEmpty { null },
                    visit = a?.getBoolean("visit") ?: false,
                    onBack = { if (!nav.popBackStack()) nav.tab(Tab.Scan) },
                    onSignIn = { nav.tab(Tab.Account) },
                    onEdit = { nav.navigate("edit/$it") },
                )
            }
        }
        if (Tab.entries.any { it.route == route }) {
            BottomBar(route, Modifier.align(Alignment.BottomCenter)) { nav.tab(it) }
        }
    }
}

private fun NavHostController.tab(t: Tab) = navigate(t.route) {
    popUpTo(graph.findStartDestination().id) { saveState = true }
    launchSingleTop = true
    restoreState = true
}

/** Floating black pill with a lime selection — same on light and dark, like the site's stage blocks. */
@Composable
private fun BottomBar(route: String?, modifier: Modifier, onTab: (Tab) -> Unit) {
    Row(
        modifier
            .navigationBarsPadding()
            .padding(bottom = 14.dp)
            .clip(RoundedCornerShape(18.dp))
            .background(Night.copy(alpha = 0.94f))
            .border(1.dp, Bone.copy(alpha = 0.12f), RoundedCornerShape(18.dp))
            .padding(6.dp),
        horizontalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        Tab.entries.forEach { t ->
            val on = route == t.route
            Row(
                Modifier
                    .clip(RoundedCornerShape(13.dp))
                    .background(if (on) Lime else androidx.compose.ui.graphics.Color.Transparent)
                    .clickable(role = Role.Tab) { onTab(t) }
                    .semantics { selected = on }
                    .padding(horizontal = if (on) 16.dp else 14.dp, vertical = 12.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Icon(t.icon, contentDescription = if (on) null else stringResource(t.label), tint = if (on) Night else Bone.copy(alpha = 0.75f), modifier = Modifier.size(22.dp))
                if (on) {
                    Spacer(Modifier.width(8.dp))
                    Text(stringResource(t.label), style = Type.button, color = Night, maxLines = 1)
                }
            }
        }
    }
    Spacer(Modifier.height(0.dp))
}
