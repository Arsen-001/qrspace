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
xcodebuild ... test                   # unit tests (scan payload parsing)
```

On this Mac the Android app builds at the same time, so wrap every heavy step (xcodebuild, the Simulator,
simctl screenshots) in the shared lock: `until mkdir /tmp/qrspace-build.lock 2>/dev/null; do sleep 5; done`. When you're
done, run `xcrun simctl shutdown all` and then `rmdir /tmp/qrspace-build.lock`.

The app icon is drawn by `swift scripts/make-icon.swift QRSpace/Resources/Assets.xcassets/AppIcon.appiconset/icon-1024.png`.

### Debug launch arguments (Simulator screenshots, QA)

The Simulator has no camera, so these arguments drive the app instead. They only work in Debug builds.

| Argument | What it does |
|---|---|
| `-QRDecodeFile /path/img.png` | Runs the "From Photos" decode path on an image file, then shows the result |
| `-QRDemoPerson arman` | Demo sign-in as this person (ids are in `src/lib/people.ts`) |
| `-QRSignOut YES` | Signs out |
| `-QRTab scan\|codes\|account` | Opens that tab |
| `-QROpenCode <id>` | Opens a code in "My codes" |
| `-QRShowHistory YES` | Opens the scan history |
| `-AppleLanguages "(ru)"` | Switches the UI language |

Example: `xcrun simctl launch booted co.qrspace.app -QRDemoPerson arman -QRTab codes`.

## Structure

```
project.yml                 XcodeGen spec (targets, Info.plist keys, entitlements)
QRSpace/App                 App entry, tabs, Router (deep links), debug launch arguments
QRSpace/Core                API client (cookie session, /K/ resolving), models, Session, payload parsing,
                            QR rendering (CoreImage) and image decoding (Vision), L10n helper
QRSpace/Design              Theme: site colors (globals.css), fonts, buttons, cards, dot grid
QRSpace/Scanner             Scanner (VisionKit DataScanner + AVFoundation fallback), result sheet with actions,
                            SwiftData scan history
QRSpace/Codes               My codes (grid with local QR thumbnails), code detail (content + memory)
QRSpace/Account             Account (stats, purchases, sign out), sign-in (demo picker; OAuth TODO)
QRSpace/Resources           Info.plist (generated from project.yml), entitlements, assets, Localizable.xcstrings
QRSpaceTests                Unit tests for payload parsing and server-content → payload
scripts/make-icon.swift     App icon generator
```

## What works (v1)

- **Scanner** (the first tab, opens on launch). It reads QR codes and barcodes: EAN-13/8, UPC-A/E, Code 128/39/93, ITF,
  Codabar, GS1 DataBar, Data Matrix, PDF417 and Aztec. It uses VisionKit's `DataScannerViewController` where supported
  and falls back to an `AVCaptureMetadataOutput` session. It also has a torch toggle, a "From Photos" picker
  (decoded with Vision, plus a CIDetector fallback for QR), a success haptic on detection, and a local scan history
  (SwiftData) with delete and clear.
- **What a scan shows**, by content type:
  - our link (`qrspace.co/K/{short}` or `/c/{id}`): opens that code inside the app. `/K/` is resolved by requesting
    `https://qrspace.co/K/{short}` without following the redirect and reading `Location: /c/{id}`. The visit is
    counted (`?visit=1`). If a guest scans a link-code (site, social, WhatsApp, Telegram), the app opens the target
    right away, as decided on 07.10.
  - URL: Open, Copy link, Share.
  - Wi‑Fi: network name, password (hidden until tapped), Copy password, Copy network name, how to join.
  - Phone: Call. Email: Write email. SMS: Write SMS. Contact card (vCard/MECARD): Save to contacts.
    Event: Add to calendar (system sheets, no permission prompts). Location (`geo:`): Open in Maps.
  - Plain text: Copy, Share, Search the web.
  - Barcode: the number and its type, Search the web, Copy, Share.
- **My codes**: my codes and "Shared with me", QR thumbnails drawn on the phone (CoreImage, in each code's
  colors). Tap a code to see its detail: title, type, owner, access, who sees it, what's in the code (with the same
  actions as a scan), and the memory blocks (text, photos, and video loaded with the session cookie). It also has
  Share and Open on qrspace.co.
- **Account**: name, codes, scans in 30 days (and the total), space used (bar), QR left in packs, purchases and packs,
  new notifications count, sign out. Signed out, you get the sign-in screen with the demo person picker.
- **Deep links**: `qrspace://K/…`, `qrspace://c/…`, and Universal Links `https://qrspace.co/K/…` and `/c/…`
  (the entitlement is in place and works once the AASA file is served, see below).
- **Localization**: a String Catalog in en, ru, hy, es, pt, fr and de. Wording comes from `src/lib/i18n*.ts` where
  the site has it (same keys); the app-only strings were translated for this app.
- **VoiceOver**: labels on icon buttons, combined elements for tiles and rows, headers marked.

## TODO (needs the owner or the server)

- **Apple Developer account ($99/yr)**: the owner must buy it. Then set `DEVELOPMENT_TEAM` in `project.yml`.
  This is required to run the app on a device, for TestFlight and the App Store, Universal Links, push notifications
  and Wi‑Fi join. Don't buy or create accounts on the owner's behalf.
- **Universal Links**: set `APPLE_APP_IDS=<TEAMID>.co.qrspace.app` in Vercel so `/.well-known/apple-app-site-association`
  is served (the site code is already there).
- **Google/Apple sign-in**: `/api/auth/google?next=` is web OAuth. Plan: `ASWebAuthenticationSession` with callback
  scheme `qrspace`. This needs a server change (below). The buttons are shown disabled with the site's "keys pending"
  text.
- **Wi‑Fi Join**: `NEHotspotConfiguration` needs the Hotspot Configuration capability on a paid team. For now the app
  offers Copy password and instructions; a TODO marks the place in `ScanResultView.swift`.
- **Push notifications**: these need APNs keys (paid account) and a server endpoint to register device tokens. For
  now the account shows the unread count from `/api/notifications`.
- Not in v1: creating or editing codes, adding memory, people and access, the market, buying packs.

## Server changes the app will need (not made)

1. **OAuth for the app**: `/api/auth/{google,apple}?next=qrspace://auth` (or an `app=1` flag) that, after login,
   redirects to the app scheme with a one-time code, plus an endpoint that exchanges the code for the session cookie.
   Today the cookie is set on the web redirect, and `ASWebAuthenticationSession` cookies don't reach the app's
   URLSession.
2. **Resolve short links as JSON**: `GET /api/codes/by-short/{s}` returning `{id}`. The app currently relies on the
   307 `Location` header of the `/K/{s}` page, which works but is HTML-page behavior rather than an API contract.
3. **Push**: `POST /api/devices` `{token, platform}` and sending APNs for the notices that the site shows.
4. **Names in `/api/me` people** are only `{hy, ru, en}`, so the app falls back to English for es/pt/fr/de.
