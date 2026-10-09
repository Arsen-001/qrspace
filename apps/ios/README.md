# QR Space for iOS

Native iOS app for https://qrspace.co: Swift + SwiftUI, iOS 17+, bundle id `co.qrspace.app`, app name "QR Space".
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
xcodebuild ... test                   # unit tests: scan parsing, site payloads, payment key, prices, space plans
```

On this Mac the Android app builds at the same time, so wrap every heavy step (xcodebuild, the Simulator,
simctl screenshots) in the shared lock: `until mkdir /tmp/qrspace-build.lock 2>/dev/null; do sleep 5; done`. When you're
done, run `xcrun simctl shutdown all` and then `rmdir /tmp/qrspace-build.lock`. The website's tests reset the local
server's data and take the same lock — hold it also while testing the app against the local server.

The app icon is drawn by `swift scripts/make-icon.swift QRSpace/Resources/Assets.xcassets/AppIcon.appiconset/icon-1024.png`.

### Which server

Release builds always talk to production (`https://qrspace.co`). Debug builds can use the local dev server with the
launch argument `-QRAPIBase http://localhost:3720` (in Xcode: Scheme → Run → Arguments). All test writes go to
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

### Strings

`Localizable.xcstrings` (en, ru, hy, es, pt, fr, de). Keys the site has are copied from `src/lib/i18n*.ts` so the app
says exactly what the site says; app-only wording lives in `scripts/strings.json` with all 7 languages. After adding a
key to `strings.json` run `node apps/ios/scripts/strings.mjs` (it reads the site's dictionaries through `jiti`).

## Structure

```
project.yml                 XcodeGen spec (targets, Info.plist keys, entitlements, the E2E scheme)
QRSpace/App                 App entry, tabs, Router (deep links, sign-in callback), debug launch arguments
QRSpace/Core                Config (which server), API client (cookie session, multipart upload, verify), models,
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
QRSpace/Resources           Info.plist (generated from project.yml), entitlements, assets, Localizable.xcstrings
QRSpaceTests                Unit tests: scan parsing; site payloads, codeKey, tiers, plans, room offer, decoding
QRSpaceUITests              End-to-end flows against the local server (see above)
scripts/                    App icon, test video generator; strings.mjs + strings.json (localization)
```

## What works

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

- **Apple Developer account ($99/yr)**: the owner must buy it, then set `DEVELOPMENT_TEAM` in `project.yml`. Needed to
  run on a device, TestFlight / App Store, Universal Links, push and Wi‑Fi join. Don't buy or create accounts on the
  owner's behalf.
- **Push**: with the account — add `aps-environment` to the entitlements, set `Push.enabled = true`; the server sends
  APNs for the notices the site shows.
- **Universal Links**: set `APPLE_APP_IDS=<TEAMID>.co.qrspace.app` in Vercel so the AASA file is served.
- **Google / Apple sign-in**: the buttons appear by themselves once the owner adds the keys (`providers` in `/api/me`).
- **Direct video upload on production** is written against `/api/codes/{id}/upload-url` but could only be tested with
  `direct: false` (the local server has no Blob storage) — check one video on qrspace.co after the deploy.
- **Wi‑Fi Join**: `NEHotspotConfiguration` needs the paid team; for now Copy password and instructions.
- Not in the app yet: changing a saved code's look, people and access lists, messages, reminders editing, the
  market, buying packs.

## Server notes

The app uses only existing endpoints (new on 09.10: `/api/codes/{id}/image` with ETag and the 256 px cap for unpaid
codes and `paid` in code views, `/api/preview`, `/app/callback` → `/api/auth/token`, `/api/devices`, `/api/codes/{id}/upload-url`, `key` and
`title` in `/api/codes/quick`; production gets them at the end-of-day deploy). Still wanted from the server:

1. **Names in `/api/me` people** are only `{hy, ru, en}`, so es/pt/fr/de fall back to English.
