# QR Space — Android app

Native Android app for QR Space (https://qrspace.co): our own scanner for QR codes and barcodes, the "My QR codes"
home with a switch on every code and its scans, creating codes (content or memory) with the site's own drawing and the
price gate, editing a code and its memory (with the "room" offer for big files), sign-in through the site, the account.
Kotlin + Jetpack Compose (Material 3 under our own look), minSdk 26, target/compile SDK 36, applicationId
`co.qrspace.app`. Talks to the same server as the website (`/api`, cookie session).

## Build and run

Needs JDK 17+ (we use Homebrew `openjdk@21`) and the Android SDK (`~/Library/Android/sdk`, platform 36).

```bash
cd apps/android
echo "sdk.dir=$HOME/Library/Android/sdk" > local.properties        # once
export JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home
./gradlew assembleDebug          # → app/build/outputs/apk/debug/app-debug.apk
./gradlew testDebugUnitTest      # scan parser + payload/price-key tests (JVM, fast)
./gradlew lintDebug              # → app/build/reports/lint-results-debug.html
adb install -r app/build/outputs/apk/debug/app-debug.apk
node tools/gen-strings.mjs       # after changing strings (needs the web app's node_modules)
```

**Server.** Release → `https://qrspace.co`. Debug → the local web server as the emulator sees it,
`http://10.0.2.2:3720` (cleartext allowed only for `10.0.2.2` and `localhost`, debug-only
`src/debug/res/xml/network_security_config.xml`). A debug build can switch servers at runtime: Account → "Server (debug
build)" (local / qrspace.co / any URL); cookies are kept per host, so each server keeps its own sign-in. Either default
can be overridden with `-PapiBase=…`. Test writes go to the local server only.

On this Mac (16 GB, iOS builds in parallel) take the shared lock around any build, emulator run or test against the
local server: `until mkdir /tmp/qrspace-build.lock 2>/dev/null; do sleep 5; done` … `./gradlew --stop; rmdir
/tmp/qrspace-build.lock`. Gradle is capped at `-Xmx2g`, 2 workers (`gradle.properties`).

## Structure

```
app/src/main/java/co/qrspace/app/
  MainActivity.kt        edge-to-edge, NavHost, floating bottom bar (Scan · My codes · Account), app links,
                         qrspace://auth?token=… (sign-in return), routes create, edit/{id}, code?id=…
  QrApp.kt               app container: Api, Session (+ Push), Room history, Coil (cookie client, disk cache, SVG)
  data/Api.kt            OkHttp + per-host persistent cookie jar, configurable base, every endpoint the app uses
  data/Payload.kt        ports of the site's payload.ts (FIELDS, buildPayload, titles), pricing.ts (tierOf, codeKey —
                         same hash as the web), presets/colours, storage plans (planFor)
  data/Models.kt         mirrors of the web JSON (CodeView with stats/tasks/storage, Quote, Profile, MeResponse…)
  data/Session.kt        who's signed in, demo / token sign-in, sign-out; Push (device token → /api/devices; FCM TODO)
  data/History.kt        Room: local scan history (only on the phone)
  scan/                  scanner (CameraX + ML Kit), parser, result card, actions, history
  home/HomeScreen.kt     "My QR codes": dark card per code with ON/OFF switch (QR ↔ what's under it), scans total /
                         this week / 30 day bars, Edit, As others see it; + Create new QR; To do; Shared with me
  create/CreateScreen.kt create: content (18 types) or memory code (memory, car, keys, pet) → look → price gate
  create/Forms.kt        type picker, fields (site labels, keyboards, date/time pickers), look picker (presets, colours,
                         dots, corners), live preview (POST /api/preview, debounced), tier row, price gate
  edit/EditScreen.kt     edit page: picture (share through the gate), name, what's in the code, who sees it, memory
  edit/Memory.kt         memory editor: space bar, composer (text / photo 1600 px JPEG / video), room offer, entries
  codes/                 code detail (as a scan shows it; editors get the composer), CodeImage (server PNG, offline
                         ZXing fallback), QrImage (ZXing), VideoPlayer
  account/               account: stats, purchases, packs, notifications, sign out; sign-in (Custom Tab + demo
                         picker); debug server switch
  ui/                    theme (site tokens), fonts, components, own line icons, SiteText (generated key → string)
app/src/main/res/values*/strings.xml   en (default), ru, hy, es, pt, fr, de — generated
app/src/debug/           network security config (cleartext to 10.0.2.2 / localhost only)
tools/gen-strings.mjs   regenerates strings + ui/SiteText.kt: site wording from src/lib/i18n*.ts + app-only strings
```

