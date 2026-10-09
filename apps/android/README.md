# QR Space — Android app

Native Android app for QR Space (https://qrspace.co): our own scanner for QR codes and barcodes, the "My QR codes"
home with a switch on every code and its scans, creating codes (content or memory) with the site's own drawing and the
price gate, editing a code and its memory (with the "room" offer for big files), packs, sign-in through the site, the
account. Purchases go through Google Play Billing. Kotlin + Jetpack Compose (Material 3 under our own look), minSdk 26,
target/compile SDK 36, applicationId `co.qrspace.app`, version 1.0.0 (versionCode 1). Talks to the same server as the
website (`/api`, cookie session). Publisher on Google Play: **AI Switch LLC**.

## Build and run

Needs JDK 17+ (we use Homebrew `openjdk@21`) and the Android SDK (`~/Library/Android/sdk`, platform 36).

```bash
cd apps/android
echo "sdk.dir=$HOME/Library/Android/sdk" > local.properties        # once
export JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home
./gradlew assembleDebug          # → app/build/outputs/apk/debug/app-debug.apk
./gradlew testDebugUnitTest      # scan parser, payload/price-key, billing mapping tests (JVM, fast)
./gradlew lintDebug              # → app/build/reports/lint-results-debug.html
./gradlew bundleRelease          # → app/build/outputs/bundle/release/app-release.aab  (what Google Play takes)
./gradlew assembleRelease        # → app/build/outputs/apk/release/app-release.apk   (same, as an APK to install)
adb install -r app/build/outputs/apk/debug/app-debug.apk
node tools/gen-strings.mjs       # after changing strings (needs the web app's node_modules)
node tools/gen-store-metadata.mjs   # Play listing texts from docs/store/listing.json → fastlane/metadata
node tools/gen-store-graphics.mjs   # Play icon 512×512 + feature graphic 1024×500 (starts a browser — take the lock)
```

Build flags: `-PapiBase=…` (server), `-PpurchasesEnabled=false` (no buy/pay screens at all, see "Payments"),
`-PfakeStore=true` (debug only: example store prices and the site's demo payments instead of Google Play — to test the
purchase screens on an emulator; never in release). Release builds are R8-minified and resource-shrunk
(`app/proguard-rules.pro`); the AAB carries the mapping file, so Play Console shows readable crash traces.

**Server.** Release → `https://qrspace.co`. Debug → the local web server as the emulator sees it,
`http://10.0.2.2:3720` (cleartext allowed only for `10.0.2.2` and `localhost`, debug-only
`src/debug/res/xml/network_security_config.xml`). A debug build can switch servers at runtime: Account → "Server (debug
build)" (local / qrspace.co / any URL); cookies are kept per host, so each server keeps its own sign-in. Either default
can be overridden with `-PapiBase=…`. Test writes go to the local server only.

On this Mac (16 GB, iOS builds in parallel) take the shared lock around any build, emulator run or test against the
local server: `until mkdir /tmp/qrspace-build.lock 2>/dev/null; do sleep 5; done` … `./gradlew --stop; rmdir
/tmp/qrspace-build.lock`. Gradle is capped at `-Xmx2g`, 2 workers (`gradle.properties`).

## Release signing (upload key)

- **The key:** `~/.qrspace/android-upload.jks` (PKCS12, RSA 4096, alias `upload`, valid 30 years,
  `CN=QR Space, O=AI Switch LLC`), its random password in `~/.qrspace/android-upload.properties` (`storeFile`,
  `storePassword`, `keyAlias`, `keyPassword`; both files mode 600). Outside the repo; `*.jks`, `*.keystore`,
  `android-upload.properties`, `*service-account*.json` are gitignored.
- **Gradle** signs release builds with it: reads that file, or another via `-PqrspaceSigning=/path/file.properties`, or
  the env vars `QRSPACE_UPLOAD_STORE_FILE`, `QRSPACE_UPLOAD_STORE_PASSWORD`, `QRSPACE_UPLOAD_KEY_ALIAS`,
  `QRSPACE_UPLOAD_KEY_PASSWORD` (CI). No key → the release build is unsigned and Gradle warns.
- **Back it up** (both files, e.g. in a password manager). If it's lost, Google can reset the upload key on request
  (with Play App Signing nothing breaks for users, but it takes days).
- **Upload certificate SHA-256:**
  `F9:F8:36:A8:10:4B:E5:8D:AD:0D:A9:07:76:AE:78:99:D1:86:93:A0:05:2D:4F:66:33:02:D1:E2:05:B5:4A:38`
