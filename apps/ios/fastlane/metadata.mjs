// App Store texts for fastlane deliver: docs/store/listing.json → apps/ios/fastlane/metadata/<locale>/*.txt.
// Run after changing listing.json: node apps/ios/fastlane/metadata.mjs (or `fastlane metadata_files`).
// Armenian (hy) is skipped: App Store Connect has no Armenian localization. Lengths are App Store limits.
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const listing = JSON.parse(readFileSync(join(here, "../../../docs/store/listing.json"), "utf8"));
const out = join(here, "metadata");

// listing.json language → App Store Connect locale.
const LOCALES = { ru: "ru", en: "en-US", es: "es-ES", pt: "pt-BR", fr: "fr-FR", de: "de-DE" };
const SKIPPED = { hy: "App Store Connect has no Armenian" };
const LIMITS = { name: 30, subtitle: 30, promotional_text: 170, keywords: 100, description: 4000 };
const URLS = {
  privacy_url: "https://qrspace.co/legal/privacy",
  support_url: "https://qrspace.co",
  marketing_url: "https://qrspace.co",
};
// Not localized (fastlane reads them from metadata/).
const COMMON = {
  copyright: `${new Date().getFullYear()} AI Switch LLC`,
  primary_category: "UTILITIES",
  secondary_category: "PRODUCTIVITY",
};
// For App Review (English). Edit here, not in the generated file.
const REVIEW_NOTES = `QR Space is a QR code and barcode scanner plus QR codes with "memory": photos, video and text kept under a code, visible to the people the owner chooses.

- The scanner (first tab) works without an account: point the camera at any QR code or barcode, or tap "From Photos".
- Sign in: the Account tab → "Sign in on qrspace.co" opens our website inside the app (Sign in with Apple or Google). While demo sign-in is on, the same screen also lists demo people — tap "Arman" to use a demo account with sample codes.
- In-app purchases (StoreKit): one QR code (consumable), packs of 5/10/50/100 codes (consumables), and more space under one code for one month — 10 MB, 100 MB or 1 GB (non-renewing subscriptions; they can be bought again for other codes). Where: "My QR codes" → "+ Create new QR" → enter a link → pick a styled look → Create (the first simple code is free); packs — Account → Packs; space — open a code with memory → "Change space", or add a video bigger than the free space.
- Delete account: Account → "Delete account" (hidden for demo accounts).
- The camera is used only to read codes on the device; frames are not sent anywhere. Scan history stays on the phone.`;

const problems = [];
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
for (const [k, v] of Object.entries(COMMON)) writeFileSync(join(out, `${k}.txt`), v + "\n");
mkdirSync(join(out, "review_information"), { recursive: true });
writeFileSync(join(out, "review_information/notes.txt"), REVIEW_NOTES + "\n");

for (const [lang, locale] of Object.entries(LOCALES)) {
  const t = listing[lang];
  if (!t) { problems.push(`${lang}: not in listing.json`); continue; }
  const files = {
    name: t.name,
    subtitle: t.subtitle,
    promotional_text: t.promo,
    description: t.description,
    keywords: t.keywords,
    ...URLS,
  };
  mkdirSync(join(out, locale), { recursive: true });
  for (const [file, text] of Object.entries(files)) {
    const n = [...(text ?? "")].length;
    if (!n) problems.push(`${locale}/${file}: empty`);
    if (LIMITS[file] && n > LIMITS[file]) problems.push(`${locale}/${file}: ${n} > ${LIMITS[file]}`);
    writeFileSync(join(out, locale, `${file}.txt`), (text ?? "") + "\n");
  }
  if (/,\s/.test(t.keywords)) problems.push(`${locale}/keywords: no spaces after commas`);
  // Prices in the texts must match what the store charges in every country (in-app purchase prices differ).
  for (const line of t.description.split("\n")) if (/\$|€/.test(line)) console.log(`note ${locale}: a price in the description — "${line.trim()}"`);
}
for (const [lang, why] of Object.entries(SKIPPED)) console.log(`skipped ${lang}: ${why}`);
console.log(`metadata → ${out} (${Object.keys(LOCALES).length} locales)`);
if (problems.length) {
  console.error(problems.join("\n"));
  process.exit(1);
}