Look: the site's identity — black "stage" (#0B0B0C), acid lime #C6FF2E, concrete light theme (#EDEBE4), the QR-dot
grid background, Unbounded (heavy display), Onest (text), JetBrains Mono (kickers/numbers) bundled from Google Fonts
(OFL). Dark and light follow the system (in dark, a selected choice is a lime tint with a lime edge). Launcher icon =
the site's maskable icon (adaptive + monochrome).

## How it talks to the server

- **Codes.** `/c/{id}` → `GET /api/codes/{id}?visit=1` (counts as a scan); `/K/{short}` → `GET /api/verify?u=` → id.
  Lists: `GET /api/codes` (mine + shared, with `stats.days/total/week`, `tasks`, `storage`).
- **Pictures.** `GET /api/codes/{id}/image?format=png&size=768&v=<hash of look + link + paid>` — the site's exact
  drawing; Coil keeps it on disk (offline). Unpaid codes come at most 256 px, paid ones full size; the `v` part changes
  with the look and when a code gets paid, so a thumbnail is replaced. Coil 3's disk cache keys by URL and ignores the
  server's ETag, so the app keeps its own key (no network round-trip per picture, works offline). Sharing fetches
  size=1024 after the gate. Never loaded and offline → local ZXing drawing. Before a code exists: `POST /api/preview {style, format:"png", size}` (presets too), bytes cached in memory.
- **Create.** Content code: key = `codeKey(buildPayload(type, fields), style JSON)` (same order and hash as the web, unit
  tested against node output), tier = `tierOf(style)` → `GET /api/purchases?key=&tier=` → paid → create; else the
  gate: from a pack / first simple free / "To pay: $1 — Payment is a demo for now — no money is charged" →
  `POST /api/purchases` → `POST /api/codes/quick {content, style, key, title}` (one purchase = one code; same content
  and look → the same code; 402 "pay" → the app asks for the price again) → edit page.
  Memory code: `POST /api/codes {title, kind, style}` (free, like the site); its picture is paid when shared
  (key `code:{id}`, same gate, "Download for free / Pay and download").
- **Edit.** `PATCH /api/codes/{id}` (title, content, visibility); memory `POST /blocks` (multipart text / photo /
  video), `PATCH`/`DELETE /blocks/{id}`; reminders "Done" `PATCH /tasks/{id}`.
- **Video upload.** `POST /api/codes/{id}/upload-url {size, type}` → 413 if it doesn't fit; locally `{direct:false}` →
  the multipart form to `/blocks`; in production `{direct:true, name, url, method, headers}` → the file is streamed in
  one PUT with exactly those headers (progress shown, no cookies), then `POST /blocks` with `uploaded=<name>` + text.
