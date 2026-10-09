# QR Space for iOS

Native iOS app for https://qrspace.co: Swift + SwiftUI, iOS 17+, iPhone only, bundle id `co.qrspace.app`, app name
"QR Space", version 1.0.0. Purchases go through Apple in-app purchase (StoreKit 2). For the owner's App Store steps
see [«Отправка в App Store»](#отправка-в-app-store-для-владельца) below.
It talks to the same server as the website (`/api`, cookie session) and keeps the site's look: a near-black stage,
the lime accent `#C6FF2E`, and wide heavy headings. It supports light and dark mode.

## Generate, build, run

```bash
brew install xcodegen                 # once
cd apps/ios
xcodegen generate                     # project.yml → QRSpace.xcodeproj (not committed)
open QRSpace.xcodeproj                # or build from the command line:
xcodebuild -project QRSpace.xcodeproj -scheme QRSpace \
  -destination 'platform=iOS Simulator,name=iPhone 17' -derivedDataPath build/DerivedData build
xcodebuild ... test                   # unit tests: scan parsing, site payloads, payment key, prices, space plans,
                                      # the store switch (IAPTests skip themselves unless pointed at localhost)
# The App Store build, unsigned (all that's missing for an upload is the Team ID):
xcodebuild -project QRSpace.xcodeproj -scheme QRSpace -configuration Release -destination 'generic/platform=iOS' \
  -derivedDataPath build/DerivedData CODE_SIGNING_ALLOWED=NO build
```

On this Mac the Android app builds at the same time, so wrap every heavy step (xcodebuild, the Simulator,
simctl screenshots) in the shared lock: `until mkdir /tmp/qrspace-build.lock 2>/dev/null; do sleep 5; done`. When you're
done, run `xcrun simctl shutdown all` and then `rmdir /tmp/qrspace-build.lock`. The website's tests reset the local
server's data and take the same lock — hold it also while testing the app against the local server.

The app icon is drawn by `swift scripts/make-icon.swift QRSpace/Resources/Assets.xcassets/AppIcon.appiconset/icon-1024.png`.

### Which server

Release builds always talk to production (`https://qrspace.co`) and contain no debug code paths (every launch
argument below is `#if DEBUG`). The demo-person picker is not a debug path: it shows only while the server says demo
sign-in is on (`demo` in `/api/me`; `DEMO_LOGIN=off` hides it everywhere). Debug builds can use the local dev server
with the launch argument `-QRAPIBase http://localhost:3720` (in Xcode: Scheme → Run → Arguments) or the environment
variable `QR_API_BASE` (`TEST_RUNNER_QR_API_BASE=…` reaches the app that hosts the unit tests). All test writes go to
localhost — never to production. The sign-in button then says "Sign in on localhost:3720", so a screenshot shows
which server it used. `NSAllowsLocalNetworking` in Info.plist lets the app use plain http for localhost only.

### Debug launch arguments (Simulator screenshots, QA)

The Simulator has no camera or photos of its own, so these arguments drive the app instead. Debug builds only.

| Argument | What it does |
|---|---|
| `-QRAPIBase http://localhost:3720` | Use the local dev server |
| `-QRDecodeFile /path/img.png` | Runs the "From Photos" decode path on an image file, then shows the result |
| `-QRDemoPerson arman` | Demo sign-in as this person (ids are in `src/lib/people.ts`) |
| `-QRSignOut YES` | Signs out |
| `-QRTab scan\|home\|account` | Opens that tab (`codes` = `home`) |
| `-QROpenCode <id>` | Opens that code's edit page (a code shared with me for viewing — its page) |
| `-QRCreate YES` | Opens "Create a QR code" |
| `-QRAttachFile /path/file.mp4\|.jpg` | The memory composer picks this file once (room offer tests) |
| `-QRFakePushToken <hex>` | After sign-in, registers this token with `POST /api/devices` (no APNs needed) |
| `-QRShowHistory YES` | Opens the scan history |
| `-QRCameraStill /path/img.png` | Shows that picture where the camera would be (App Store screenshots) |
| `-QRPurchases NO\|YES` | Overrides the store switch (`StoreBuild.purchasesEnabled`) for this run |
| `-AppleLanguages "(ru)"` | Switches the UI language |

Example: `xcrun simctl launch booted co.qrspace.app -QRAPIBase http://localhost:3720 -QRDemoPerson arman -QRTab home`.

### End-to-end in the Simulator (local server)

`QRSpaceUITests` (scheme `QRSpaceE2E`) runs the real flows against `http://localhost:3720` and saves screenshots:
sign in on the website in the in-app browser (demo person), the home dashboard, flipping a card switch, creating a
link code through the price gate, renaming it, adding a text entry; then a 3.9 MB video under a fresh memory code —
the room offer, "Pay $1 and upload", the upload (through `upload-url`), a check on the server that the space became
10 MB, and "Download PNG" — the gate for an unpaid memory code, then the share sheet with the full-size image.

```bash
swift scripts/make-test-video.swift .testdata/big.mp4   # a real 3.9 MB .mp4 (any .mp4 over 1 MB works)
until mkdir /tmp/qrspace-build.lock 2>/dev/null; do sleep 5; done
TEST_RUNNER_QR_SHOTS=$PWD/screenshots/e2e TEST_RUNNER_QR_VIDEO=$PWD/.testdata/big.mp4 \
  xcodebuild -project QRSpace.xcodeproj -scheme QRSpaceE2E \
  -destination 'platform=iOS Simulator,name=iPhone 17' -derivedDataPath build/DerivedData \
  -collect-test-diagnostics never test     # don't hold the lock 10 min collecting diagnostics after a failure
xcrun simctl shutdown all; rmdir /tmp/qrspace-build.lock
```

### In-app purchases (StoreKit 2)

The owner chose Apple's own payments (09.10.2026). Products (created by the owner in App Store Connect; for the
Simulator they are in `QRSpace.storekit`, which is in the schemes and the test bundles but not in the app):

