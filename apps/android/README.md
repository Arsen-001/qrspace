# QR Space — Android app

Native Android app for QR Space (https://qrspace.co): our own scanner for QR codes and barcodes, My codes and the
account. Kotlin + Jetpack Compose (Material 3 under our own look), minSdk 26, target/compile SDK 36,
applicationId `co.qrspace.app`. Talks to the same server as the website (`/api`, cookie session).

## Build and run

Needs JDK 17+ (we use Homebrew `openjdk@21`) and the Android SDK (`~/Library/Android/sdk`, platform 36).

```bash
cd apps/android
echo "sdk.dir=$HOME/Library/Android/sdk" > local.properties        # once
export JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home
./gradlew assembleDebug          # → app/build/outputs/apk/debug/app-debug.apk
./gradlew testDebugUnitTest      # scan parser tests (JVM, fast)
./gradlew lintDebug              # → app/build/reports/lint-results-debug.html
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

Server: `https://qrspace.co` by default. For a local web server: `./gradlew assembleDebug -PapiBase=http://10.0.2.2:3720`
(emulator → host; cleartext HTTP would also need a network security config — not added).

On this Mac (16 GB, iOS builds in parallel) take the shared lock around any build or emulator run:
`until mkdir /tmp/qrspace-build.lock 2>/dev/null; do sleep 5; done` … `./gradlew --stop; rmdir /tmp/qrspace-build.lock`.
Gradle is capped at `-Xmx2g`, 2 workers (`gradle.properties`).

## Structure

```
app/src/main/java/co/qrspace/app/
  MainActivity.kt        edge-to-edge, NavHost, floating bottom bar (Scan · My codes · Account), app links
  QrApp.kt               app container: Api, Session, Room history, Coil image loader (shares the cookie client)
  data/Api.kt            OkHttp + persistent cookie jar (the site's httpOnly `qr-session`), kotlinx.serialization
  data/Models.kt         mirrors of the web JSON (CodeView, CodeList, Profile, Notices, MeResponse…)
  data/Session.kt        who's signed in (/api/me), people directory for names, sign-in/out
  data/History.kt        Room: local scan history (only on the phone)
  scan/ScanParser.kt     raw value → Ours / Link / Wi‑Fi / phone / email / SMS / vCard·MECARD / geo / event / text / barcode
  scan/Decoder.kt        ML Kit barcode scanning (bundled model, offline) + camera analyzer + gallery decode
  scan/ScannerScreen.kt  CameraX preview, viewfinder, torch, gallery, haptic, permission flow, result sheet
  scan/ResultCard.kt     result card with actions (also renders a code's "what's in the code")
  scan/Actions.kt        intents: open, copy, share, call, SMS, email, map, contact, calendar, web search, join Wi‑Fi
  scan/HistoryScreen.kt  history list, delete, clear
  codes/                 My codes grid (QR thumbnails drawn locally with ZXing), code detail (memory: text/photo/video)
  account/               account: stats, purchases, packs, notifications, sign out; demo sign-in picker
  ui/                    theme (site tokens), fonts, components, own line icons
app/src/main/res/values*/strings.xml   en (default), ru, hy, es, pt, fr, de — generated
tools/gen-strings.mjs   regenerates strings: site wording from src/lib/i18n*.ts + app-only strings (edit there)
```

Look: the site's identity — black "stage" (#0B0B0C), acid lime #C6FF2E, concrete light theme (#EDEBE4), the QR-dot
grid background, Unbounded (heavy display), Onest (text), JetBrains Mono (kickers/numbers) bundled from Google Fonts
(OFL). Dark and light follow the system. Launcher icon = the site's maskable icon (adaptive + monochrome).

## How a scan maps to a code

Our printed codes contain `https://qrspace.co/c/{id}` or, for compact codes, `HTTPS://QRSPACE.CO/K/{SHORT}`
(`linkOf` in `src/lib/codes.ts`). The app recognizes these (also `www.` and the old `qrspace-one.vercel.app`) and
opens the code inside the app. `/c/{id}` → `GET /api/codes/{id}?visit=1` (counts as a scan, like the web page).
`/K/{short}` → `GET /api/verify?u=<url>` returns the id (the web `/K/` page just redirects to `/c/{id}`).

## Done (v1)

- Scanner opens first: CameraX + ML Kit (bundled, offline). QR, Aztec, Data Matrix, PDF417, EAN‑13/8, UPC‑A/E,
  Code 128/39/93, ITF, Codabar. 1D codes must read twice in a row (fewer misreads).
- Results: our link → code in the app; URL → Open / Copy / Share; Wi‑Fi → name, password, Connect (Android 11+ system
  "save network" sheet, Android 10 suggestion, older → copy password + Wi‑Fi settings); phone / SMS / email / vCard /
  MECARD / geo / calendar event → matching actions; text → Copy / Share / Search; barcode → number + type + Search the web.
- Torch, scan from a gallery photo (photo picker, no storage permission), haptic on detection, local history (Room) with
  delete/clear, camera permission explained before asking, "blocked" state → app settings.
- My codes (mine + shared with me), QR thumbnails in each code's colours with approximate dot/eye shapes, pull to refresh.
- Code detail: QR, kind, title, owner, "what's in the code" with actions, memory blocks (text, photos via Coil,
  videos via ExoPlayer — both through the cookie client because `/api/media` is access-checked), private/closed state,
  not found, open on the site, share link.
- Account: name, provider, stats (codes, scans in 30 days + total, space used of quota with a bar, QR in packs),
  notifications + reminders due, purchases, packs, open on the site, sign out. Demo sign-in picker (server demo mode).
- App links: `https://qrspace.co/K/…` and `/c/…` open in the app (needs `assetlinks.json`, below); a separate unverified
  filter catches the all-caps `HTTPS://QRSPACE.CO/K/…` of compact codes (intent filters are case-sensitive).
- Torch button only shows when the camera has a flash.
- 7 languages, per-app language (Android 13+ settings), TalkBack labels on icon buttons, headings, roles.

## Verified (09.10.2026)

`assembleDebug` OK, 17 unit tests (scan parser, code content → result), `lintDebug` 0 errors. Emulator (Pixel 7,
API 36): permission flow, live camera preview (virtual scene), gallery decode of generated QR images (Wi‑Fi → system
"Save this network?" sheet; our `/c/` link → code in the app), `/K/` short link (lower- and upper-case) → code, history,
My codes, code detail (guest and owner), demo sign-in / sign-out, account, dark mode, Armenian and Russian.
Screenshots: `screenshots/` (gitignored). Not exercised with live data: photo/video memory and "what's in the code"
(no demo code on qrspace.co has them; adding one would write to production).

## TODO

- **Google / Apple sign-in**: open `/api/auth/google?next=…` in a Custom Tab, come back through an app link with a
  one-time token the app exchanges for the session cookie. Needs the owner's OAuth keys and a small server endpoint (below).
- **Push notifications** (FCM): needs a Firebase project and a server endpoint to register device tokens.
- **Play Console**: the owner must create the Google Play developer account ($25 one-time). Then: release signing key,
  `bundleRelease`, store listing, privacy policy link (qrspace.co has one), data-safety form (camera on-device only).
- Editing in the app (add memory, change who sees it), purchases (needs payments on the server), market.
- Full code styles (textures, pictures, logos) are drawn by the site; the app's thumbnails approximate dots and eyes.

## Server changes the app needs (not made)

1. `public/.well-known/assetlinks.json` with `co.qrspace.app` and the release signing SHA‑256 — app links verification.
2. OAuth for apps: a `next` that returns to `https://qrspace.co/app/callback?token=…` (one-time, short-lived) and
   `POST /api/auth/token` exchanging it for the session cookie — so Custom Tabs sign-in reaches the app's cookie jar.
3. Optional: `GET /api/codes/short/{short}` (today `/api/verify?u=` does the job).
4. Later: `POST /api/devices` (push token), and a JSON field with the full rendered QR (SVG) per code, so the app can show
   the exact styled code instead of an approximation.