- **Room offer** (owner's rule 09.10): the size is known before sending (video — right after picking). Doesn't fit →
  "File: 1.9 MB · free: 1 MB of 1 MB", the smallest plan that fits (`planFor(used + need)`), "It needs 10 MB of space —
  $1 a month", "Pay $1 and upload" → `POST /storage {plan}` → upload straight away. Not the owner → "Only the code's
  owner can buy more". Bigger than 1 GB → "at most 1 GB". The server measures again: on 413 the app reloads the code
  and shows the offer (or "not enough space").
- **Sign-in.** Custom Tab → `/api/auth/google|apple?next=/app/callback` (buttons only when `/api/me providers` says so)
  or `/login?next=/app/callback` ("Sign in on qrspace.co", the site's demo people included) → the server redirects to
  `qrspace://auth?token=…` → `POST /api/auth/token` sets the app's own cookie → home. In-app demo picker kept.
- **Push.** After sign-in `POST /api/devices {token, platform:"android"}`, on sign-out `DELETE` — wired; the token
  source (FCM) is a TODO behind `PUSH_ENABLED=false` until there is a Firebase project.

## Done

v1 (09.10.2026): scanner first tab (QR + 1D/2D barcodes, torch, gallery, haptic, history), our links open in the app,
code detail with memory, account, demo sign-in, app links, 7 languages, TalkBack labels.

v1.1 (09.10.2026):
- Home after sign-in = "My QR codes" like the web dashboard: dark card per code with a vertical ON/OFF switch (QR slides
  away and shows what's under it: content type and main value, or entries / photos / first text), big scan count, this
  week, 30 day bars, unread badge, Edit / As others see it, big "+ Create new QR", dashed "+" tile, "first code" card,
  "To do" (overdue and next 2 weeks, Done), "Shared with me". Scanner stays the first tab (app opens on it); sign-in
  lands on the home.
- Create: content (url, text, wifi, contact, location, event, phone, sms, email, whatsapp, telegram, viber, 6 socials)
  with the site's fields, hints, keyboards, date/time pickers; or a memory code (template + name). Look: 10 ready
  styles (thumbnails drawn by the server), colour pairs, dot / background colours, low-contrast warning, 10 dot and 11
  corner shapes, live preview. Price gate as above.
- Edit page (separate): picture + Share (gate for memory codes, PNG via the share sheet), name, what's in the code (type
  can change; the printed code stays), who sees it (all / contacts / chosen people / only me with the site's hints),
  memory: space bar, add text / photo / video, edit and delete entries, room offer. People lists, messages, reminders
  and look → "Open on qrspace.co".
- Code detail: server drawing; editors (shared "can add") get the same composer (room offer says only the owner can buy).
- Sign-in via Custom Tab + token; sign-out also deletes the push device. Debug server switch, per-host cookies.
- Strings: ~150 new, site wording reused (dash*, up*, vis*, type/field/hint/dot/eye/preset families) + app-only in 7
  languages; `ui/SiteText.kt` generated. TalkBack: switch role + "Show what's under the code: <title>", radio groups,
  headings, live regions for the gate / room offer / errors, merged scan numbers.

## Verified (09.10.2026, v1.1)

`assembleDebug` OK, 29 unit tests (incl. payloads, price key and tiers against the site's own functions), `lintDebug`
0 errors. Emulator (Pixel 7, API 36) against the local server `10.0.2.2:3720`: "Sign in on 10.0.2.2:3720" → Chrome
Custom Tab → site demo person → `/app/callback` → back in the app signed in → home; cards, switch on/off (memory and
content), scans after guest visits (7 / this week 7, day bar); create a link code with the Lime style → gate "To pay:
$1" → paid → edit page; rename; text entry; 1.9 MB video → room offer (1 MB free → 10 MB for $1) → paid → uploaded
(1.9 MB of 10 MB, paid until …); as Ani (can add, not owner) → "Only the code's owner can buy more"; memory code picture
→ "first simple code is free" → share sheet with the PNG; in-app demo picker → home; dark mode; Russian; Armenian.
Screenshots: `screenshots/v2-*.png` (gitignored).

## TODO

- **Direct video PUT on production** is written to the server's contract but only the local form path was exercised
  (the local server has no file storage).
- **Push (FCM)**: Firebase project → google-services.json, firebase-messaging, a messaging service; flip
  `PUSH_ENABLED` and return the token in `Push.token()` (data/Session.kt). Server sending needs the same keys.
- **Play Console**: the owner must create the Google Play developer account ($25 one-time). Then: release signing key,
  `bundleRelease`, store listing, privacy policy link, data-safety form (camera on-device only).
- Not in the app yet: changing an existing code's look, people / contacts lists, adding reminders, messages, deleting a
  code, market and packs purchase (the site has them; the edit page links there).

## Server changes the app would still like (not made)

Done on the server (09.10): `quick` with `key` + `title`, `upload-url` for big videos, ETag on `/image` (the app keeps
its own cache key, see Pictures), FCM sending (needs the owner's Firebase keys).

1. `public/.well-known/assetlinks.json` with `co.qrspace.app` and the release signing SHA‑256 — app links verification.
2. Optional: a `paid` flag in CodeView (the app infers it from styleLocked / edition / content for the picture key).