| Product ID | Type | Price | What the server grants |
|---|---|---|---|
| `co.qrspace.code` | Consumable | $0.99 | one code under its payment key (`g:…` new code, `code:<id>` memory code's full image) |
| `co.qrspace.pack5` / `pack10` / `pack50` / `pack100` | Consumable | $3.99 / $6.99 / $32.99 / $59.99 | a pack of 5 / 10 / 50 / 100 codes, 1 MB under each |
| `co.qrspace.space10.month` / `space100.month` / `space1000.month` | Non-renewing subscription | $0.99 / $2.99 / $8.99 | one month of 10 MB / 100 MB / 1 GB for ONE code (again — one more month) |

`Core/Store.swift`: products load at launch; every screen shows the store's `displayPrice`, never our "$1". A purchase
carries a fresh `appAccountToken`; the intent (`code` key+tier, `pack` plan, `space` code+plan) is kept in
UserDefaults under that token, so a purchase that finishes later (`Transaction.updates`, `Transaction.unfinished` at
launch — Ask to Buy, the app killed mid-purchase, the server down) still reaches `POST /api/iap` with the right
intent. The transaction is finished only after 200 or 409; on 402/422/403/404/413 it stays open (no money lost) and
the screen says so. No products (no App Store, not set up yet) — "Purchases unavailable" with "Try again". The free
first code and codes from packs don't go through Apple (the server records them as before). Where: the create gate,
the full-size download of a memory code, "Change space" and the room offer under a code, Account → Code packs.
Nothing needs restoring: consumables are used up, and the space months live on the server account.

**`StoreBuild.purchasesEnabled`** (`QR_PURCHASES_ENABLED` in project.yml, default YES; `xcodebuild … QR_PURCHASES_ENABLED=NO`)
removes every buy/pay screen and price for a build with no purchases at all;
the scanner, the free first code, codes from packs and memory within the paid space keep working.

Tests (local server only, it must run with `IAP_ALLOW_XCODE=1`):

```bash
until mkdir /tmp/qrspace-build.lock 2>/dev/null; do sleep 5; done
TEST_RUNNER_QR_IAP=1 TEST_RUNNER_QR_API_BASE=http://localhost:3720 xcodebuild -project QRSpace.xcodeproj -scheme QRSpace \
  -destination 'platform=iOS Simulator,name=iPhone 17' -derivedDataPath build/DerivedData -collect-test-diagnostics never \
  -only-testing:QRSpaceTests/IAPTests test   # code, pack, space twice, replay → 409, wrong product → 422, unfinished
xcrun simctl shutdown all; rmdir /tmp/qrspace-build.lock
```

The E2E flows (`QRSpaceE2E`) buy through StoreKit testing too (no dialogs): the room offer's "Pay $0.99 and upload",
a pack in Account, and (`test5`) the build without purchases. StoreKit testing reaches the app only from a session in
the app's own process, so `QRSpaceTests/StoreKitConfigTests` (in both schemes) sets each Simulator up first.
Caveat: Xcode's test transactions are numbered from 0 again in every new `xcodebuild` run, and the server remembers
used ids (`apple:<id>`), so a second run against the same local data gets 409 and grants nothing — until the server
tells Xcode transactions apart (e.g. by purchase date) or the local data is reset.

### Strings

`Localizable.xcstrings` (en, ru, hy, es, pt, fr, de). Keys the site has are copied from `src/lib/i18n*.ts` so the app
says exactly what the site says; app-only wording lives in `scripts/strings.json` with all 7 languages. After adding a
key to `strings.json` run `node apps/ios/scripts/strings.mjs` (it reads the site's dictionaries through `jiti`).

## Structure

```
project.yml                 XcodeGen spec (targets, Info.plist keys, entitlements, the E2E scheme)
QRSpace/App                 App entry, tabs, Router (deep links, sign-in callback), debug launch arguments
QRSpace/Core                StoreBuild (the purchases switch), Store (StoreKit 2: products, purchase, deliver to
                            the server, finish), Config (which server), API client (cookie session, multipart upload, verify), models,
                            Session, WebAuth (in-app browser sign-in) + Push, Pricing (payment key, tiers, space
                            plans, styles), ContentTypes (the site's content types and payloads), CodeImages
                            (server drawings with a disk cache), payload parsing, local QR drawing, L10n helper
QRSpace/Design              Theme: site colors (globals.css), fonts, buttons, cards, dot grid
QRSpace/Scanner             Scanner (VisionKit DataScanner + AVFoundation fallback), result sheet, scan history
QRSpace/Home                "My QR codes" dashboard: code cards with switches and scans, "To do", "Shared with me"
QRSpace/Create              Create page: content type and fields, name, look (presets, colors, shapes), price gate
QRSpace/Edit                Edit page: name, content, who sees it, memory (entries, space, composer, room offer)
QRSpace/Codes               A code as others see it / after a scan, media views
QRSpace/Account             Account (stats, purchases, sign out), sign-in (website, Google/Apple when on, demo)
QRSpace/Resources           Info.plist (generated from project.yml), entitlements, assets, Localizable.xcstrings,
                            InfoPlist.xcstrings (permission texts, 7 languages), PrivacyInfo.xcprivacy
QRSpace.storekit            The 8 products for StoreKit testing (Simulator, tests); not shipped in the app
QRSpaceTests                Unit tests: scan parsing; site payloads, codeKey, tiers, plans, room offer, decoding; the
                            store switch and Info.plist; IAPTests (StoreKit testing → local server)
QRSpaceUITests              End-to-end flows against the local server (see above); StoreShots (App Store screenshots)
scripts/                    App icon, test video generator; strings.mjs + strings.json (localization)
fastlane/                   Fastfile (release / beta / metadata lanes), Appfile, metadata.mjs (texts from
                            docs/store/listing.json → metadata/), shots/ (screenshot assets + take.mjs), screenshots/
```

## What works

### App Store readiness (09.10.2026)

- Version 1.0.0 (build 1), iPhone only (`TARGETED_DEVICE_FAMILY = 1`; iPads run it as an iPhone app), iOS 17.0+,
  portrait. Launch screen — the stage color (`LaunchBackground`, #0B0B0C), then the scanner.
- `PrivacyInfo.xcprivacy`: no tracking, no tracking domains; required-reason API — UserDefaults only (CA92.1; the app
  reads no file timestamps, disk space or boot time); collected data types exactly as in `docs/store/PRIVACY-ANSWERS.md`
  (name, email, user ID, photos/videos, other user content, purchase history, product interaction, precise location
  (optional), device ID — all linked to the person, none for tracking, all for app functionality).
- `ITSAppUsesNonExemptEncryption = NO` (HTTPS only), `LSRequiresIPhoneOS`, permission texts (camera, photos, saving
  to Photos, contacts, calendar) in all 7 languages via `InfoPlist.xcstrings` (source: `scripts/strings.json` →
  `infoPlist`, written by `scripts/strings.mjs`).
- The 1024 px icon has no alpha channel (`scripts/make-icon.swift` draws into an opaque context).
- In-app purchases (above) and "Report this code" on other people's codes (guideline 1.2; `POST /api/codes/{id}/report`).
- No links to website pages that sell things (the code page's "Open on qrspace.co" is gone); only the privacy policy
  and terms (Account and sign-in screens — guideline 5.1.1(i)) and what a scanned code itself points to.
- fastlane: `metadata.mjs` turns `docs/store/listing.json` into `fastlane/metadata/<locale>/` (ru, en-US, es-ES, pt-BR,
  fr-FR, de-DE — App Store Connect has no Armenian, so hy is skipped), with the privacy/support/marketing URLs,
  copyright, categories (Utilities, Productivity) and the App Review notes; `Fastfile` lanes `release`, `beta`,
  `metadata` with the App Store Connect API key from environment variables.
- Screenshots: `node apps/ios/fastlane/shots/take.mjs [locales]` → `fastlane/screenshots/<locale>/` — 6.9" (iPhone 17
  Pro Max, 1320×2868) and 6.5" (iPhone 14 Plus, 1284×2778): scanner with a result, "My QR codes" with a switch ON,
  create with styles, the room offer, the code's page. It runs against qrspace.co as demo "arman", makes two
  temporary memory codes with the locale's texts and deletes them at the end (also on failure).

### v2 (09.10.2026)

- **Home after sign-in = "My QR codes"** (the site's HomeDashboard). Scanner stays the first tab and opens on launch;
  signing in switches to this tab. Every code is a dark card with its own ON/OFF switch: off — the code itself,
  on — the code slides up and shows what's under it (the content: type and main value; or the memory: entries count,
  up to 3 photos, the first text). Scans are big: total, "this week: N", and 30 thin day bars from `stats.days`.
  Buttons "Edit" and "As others see it" (the code fetched without my cookie — exactly what a guest gets). Above:
  totals and a big "+ Create new QR"; reminders "To do" (overdue and the next 2 weeks, with "Done"); below — "Shared
  with me". No codes yet — "Make your first code".
- **Drawings from the server**: `GET /api/codes/{id}/image?format=png` (the same drawing as the site) for cards, the
  edit page and the code page; memory + disk cache, shown at once and revalidated with the ETag (`If-None-Match` →
  304; a changed look — 200 and a new file; a new style re-checks immediately, otherwise at most every 30 s).
  Unpaid codes come at most 256 px (enough for lists); offline — the local CoreImage drawing.
- **Create page** (like `/create`): "QR code" or "A code with memory". All 18 content types of the site, grouped
  (Basics / Contact / Social), each with its fields (`FIELDS`), Wi‑Fi security, date pickers for events; a name
  (empty — the server names it by the content, `titleOfContent`). The look: 10 ready styles, 7 color pairs, own colors
  (dots, background, corners, corner centers, swap), 10 dot shapes, 11 corner shapes, a low-contrast warning, and a
  live preview from `POST /api/preview` (debounced 300 ms, cached). "Simple / Styled code · $1". Create → the price
  gate: `GET /api/purchases?key=&tier=` with the site's own key (`codeKey` port — a code bought on the site is bought
  here too) → "Your first simple code is free — Create for free", "Code from your pack — left N · 1 MB under each
  code", or "To pay: $1 — Payment is a demo for now — no money is charged" → `POST /api/purchases` →
  `POST /api/codes/quick {content, style, key, title}` (one purchase = one code; 402 → the gate again; the same
  content and look again bring back the same code) → the new code's edit page. A memory code is created with
  `POST /api/codes` (free, as on the site). Not signed in — the sign-in sheet, then it goes on.
- **Edit page** (its own page): name, what's in the code (same form; the server validates), who sees it (everyone /
  my contacts / chosen people / only me, with the site's hints), and the memory: entries (text, photos, video) with
  Edit / Delete (owner, or the author with "can add"), the space bar ("used / quota · paid until") with plans for the
  owner (free 1 MB, 10 MB $1, 100 MB $3, 1 GB $9 a month — demo; renew; "won't fit what's there"), and the composer —
  text, photo (Photos or Files; shrunk to 1600 px JPEG like the site) or video (Photos or Files, up to 1 GB).
  A video first asks `POST /api/codes/{id}/upload-url {size, type}` — permission for exactly that many bytes
  (413 → the room offer). Production answers `{direct: true, url, headers}`: the raw file is PUT straight into storage
  with progress, then the entry is added with `uploaded=<name>` (the server re-measures). The local server says
  `direct: false` and takes the video in the multipart form.
- **Download PNG** (owner): a paid code (`paid` from the server — generator codes, editions, bought memory codes)
  gets the 1024 px drawing at once; an unpaid memory code goes through the same gate under the key `code:<id>` (as the
  site's download), then the full-size PNG opens in the share sheet — Save Image, Print, AirDrop.
- **Room offer** (Memory.tsx `RoomOffer`, `planFor`): a file that doesn't fit shows "File: 3.7 MB · free: 1 MB of
  1 MB", "It needs 10 MB of space — $1 a month. Payment is a demo…", "Pay $1 and upload" — it buys that space and
  uploads right away. Not the owner — "Only the code's owner can buy more". Over 1 GB — "pick a smaller file". The app
  never decides alone: the server measures the real file; a 413 refreshes the numbers and shows the offer (or
  "not enough space"). Videos are known before "Save" (the offer appears as soon as one is picked).
- **Sign-in in the in-app browser** (ASWebAuthenticationSession, its own cookie jar): "Sign in on qrspace.co" opens
  `/login?next=/app/callback`; Google / Apple (`/api/auth/{google,apple}?next=/app/callback`) appear only when
  `/api/me` → `providers` says so (today both are off). The server comes back with `qrspace://auth?token=…`; the app
  exchanges it (`POST /api/auth/token`) for its own session cookie. The demo picker stays. Errors — "Couldn't sign in".
- **Delete account** (App Store guideline 5.1.1(v)): in Account, "Delete account" → the site's confirm text ("Delete
  your account forever? …") → "Yes, delete forever" → `DELETE /api/profile`; then the session, the push token, cached
  drawings and photos are dropped. Hidden for demo accounts (`provider: "demo"`; the server answers 403), as on the site.
- **Push wiring**: after sign-in the APNs token would go to `POST /api/devices {token, platform: "ios"}`, and sign-out
  sends `DELETE /api/devices` first. Registration itself is off (`Push.enabled = false`) until the paid Apple
  account exists; `-QRFakePushToken` checks the server calls without APNs.
- **Short links** through `GET /api/verify?u=…` (`{result: "ours", id}`); reading the `/K/` redirect is only a fallback.
  Our links on a dev server (the `base` it reports, e.g. the Mac's LAN address) open in the app too.
- All new strings in 7 languages (mostly the site's own wording), VoiceOver labels (switches are toggles with ON/OFF
  values, selected chips/tiles are marked, entries and cards are combined), light and dark.

### v1

- **Scanner** (the first tab, opens on launch): QR and barcodes (EAN-13/8, UPC-A/E, Code 128/39/93, ITF, Codabar,
  GS1 DataBar, Data Matrix, PDF417, Aztec), VisionKit `DataScannerViewController` with an `AVCaptureMetadataOutput`
  fallback, torch, "From Photos" (Vision + CIDetector), haptic, local history (SwiftData).
- **What a scan shows**: our link opens the code in the app (a guest scanning a link-code goes to its target); URL,
  Wi‑Fi, phone, email, SMS, contact, event, location, text and barcodes each get their own buttons.
- **Account**: name, codes, scans, space, packs, purchases, unread notices, sign out (and, since v2, delete account).
- **Deep links**: `qrspace://K/…`, `qrspace://c/…`, Universal Links `https://qrspace.co/K/…` and `/c/…`.

## TODO (needs the owner or the server)

- **Apple Developer account ($99/yr)** — an organization account of AI Switch LLC (shared with BookTime); the owner
  enrolls (see «Отправка в App Store»), then sets `DEVELOPMENT_TEAM` in `project.yml`. Needed to run on a device,
  TestFlight / App Store, in-app purchases in the sandbox, Universal Links, push and Wi‑Fi join. Don't buy or create
  accounts on the owner's behalf.
- **Push**: with the account — add `aps-environment` to the entitlements, set `Push.enabled = true`; the server sends
  APNs for the notices the site shows.
- **Universal Links**: set `APPLE_APP_IDS=<TEAMID>.co.qrspace.app` in Vercel so the AASA file is served.
- **Google / Apple sign-in**: the buttons appear by themselves once the owner adds the keys (`providers` in `/api/me`).
- **Direct video upload on production** is written against `/api/codes/{id}/upload-url` but could only be tested with
  `direct: false` (the local server has no Blob storage) — check one video on qrspace.co after the deploy.
- **Wi‑Fi Join**: `NEHotspotConfiguration` needs the paid team; for now Copy password and instructions.
- Not in the app yet: changing a saved code's look, people and access lists, messages, reminders editing, the
  market.

## Server notes

The app uses only existing endpoints (new on 09.10: `/api/codes/{id}/image` with ETag and the 256 px cap for unpaid
codes and `paid` in code views, `/api/preview`, `/app/callback` → `/api/auth/token`, `/api/devices`, `/api/codes/{id}/upload-url`, `key` and
`title` in `/api/codes/quick`; production gets them at the end-of-day deploy). Still wanted from the server:

1. **Names in `/api/me` people** are only `{hy, ru, en}`, so es/pt/fr/de fall back to English.

## Отправка в App Store (для владельца)

Что уже готово в приложении: версия 1.0.0 (сборка 1), только iPhone, файл о данных (`PrivacyInfo.xcprivacy`), тексты
разрешений на 7 языках, отметка «без особого шифрования», значок без прозрачности, встроенные покупки Apple, кнопка
«Пожаловаться», тексты для страницы в магазине (`fastlane/metadata`) и скриншоты (`fastlane/screenshots`). Сборка для
App Store собирается — не хватает только аккаунта разработчика и его Team ID.

### 1. Аккаунт разработчика — на компанию

- Один аккаунт организации **AI Switch LLC (ООО «АИ Свитч»)** — и для BookTime, и для QR Space.
- Apple ID — почта компании **info@aiswitch.am** (включите двухфакторную защиту на iPhone этого Apple ID).
- Для организации Apple просит:
  - номер **D-U-N-S** компании — бесплатно, через D-U-N-S lookup на сайте Apple; запрос отправлен 05.10, номер ждём
    около 12.10;
  - точное юридическое название (как в D-U-N-S): AI Switch LLC;
  - сайт на домене компании — **aiswitch.am** (домен ещё ждёт одобрения регистратора; пока его нет, сайт и почта
    info@aiswitch.am не работают — Apple проверяет и то и другое);
  - человека с правом подписи за компанию (директор или по доверенности).
- Записаться: developer.apple.com/programs/enroll → Organization → оплатить $99 в год.
- В App Store продавцом будет написано **«AI Switch LLC»**.

### 2. Комиссия 15% вместо 30% — Small Business Program

- Когда аккаунт заработает: developer.apple.com/app-store/small-business-program → Enroll. Организация тоже подходит
  (доход меньше $1 млн в год). Связанных аккаунтов нет.
- Сделайте это до первых продаж: скидка действует со следующего месяца после одобрения.

### 3. Договор и банк

- App Store Connect → «Бизнес» (Agreements, Tax, and Banking): принять **Paid Applications Agreement**, добавить
  банковский счёт компании и налоговую форму (для компании не из США — W-8BEN-E). Без этого платные покупки не
  работают — даже проверочные в TestFlight.

### 4. Приложение в App Store Connect

- Certificates, Identifiers & Profiles → Identifiers → «+» → App ID: Bundle ID **co.qrspace.app**, включить
  Associated Domains (для ссылок qrspace.co). (Xcode может создать его и сам при первой сборке.)
- App Store Connect → Apps → «+» → New App: iOS, имя «QR Space — QR & Barcode» (если занято — другое из
  `docs/store/listing.json`), основной язык English (U.S.), Bundle ID co.qrspace.app, SKU `qrspace-ios`.
- Pricing and Availability: приложение **бесплатное**, все страны.

### 5. Встроенные покупки (8 товаров)

App Store Connect → приложение → Monetization → In-App Purchases → «+». Product ID — ровно как здесь (их ждут
приложение и сервер):

| Product ID | Тип | Цена | Что это |
|---|---|---|---|
| co.qrspace.code | Consumable | $0.99 | один QR-код |
| co.qrspace.pack5 | Consumable | $3.99 | пакет 5 кодов |
| co.qrspace.pack10 | Consumable | $6.99 | пакет 10 кодов |
| co.qrspace.pack50 | Consumable | $32.99 | пакет 50 кодов |
| co.qrspace.pack100 | Consumable | $59.99 | пакет 100 кодов |
| co.qrspace.space10.month | Non-Renewing Subscription | $0.99 | 10 МБ под одним кодом на месяц |
| co.qrspace.space100.month | Non-Renewing Subscription | $2.99 | 100 МБ под одним кодом на месяц |
| co.qrspace.space1000.month | Non-Renewing Subscription | $8.99 | 1 ГБ под одним кодом на месяц |

- У каждого: название и описание (хотя бы English и Russian — можно взять из `QRSpace.storekit`), скриншот для
  проверки (подойдёт `fastlane/screenshots/en-US/4-room-6.9in.png` или экран покупки пакета), короткая заметка.
- Первая версия: покупки отправляются на проверку **вместе с приложением** — на странице версии в разделе
  «In-App Purchases and Subscriptions» отметьте все восемь.
- Проверочные покупки: Users and Access → Sandbox → тестовый Apple ID; на iPhone — Настройки → App Store →
  Sandbox Account.
- Сервер проверяет каждую покупку у Apple (`/api/iap`) — ключи для этого в Vercel (см. `.env.example` сайта).

### 6. Team ID в проект

- developer.apple.com → Membership details → **Team ID** (10 знаков).
- В `apps/ios/project.yml`: `DEVELOPMENT_TEAM: "ВАШ_TEAM_ID"`, потом в папке `apps/ios`: `xcodegen generate`.
- В Vercel: `APPLE_APP_IDS=ВАШ_TEAM_ID.co.qrspace.app` — чтобы ссылки qrspace.co открывались в приложении.

### 7. До отправки — на сервере и сайте

- Включить **вход через Apple** (и Google) — ключи в Vercel. Правило Apple: если есть вход через Google, должен быть
  и «Войти с Apple». Пока ключей нет, приложение пишет «вход заработает, когда подключим ключи» — проверка такое не
  пропустит.
- Демо-вход к запуску выключить (`DEMO_LOGIN=off`). Проверяющие входят **по коду проверки** (логин и пароль в
  App Review Information) — `docs/store/REVIEW-LOGIN.md`; на сервере он уже включён.
- На сайте должны быть контакты компании (адрес и почта AI Switch LLC) — ссылка поддержки ведёт на qrspace.co.
- Тексты магазина уже без цены «$1» и без отсылки к покупкам на сайте (`docs/store/listing.json`); поменяли там —
  `node apps/ios/fastlane/metadata.mjs`.

### 8. Сборка → TestFlight

Вариант А — Xcode: открыть `apps/ios/QRSpace.xcodeproj` → схема QRSpace, устройство «Any iOS Device» → Product →
Archive → Organizer → Distribute App → App Store Connect → Upload.

Вариант Б — одной командой (fastlane):

1. App Store Connect → Users and Access → Integrations → App Store Connect API → «+», роль App Manager → скачать
   `AuthKey_XXXX.p8` (скачивается один раз) и положить вне репозитория, например в `~/.qrspace/`.
2. В терминале:
   ```bash
   export ASC_KEY_ID=XXXX ASC_ISSUER_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx ASC_KEY_PATH=~/.qrspace/AuthKey_XXXX.p8
   cd apps/ios && fastlane beta
   ```

Через 15–30 минут сборка появится в TestFlight: добавьте себя во внутренние тестировщики, поставьте приложение
TestFlight на iPhone и проверьте вход, создание кода и покупки (sandbox-аккаунтом). Каждая новая загрузка — номер
сборки на 1 больше: `CURRENT_PROJECT_VERSION` в `project.yml` (2, 3, …).

### 9. Анкета о данных (App Privacy)

App Store Connect → App Privacy → Get Started. Ответы — в `docs/store/PRIVACY-ANSWERS.md` (колонка «App Store»):
отслеживания нет; собираем имя, почту, номер аккаунта, фото и видео, тексты, покупки, сканы, место (только если
нашедший сам отправил), адрес телефона для уведомлений — всё связано с человеком, всё «для работы приложения».
Ссылка на политику: https://qrspace.co/legal/privacy. Это совпадает с `PrivacyInfo.xcprivacy` в приложении.

### 10. Тексты и скриншоты

- `fastlane metadata` (с теми же `ASC_*`) загружает тексты из `fastlane/metadata` и скриншоты из
  `fastlane/screenshots` (6.9" и 6.5"; ru, en-US, de-DE, es-ES, fr-FR, pt-BR). Армянского в App Store нет — его не
  загружаем.
- Переснять скриншоты: `node apps/ios/fastlane/shots/take.mjs` (сам создаёт и удаляет временные демо-коды на
  qrspace.co).

### 11. Возрастной рейтинг (Age Rating)

Ответы в анкете: насилие, страшное, откровенное, грубые слова, алкоголь/табак/наркотики, азартные игры (и
симуляция), конкурсы, медицинская информация, здоровье — **нет / None**; «лутбоксы» — нет; реклама — нет;
неограниченный доступ в интернет — **нет** (ссылки открываются в Safari, не внутри приложения); родительский
контроль и проверка возраста — нет; переписка в приложении — нет; **контент от пользователей — да** (фото, видео и
текст под кодом видят те, кому открыли; есть «Пожаловаться» и блокировка кода администратором). Для детей (Made for
Kids) — нет, приложение с 16 лет (как в условиях сайта). Итоговый рейтинг App Store Connect посчитает сам.

### 12. Заметки для проверки (App Review Information)

- Текст на английском — `fastlane/metadata/review_information/notes.txt` (`fastlane metadata` загрузит его сам): сканер
  работает **без аккаунта** (первая вкладка, камера или «Из фото»); вход — вкладка «Аккаунт» → «Войти на qrspace.co»
  → внизу «Вход по коду проверки» (аккаунт «App Review» с примерами кодов); где найти покупки (код, пакеты, место);
  удаление аккаунта — «Аккаунт» → «Удалить аккаунт».
- «Sign-in required» ✓: User name и Password — логин и код из `~/.qrspace/review-login.env`
  (`docs/store/REVIEW-LOGIN.md`); `node apps/ios/fastlane/metadata.mjs` кладёт их в `review_information/` (вне git), и
  `fastlane metadata` загрузит их сам.
- Контакт для проверки: имя, телефон, почта info@aiswitch.am.

### 13. Отправить

- На странице версии: выбрать сборку, отметить 8 покупок, Export Compliance заполнится сам (в приложении
  «без шифрования»), сторонний контент — нет, выпуск — вручную после одобрения → «Add for Review» → «Submit».
- Или одной командой: `SUBMIT=1 fastlane release` (тексты, скриншоты, новая сборка и отправка).

### Что может не понравиться проверке

- **Правило 3.1.1 (цифровые товары только через покупки Apple)** — выполнено: код, пакеты и место покупаются через
  Apple. Раньше в приложении были демо-оплаты мимо Apple: «Оплатить $1 и создать» (создание кода), «Оплатить и
  скачать — $1» (картинка кода с памятью), выбор места 10 МБ / 100 МБ / 1 ГБ помесячно и «Оплатить $X и загрузить»
  (место под кодом) — с надписью «оплата пока демо».
- Ещё могут спросить:
  - вход открывает **весь сайт** внутри приложения — оттуда можно дойти до маркета и оплаты на сайте; лучше, чтобы
    `/login?next=/app/callback` показывал только вход, без меню сайта (сервер);
  - ссылок на страницы сайта, где что-то продаётся, в приложении нет (кнопку «Открыть на qrspace.co» убрали);
    остались только «Конфиденциальность» и «Условия» (обязательная ссылка на политику — правило 5.1.1);
  - контент от пользователей (правило 1.2): «Пожаловаться» есть; могут попросить ещё «скрыть/заблокировать человека».
- Если решите продавать только на сайте: соберите с `QR_PURCHASES_ENABLED=NO` — в приложении не останется ни цен,
  ни кнопок оплаты (а первый бесплатный код, коды из пакетов, сканер и память работают); тогда не создавайте 8 покупок
  и уберите из описания цены.
