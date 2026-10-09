package co.qrspace.app.scan

import android.app.SearchManager
import android.content.ActivityNotFoundException
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.net.wifi.WifiManager
import android.net.wifi.WifiNetworkSuggestion
import android.os.Build
import android.provider.CalendarContract
import android.provider.ContactsContract
import android.provider.Settings
import android.widget.Toast
import co.qrspace.app.R
import java.text.SimpleDateFormat
import java.util.Locale

/** Intents for scan results: open, copy, share, call, join Wi-Fi… Every launch is guarded (no app → no crash). */
object Actions {
    private fun start(ctx: Context, i: Intent): Boolean = try {
        ctx.startActivity(i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)); true
    } catch (_: ActivityNotFoundException) {
        false
    } catch (_: SecurityException) {
        false
    }

    fun open(ctx: Context, url: String) {
        start(ctx, Intent(Intent.ACTION_VIEW, Uri.parse(url)).addCategory(Intent.CATEGORY_BROWSABLE))
    }

    fun copy(ctx: Context, text: String, sensitive: Boolean = false) {
        val cm = ctx.getSystemService(ClipboardManager::class.java)
        val clip = ClipData.newPlainText("QR Space", text)
        if (sensitive && Build.VERSION.SDK_INT >= 33) {
            clip.description.extras = android.os.PersistableBundle().apply { putBoolean("android.content.extra.IS_SENSITIVE", true) }
        }
        cm.setPrimaryClip(clip)
        // Android 13+ shows its own confirmation.
        if (Build.VERSION.SDK_INT < 33) Toast.makeText(ctx, R.string.copied, Toast.LENGTH_SHORT).show()
    }

    fun share(ctx: Context, text: String) {
        val send = Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_TEXT, text)
        start(ctx, Intent.createChooser(send, null))
    }

    fun dial(ctx: Context, number: String) {
        start(ctx, Intent(Intent.ACTION_DIAL, Uri.parse("tel:" + Uri.encode(number))))
    }

    fun sms(ctx: Context, number: String, body: String) {
        start(ctx, Intent(Intent.ACTION_SENDTO, Uri.parse("smsto:" + Uri.encode(number))).putExtra("sms_body", body))
    }

    fun email(ctx: Context, to: String, subject: String, body: String) {
        val i = Intent(Intent.ACTION_SENDTO, Uri.parse("mailto:")).putExtra(Intent.EXTRA_EMAIL, arrayOf(to))
        if (subject.isNotEmpty()) i.putExtra(Intent.EXTRA_SUBJECT, subject)
        if (body.isNotEmpty()) i.putExtra(Intent.EXTRA_TEXT, body)
        start(ctx, i)
    }

    fun map(ctx: Context, lat: Double?, lon: Double?, query: String) {
        val uri = if (lat != null && lon != null) {
            "geo:$lat,$lon?q=" + Uri.encode(if (query.isNotEmpty()) query else "$lat,$lon")
        } else {
            "geo:0,0?q=" + Uri.encode(query)
        }
        if (!start(ctx, Intent(Intent.ACTION_VIEW, Uri.parse(uri)))) {
            open(ctx, "https://www.google.com/maps/search/?api=1&query=" + Uri.encode(if (lat != null) "$lat,$lon" else query))
        }
    }

    fun saveContact(ctx: Context, c: Scan.Contact) {
        val i = Intent(Intent.ACTION_INSERT, ContactsContract.Contacts.CONTENT_URI)
            .putExtra(ContactsContract.Intents.Insert.NAME, c.name)
        c.phones.firstOrNull()?.let { i.putExtra(ContactsContract.Intents.Insert.PHONE, it) }
        c.phones.getOrNull(1)?.let { i.putExtra(ContactsContract.Intents.Insert.SECONDARY_PHONE, it) }
        c.emails.firstOrNull()?.let { i.putExtra(ContactsContract.Intents.Insert.EMAIL, it) }
        if (c.org.isNotEmpty()) i.putExtra(ContactsContract.Intents.Insert.COMPANY, c.org)
        start(ctx, i)
    }

    fun addEvent(ctx: Context, e: Scan.Event) {
        val i = Intent(Intent.ACTION_INSERT, CalendarContract.Events.CONTENT_URI)
            .putExtra(CalendarContract.Events.TITLE, e.title)
            .putExtra(CalendarContract.Events.EVENT_LOCATION, e.place)
        parseIcsDate(e.start)?.let { i.putExtra(CalendarContract.EXTRA_EVENT_BEGIN_TIME, it) }
        start(ctx, i)
    }

    private fun parseIcsDate(s: String): Long? {
        val v = s.trim()
        val fmt = when {
            v.endsWith("Z") -> SimpleDateFormat("yyyyMMdd'T'HHmmss'Z'", Locale.US).apply { timeZone = java.util.TimeZone.getTimeZone("UTC") }
            v.contains('T') -> SimpleDateFormat("yyyyMMdd'T'HHmmss", Locale.US)
            else -> SimpleDateFormat("yyyyMMdd", Locale.US)
        }
        return runCatching { fmt.parse(v)?.time }.getOrNull()
    }

    fun webSearch(ctx: Context, query: String) {
        if (!start(ctx, Intent(Intent.ACTION_WEB_SEARCH).putExtra(SearchManager.QUERY, query))) {
            open(ctx, "https://www.google.com/search?q=" + Uri.encode(query))
        }
    }

    fun appSettings(ctx: Context) {
        start(ctx, Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.fromParts("package", ctx.packageName, null)))
    }

    /**
     * Join a Wi-Fi network from a QR. Android 11+: the system "Save this network?" sheet. Android 10: a suggestion
     * (the phone connects when in range). Older: copy the password and open Wi-Fi settings.
     */
    fun joinWifi(ctx: Context, w: Scan.Wifi) {
        val sec = w.security.uppercase()
        if (Build.VERSION.SDK_INT >= 29 && sec != "WEP") {
            val b = WifiNetworkSuggestion.Builder().setSsid(w.ssid).setIsHiddenSsid(w.hidden)
            when {
                sec == "NOPASS" || w.password.isEmpty() -> Unit
                sec.contains("SAE") || sec == "WPA3" -> b.setWpa3Passphrase(w.password)
                else -> b.setWpa2Passphrase(w.password)
            }
            val suggestion = b.build()
            if (Build.VERSION.SDK_INT >= 30) {
                val i = Intent(Settings.ACTION_WIFI_ADD_NETWORKS)
                    .putParcelableArrayListExtra(Settings.EXTRA_WIFI_NETWORK_LIST, arrayListOf(suggestion))
                if (start(ctx, i)) return
            }
            val wm = ctx.applicationContext.getSystemService(WifiManager::class.java)
            val status = runCatching { wm.addNetworkSuggestions(listOf(suggestion)) }.getOrDefault(-1)
            if (status == WifiManager.STATUS_NETWORK_SUGGESTIONS_SUCCESS || status == WifiManager.STATUS_NETWORK_SUGGESTIONS_ERROR_ADD_DUPLICATE) {
                Toast.makeText(ctx, R.string.wifi_suggested, Toast.LENGTH_LONG).show()
                return
            }
        }
        if (w.password.isNotEmpty()) copy(ctx, w.password, sensitive = true)
        start(ctx, Intent(if (Build.VERSION.SDK_INT >= 29) Settings.Panel.ACTION_WIFI else Settings.ACTION_WIFI_SETTINGS))
    }
}