- **Play App Signing:** this is only the *upload* key. Google re-signs every install from Play with its own *app signing
  key*, so phones see Google's certificate. App links verify against `https://qrspace.co/.well-known/assetlinks.json`,
  which the server builds from `ANDROID_APP_LINKS` — it needs the **app signing key's SHA-256** from Play Console →
  Test and release → App integrity → App signing (it exists after the first AAB upload), not the one above. Add the
  upload key as well, so the APK installed by hand (Desktop, testers) also opens links:
  `ANDROID_APP_LINKS=co.qrspace.app:<app signing SHA-256>|co.qrspace.app:F9:F8:36:A8:10:4B:E5:8D:AD:0D:A9:07:76:AE:78:99:D1:86:93:A0:05:2D:4F:66:33:02:D1:E2:05:B5:4A:38`

## Google Play Billing

Owner's decision (09.10.2026): built-in Google Play Billing. Billing Library `billing-ktx` 9.1.0; `billing/Store.kt`
(client) + `billing/Products.kt` (pure mapping, unit-tested). All products are one-time, and the server consumes them.

| Product id | What it gives (server intent) | Planned price |
|---|---|---|
| `co.qrspace.code` | one code: `{kind:"code", key, tier}` — the payment key as for `POST /api/purchases`, then `/api/codes/quick` as before; also a memory code's picture (`key = code:{id}`) | ≈ $0.99 |
| `co.qrspace.pack5` / `pack10` / `pack50` / `pack100` | a pack of 5 / 10 / 50 / 100 codes, 1 MB under each: `{kind:"pack", plan:"p5"…}` | ≈ $3.99 / $6.99 / $32.99 / $59.99 |
| `co.qrspace.space10.month` / `space100.month` / `space1000.month` | one month of 10 MB / 100 MB / 1 GB for ONE code: `{kind:"space", code, plan:"s10"…}`; can be bought again for other codes | ≈ $0.99 / $2.99 / $8.99 |

- **Prices** come from Google Play (`queryProductDetails`), localized for the person. They show in the price row, the
  gate ("To pay: …", "Pay … and create"), the room offer ("It needs 10 MB of space — … a month") and Account → Packs
  (buy list, new). No product details (no Play Store, products not created yet) → "Purchases unavailable right now."
  with only "Cancel", and the packs buy list is hidden. The free paths don't change: the first simple code and codes
  from a pack still go through `POST /api/purchases` (no money).
- **Buying:** `launchBillingFlow` with `obfuscatedAccountId = sha256(user id)` (hex) and `obfuscatedProfileId` = the
  intent in ≤ 64 characters (`c|tier|key`, `p|plan`, `s|plan|code`) → `PURCHASED` → `POST /api/iap {platform:"android",
  productId, purchaseToken, intent}` → the server checks it with Google, credits it once and **consumes** it. The app
  never consumes or acknowledges. Server answers: 200 / 409 (already credited) → done; 402 (not verified yet), 401,
  5xx, offline → kept and sent again later; 400 / 422 / space 403 · 404 · 413 (checked before Google, nothing consumed)
  → the error is shown and the intent dropped.
- **Pending and lost purchases:** `PENDING` → "Payment is pending — we'll finish as soon as Google Play confirms it".
  On every app resume and after sign-in, the app sends the purchases Google has that the server hasn't credited (intent
  from local storage, or from `obfuscatedProfileId` after a reinstall; only the signed-in person's). An unconsumed
  purchase of the same product (e.g. space the server refused for a deleted code) pays for the next intent instead of a
  new charge. If it's never used, Google refunds it after 3 days.
- **Tested:** `BillingProductsTest` (10 tests: product per intent, bad intents, intent JSON as the server reads it, tag
  round trip and 64-character limit, SHA-256 account id, outcome per status, **same catalog as `src/lib/iap.ts`**). On
  the emulator (Google APIs image, no Play Store) the release build degrades as designed: Billing answers
  `BILLING_UNAVAILABLE`, the gate and the room offer say "Purchases unavailable right now.", nothing crashes. Real
  purchases need Play Console: products created, license testers and an install from a test track (see below).

## Payments and Google Play

Google Play allows selling digital goods (codes, packs, space) only through Play Billing. It also forbids leading people
from the app, or from the store listing, to another way to pay. Without Play Billing, the app as it was would have been
rejected for:

