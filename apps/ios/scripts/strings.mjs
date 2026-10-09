// Fills apps/ios/QRSpace/Resources/Localizable.xcstrings from scripts/strings.json:
//   site — keys copied from the website dictionaries (src/lib/i18n*.ts), all 7 languages, so the app says the same;
//   app  — app-only wording, given here in all 7 languages;
//   infoPlist — Info.plist texts (permission prompts) → InfoPlist.xcstrings.
// Other keys already in the catalog are kept as they are. Run from anywhere: node apps/ios/scripts/strings.mjs
import { createRequire } from "node:module";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "../../..");
const require = createRequire(join(root, "package.json"));
const jiti = require("jiti")(join(root, "x.js"));
const { DICTS } = jiti(join(root, "src/lib/i18n.ts"));

const LANGS = ["en", "ru", "hy", "es", "pt", "fr", "de"];
const spec = JSON.parse(readFileSync(join(here, "strings.json"), "utf8"));
const file = join(here, "../QRSpace/Resources/Localizable.xcstrings");
const catalog = JSON.parse(readFileSync(file, "utf8"));

const entry = (values) => ({
  extractionState: "manual",
  localizations: Object.fromEntries(LANGS.map((l) => [l, { stringUnit: { state: "translated", value: values[l] } }])),
});

const problems = [];
for (const key of spec.site) {
  const values = Object.fromEntries(LANGS.map((l) => [l, DICTS[l]?.[key]]));
  const gaps = LANGS.filter((l) => typeof values[l] !== "string");
  if (gaps.length) problems.push(`${key}: no ${gaps.join(", ")} on the site`);
  else catalog.strings[key] = entry(values);
}
for (const [key, values] of Object.entries(spec.app)) {
  const gaps = LANGS.filter((l) => typeof values[l] !== "string" || !values[l]);
  if (gaps.length) problems.push(`${key}: missing ${gaps.join(", ")}`);
  else catalog.strings[key] = entry(values);
}

catalog.strings = Object.fromEntries(Object.entries(catalog.strings).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
writeFileSync(file, JSON.stringify(catalog, null, 2) + "\n");
console.log(`${Object.keys(catalog.strings).length} keys in the catalog`);

// Info.plist texts (permission prompts, the name under the icon) → InfoPlist.xcstrings, all 7 languages.
const plist = { sourceLanguage: "en", strings: {}, version: "1.0" };
for (const [key, values] of Object.entries(spec.infoPlist ?? {})) {
  if (key.startsWith("_")) continue;
  const gaps = LANGS.filter((l) => typeof values[l] !== "string" || !values[l]);
  if (gaps.length) problems.push(`Info.plist ${key}: missing ${gaps.join(", ")}`);
  else plist.strings[key] = entry(values);
}
plist.strings = Object.fromEntries(Object.entries(plist.strings).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
writeFileSync(join(here, "../QRSpace/Resources/InfoPlist.xcstrings"), JSON.stringify(plist, null, 2) + "\n");
console.log(`${Object.keys(plist.strings).length} keys in InfoPlist.xcstrings`);
if (problems.length) {
  console.error(problems.join("\n"));
  process.exit(1);
}