1. **The demo "Pay $1"** in the create gate, the memory picture download and the room offer ("Pay $1 and upload"):
   digital goods sold outside Play Billing (and "Payment is a demo — no money is charged" reads as a fake checkout).
   → replaced by Play Billing.
2. **Account → "Open on qrspace.co"**, which goes to `/account`, whose overview and Packs tab sell packs with the site's
   payments. → removed.
3. **Market notifications** (outbid, bid, sold, won), which promote buying and selling on the site's market. → no longer
   shown.
4. **The store listing** (`docs/store/listing.json`, all 7 languages): "Numbered collectible codes, the daily drop and
   resale — at qrspace.co" points people to purchases on the website and **must come out of the Play texts** (not
   changed here, because `docs/` is outside this folder). "$1 per code … more space monthly" should match Play's prices
   ("from $0.99") or drop the price.

Also worth knowing: the edit page's "Open on qrspace.co" (people, messages, reminders, look) leads to the code page,
which also sells space with the site's payments. It's a feature link, so the risk is low; if review objects, hide it or
have the site hide its buy buttons for visitors from the app. Push notifications (once FCM is on) must not carry market
news either. The site may keep its own prices, but the app must not mention cheaper web prices. `-PpurchasesEnabled=false`
builds the app with no buy/pay screens at all (the free code, earlier packs and paid codes keep working; the app says
"This code can't be made in the app yet" or "Not enough space…"), e.g. for a store where billing isn't set up.

## Google Play compliance (checked 09.10.2026)

- target/compile SDK 36 (Play requires 35+), minSdk 26, versionCode 1 / 1.0.0. Every Play upload needs a higher
  versionCode.
- Permissions: `INTERNET`, `CAMERA`, `VIBRATE`, `CHANGE_WIFI_STATE` (Wi‑Fi QR on Android 10; 11+ uses the system sheet),
  `com.android.vending.BILLING`, and `ACCESS_NETWORK_STATE` from libraries. No storage or media permissions: photos and
  videos come through the system photo picker, so there's no "photo and video permissions" declaration. The unused
  `ACCESS_WIFI_STATE` is gone.
- No cleartext in release (`usesCleartextTraffic=false`; the cleartext config for `10.0.2.2` is debug-only).
- No backups: `allowBackup=false` + `data_extraction_rules.xml` (scan history stays on the phone).
- 16 KB memory pages (required for new apps): every native library (`libbarhopper_v3`, CameraX, graphics) has 16 KB
  ELF segments and is 16 KB-aligned in the APK (`zipalign -c -P 16`).
- App links: an `autoVerify` filter for `https://qrspace.co/K/…`, `/k/…` and `/c/…`. `www.qrspace.co` redirects, so its
  assetlinks can't verify; it gets its own non-verified filter (on Android ≤ 11, one failing host un-verifies them all).
- Account deletion: in the app (Account → Delete account) and on the web (`https://qrspace.co/account?tab=settings`).
- **Data safety:** as in `docs/store/PRIVACY-ANSWERS.md`, plus one thing it misses. The ML Kit barcode scanner sends
  Google diagnostics (device and app info, device identifiers, performance metrics, API usage — not the camera frames)
  "for diagnostics and usage analytics". In the form: **App info and performance → Diagnostics** (collected, not shared,
  purpose Analytics), and add the purpose Analytics to **Device or other IDs**. PRIVACY-ANSWERS.md and the site's privacy
  page should say this too (outside this folder).

## Store listing (fastlane supply)

```
fastlane/Appfile, Fastfile           lanes: metadata (texts + pictures), release (bundleRelease → track), validate
fastlane/metadata/android/<locale>/  title.txt, short_description.txt, full_description.txt, changelogs/1.txt
  en-US/images/icon.png              512×512, 32-bit PNG        ┐ default language: other languages show these
  en-US/images/featureGraphic.png    1024×500, 24-bit PNG       ┘ unless they get their own
  en-US|ru-RU/images/phoneScreenshots/1…5.png   1080×1920: scanner result, My QR codes (switch ON), create (styles,
                                                price), room offer, code page — 2.3 MB in all, kept in git
```

Locales: en-US, ru-RU, hy-AM, es-ES, pt-BR, fr-FR, de-DE. The texts come from `docs/store/listing.json` (name → title,
short, description) via `node tools/gen-store-metadata.mjs`, which checks Play's 30 / 80 / 4000 limits; the lanes run it
first. The lanes need `QRSPACE_PLAY_JSON_KEY` = path to the Play service-account JSON (kept outside the repo, e.g.
`~/.qrspace/play-service-account.json`); optional: `QRSPACE_PLAY_TRACK` (internal by default) and `QRSPACE_PLAY_STATUS`
(draft by default — the only status a never-published app accepts). Screenshots: emulator Pixel 7 at 1080×1920
(`adb shell wm size 1080x1920`; Play wants ≤ 2:1), dark theme, against qrspace.co as demo person Arman, from a debug
build with `-PfakeStore=true` for the prices (Play's own prices show the same way). Nothing was written on production.

## Google Play submission (для владельца)

Один аккаунт разработчика Google Play — на компанию **AI Switch LLC** (ООО «АИ Свитч»). В нём будут оба приложения:
BookTime и QR Space. В магазине разработчиком будет написано «AI Switch LLC».

1. **Купить аккаунт ($25, один раз).** Нужен номер D-U-N-S компании: его запросили 05.10, ждём примерно 12.10. Когда
   номер придёт: войти в https://play.google.com/console под **info@booktime.am** → тип аккаунта «Организация»
   (Organization) → оплатить $25 картой. Заполнить: название **AI Switch LLC** и адрес — точь-в-точь как в D-U-N-S;
   номер D-U-N-S; телефон и сайт компании; контактное лицо; почту и телефон для связи с Google (их подтвердят кодом);
   почту и телефон для пользователей (их видно в Google Play). Имя разработчика — «AI Switch LLC».
2. **Проверки.** Google проверяет компанию. Может попросить официальные документы (свидетельство о регистрации,
   выписку) и подтверждение сайта: добавить домен компании в Google Search Console под тем же аккаунтом и нажать
   «Verify website» в Play Console. Обычно это занимает несколько дней. Создавать и настраивать приложение можно сразу,
   выпускать — после проверки.
3. **Создать приложение:** Create app → название «QR Space — QR & Barcode», язык по умолчанию **English (United
   States)** (иконка и большая картинка лежат в английской папке), App, Free (покупки — внутри).
4. **Первая сборка и подпись Google (Play App Signing).** Test and release → Testing → Internal testing → Create
   release → оставить «Google создаёт и хранит ключ подписи» → загрузить файл
   `apps/android/app/build/outputs/bundle/release/app-release.aab` (собрать: `./gradlew bundleRelease`). Первый раз —
   только вручную, потом можно через fastlane. Затем App integrity → App signing → скопировать **SHA-256 ключа подписи
   приложения** и передать нам: мы поставим его на сервер (`ANDROID_APP_LINKS`, см. «Release signing»), и наши ссылки
   начнут открываться прямо в приложении. Ключ загрузки лежит на этом Mac в `~/.qrspace/` — сохраните копию.
5. **Товары для покупок** (только после загрузки сборки из шага 4: Google разрешает создавать товары, когда в
   приложении уже есть оплата). Сначала Setup → Payments profile: платёжный профиль AI Switch LLC и банковский счёт для
   выплат. Потом Monetize → Products → One-time products: 8 товаров **с точно такими id** — `co.qrspace.code` ($0.99),
   `co.qrspace.pack5` ($3.99), `co.qrspace.pack10` ($6.99), `co.qrspace.pack50` ($32.99), `co.qrspace.pack100`
   ($59.99), `co.qrspace.space10.month` ($0.99), `co.qrspace.space100.month` ($2.99), `co.qrspace.space1000.month`
   ($8.99). Цены для других стран Google пересчитает сам. Затем Setup → API access: сервисный аккаунт (Google Cloud) с
   правами «View app information», «View financial data», «Manage orders», «Release to testing tracks», «Manage store
   presence» → скачать его JSON. Он нужен на сервере (`GOOGLE_PLAY_SERVICE_ACCOUNT` — чтобы сервер проверял покупки) и
   в `~/.qrspace/play-service-account.json` для fastlane.
6. **Страница в магазине.** Самый простой путь: `export QRSPACE_PLAY_JSON_KEY=~/.qrspace/play-service-account.json; cd
   apps/android; fastlane android metadata` — зальёт тексты на 7 языках, иконку, большую картинку и скриншоты (ru, en).
   Или вручную — скопировать из `apps/android/fastlane/metadata/android/<язык>/`. Но сначала убрать из
   `docs/store/listing.json` строку про маркет коллекционных кодов на qrspace.co (Google запрещает звать покупать на
   сайте) и сверить цену «$1». В Store settings: категория Tools, почта для связи, сайт https://qrspace.co.
7. **Анкеты (Policy → App content):**
   - Privacy policy: `https://qrspace.co/legal/privacy`.
   - App access: часть функций работает только после входа → «All or some functionality is restricted» → логин и код
     проверки из `~/.qrspace/review-login.env` и путь «Account → Sign in on qrspace.co → Sign in with a review code»
     (по шагам — `docs/store/REVIEW-LOGIN.md`).
   - Ads: рекламы нет.
   - **Data safety** — по `docs/store/PRIVACY-ANSWERS.md` (там таблица уже разложена по разделам формы) **плюс**
     сканер ML Kit: «App info and performance → Diagnostics» и «Device or other IDs» — собираются, не передаются, цель
     Analytics. Шифрование при передаче — да; удаление — да, ссылка `https://qrspace.co/account?tab=settings`.
   - Account deletion: та же ссылка.
   - Content rating: анкета IARC, категория «Utility / Productivity / Other». Люди делятся фото, видео и текстом с
     выбранными людьми, поэтому на вопрос про обмен контентом между пользователями — «да»; насилия и прочего нет.
   - **Target audience: 16–17 и 18+** (не для детей).
   - Новости, госприложение, финансы, здоровье — «нет».
8. **Тест → выпуск.**
   - Internal testing: до 100 человек по почте, без проверки Google, сразу. Чтобы проверить покупки без денег — Setup
     → License testing: добавить почты тестировщиков (покупки будут тестовыми, деньги не спишутся).
   - Правило «12 тестировщиков 14 дней в закрытом тесте перед выпуском» действует **только для новых личных
     аккаунтов**. У аккаунта организации его нет: после внутреннего теста можно сразу подавать в Production.
   - Production → Create release → тот же AAB (или новый с versionCode 2) → страны → отправить на проверку. Первая
     проверка занимает от нескольких часов до 7 дней.
9. **Деньги.** Комиссия Google — **15% с первого $1 млн дохода в год** (для этого нужно вступить в программу 15% в
   Play Console, иначе будет 30%), сверх $1 млн — 30%. В ЕС, Великобритании и США с 30.06.2026 для новых установок это
   записывается как 10% за магазин + 5% за оплату через Google — те же 15%. Выплаты — раз в месяц на счёт AI Switch
   LLC из платёжного профиля.
10. **Обновления:** каждый раз увеличивать versionCode на 1 (`app/build.gradle.kts`), затем `fastlane android release`
    (сборка → Internal testing, черновик) → в Play Console перевести в Production.


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
  billing/Products.kt    Play products ↔ server intents (code / pack / space), intent JSON, profile-id tag, outcomes
  billing/Store.kt       Play Billing client: prices, buy, pending, re-send uncredited purchases, debug fake store
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
tools/gen-store-metadata.mjs   Play listing texts (docs/store/listing.json) → fastlane/metadata/android
tools/gen-store-graphics.mjs   Play icon + feature graphic (brand style) → fastlane/metadata/android/en-US/images
fastlane/               supply lanes + listing metadata, pictures, screenshots
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
  gate: from a pack / first simple free → `POST /api/purchases`; otherwise "To pay: <Play price>" → Google Play →
  `POST /api/iap` (intent `code`) → then `POST /api/codes/quick {content, style, key, title}` (one purchase = one code;
  same content and look → the same code; 402 "pay" → the app asks for the price again) → edit page.
  Memory code: `POST /api/codes {title, kind, style}` (free, like the site); its picture is paid when shared
  (key `code:{id}`, same gate, "Download for free / Pay and download").
- **Edit.** `PATCH /api/codes/{id}` (title, content, visibility); memory `POST /blocks` (multipart text / photo /
  video), `PATCH`/`DELETE /blocks/{id}`; reminders "Done" `PATCH /tasks/{id}`.
- **Video upload.** `POST /api/codes/{id}/upload-url {size, type}` → 413 if it doesn't fit; locally `{direct:false}` →
  the multipart form to `/blocks`; in production `{direct:true, name, url, method, headers}` → the file is streamed in
  one PUT with exactly those headers (progress shown, no cookies), then `POST /blocks` with `uploaded=<name>` + text.
- **Room offer** (owner's rule 09.10): the size is known before sending (video — right after picking). Doesn't fit →
  "File: 1.9 MB · free: 1 MB of 1 MB", the smallest plan that fits (`planFor(used + need)`), "It needs 10 MB of space —
  <Play price> a month", "Pay <price> and upload" → Google Play → `POST /api/iap` (intent `space`) → the code reloads →
  upload straight away (the debug fake store uses the site's demo `POST /storage {plan}`). Not the owner → "Only the code's
  owner can buy more". Bigger than 1 GB → "at most 1 GB". The server measures again: on 413 the app reloads the code
  and shows the offer (or "not enough space").
- **Sign-in.** Custom Tab → `/api/auth/google|apple?next=/app/callback` (buttons only when `/api/me providers` says so)
  or `/login?next=/app/callback` ("Sign in on qrspace.co", the site's demo people included) → the server redirects to
  `qrspace://auth?token=…` → `POST /api/auth/token` sets the app's own cookie → home. In-app demo picker kept.
- **Push.** After sign-in `POST /api/devices {token, platform:"android"}`, on sign-out `DELETE` — wired; the token
  source (FCM) is a TODO behind `PUSH_ENABLED=false` until there is a Firebase project.
- **Purchases.** Google Play Billing (see above): prices from the store, `POST /api/iap` with the intent; the free code
  and pack codes through `POST /api/purchases` as before.

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
- Delete account (store requirement): Account → "Delete account" → the site's confirm ("Delete your account forever?…",
  "Yes, delete forever") → push device removed, `DELETE /api/profile`, local sign-out, picture caches cleared. Hidden for
  demo people (`provider === "demo"`; the server answers 403 for them), as on the site.
- Strings: ~150 new, site wording reused (dash*, up*, vis*, type/field/hint/dot/eye/preset families) + app-only in 7
  languages; `ui/SiteText.kt` generated. TalkBack: switch role + "Show what's under the code: <title>", radio groups,
  headings, live regions for the gate / room offer / errors, merged scan numbers.

v1.2 = 1.0.0 for Google Play (09.10.2026):
- Release signing with the upload key outside the repo, signed AAB + APK, R8 keep rules, versionCode 1 / 1.0.0.
- Google Play Billing (codes, packs — new buy list in Account, space), localized store prices, pending / re-sent
  purchases; "Purchases unavailable" without Google Play; `PURCHASES_ENABLED` flag; debug fake store.
- Play compliance: permissions trimmed, no backups, app links filter split (www), no links / notices that lead to paying
  on the site, 16 KB pages checked.
- fastlane supply: metadata for 7 languages from listing.json, icon, feature graphic, ru/en screenshots, lanes.

## Verified (09.10.2026, 1.0.0)

`assembleDebug`, `compileDebugKotlin -PpurchasesEnabled=false`, `bundleRelease`, `assembleRelease` OK; 39 unit tests
(29 + 10 billing); `lintDebug` 0 errors. Release APK (R8, upload key) on the emulator (Pixel 7, API 36, Google APIs —
no Play Store) against qrspace.co: scan a Wi‑Fi QR from a photo (ML Kit) → result card, scan history (Room), Account →
demo Arman → My QR codes (JSON models), create → Lime style → gate "Purchases unavailable right now.", edit page →
2.2 MB video → room offer "Purchases unavailable…", code page, Account without "Open on qrspace.co"; no crashes. Debug
build with `-PfakeStore=true` against qrspace.co: $0.99 in the price row and the room offer (screenshots en + ru).
`apksigner`: signed by `CN=QR Space, O=AI Switch LLC`; `zipalign -c -P 16` OK. The release APK is also on the Desktop
(`~/Desktop/QR-Space-android.apk`; uninstall an older debug build first — other signature, higher versionCode).

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
- **Google Play**: the owner's steps in "Google Play submission"; then a real purchase on a test track (license tester)
  — the purchase path past `launchBillingFlow` can't run without Play Console.
- Not in the app yet: changing an existing code's look, people / contacts lists, adding reminders, messages, deleting a
  code, the market (site only — and the app must not point there for buying).

## Server changes the app would still like (not made)

Done on the server (09.10): `quick` with `key` + `title`, `upload-url` for big videos, ETag on `/image` (the app keeps
its own cache key, see Pictures), FCM sending (needs the owner's Firebase keys).

1. App links: the server serves assetlinks.json from `ANDROID_APP_LINKS` — set it to the Play app signing SHA-256 and
   the upload SHA-256 (see "Release signing").
2. Optional: a `paid` flag in CodeView (the app infers it from styleLocked / edition / content for the picture key).
