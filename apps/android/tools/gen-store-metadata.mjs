// Google Play listing for fastlane supply, from the site's store texts (docs/store/listing.json — one source for
// App Store and Google Play): fastlane/metadata/android/<locale>/{title,short_description,full_description}.txt and
// changelogs/<versionCode>.txt. Run from apps/android after changing listing.json: node tools/gen-store-metadata.mjs
// Play limits: title 30, short description 80, full description 4000 characters — the script stops if one is over.
// Pictures (icon, feature graphic, phone screenshots) are not generated here: fastlane/metadata/android/*/images.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const LISTING = resolve(HERE, "../../../docs/store/listing.json");
const OUT = resolve(HERE, "../fastlane/metadata/android");
const GRADLE = resolve(HERE, "../app/build.gradle.kts");

// Site language → Play locale.
const LOCALES = { en: "en-US", ru: "ru-RU", hy: "hy-AM", es: "es-ES", pt: "pt-BR", fr: "fr-FR", de: "de-DE" };
const LIMITS = { title: 30, short_description: 80, full_description: 4000 };
// "What's new" for the first Play release (versionCode 1). Next releases: add changelogs/<versionCode>.txt by hand.
const FIRST = {
  en: "First release: scanner for QR codes and barcodes, your codes with a switch and scans, creating codes, memory under the code.",
  ru: "Первая версия: сканер QR-кодов и штрихкодов, ваши коды с выключателем и сканами, создание кодов, память под кодом.",
  hy: "Առաջին տարբերակ՝ QR կոդերի և շտրիխկոդերի սկաներ, ձեր կոդերը՝ անջատիչով և սկաներով, կոդերի ստեղծում, հիշողություն կոդի տակ։",
  es: "Primera versión: escáner de códigos QR y de barras, tus códigos con interruptor y escaneos, creación de códigos, memoria bajo el código.",
  pt: "Primeira versão: leitor de QR codes e códigos de barras, seus códigos com interruptor e leituras, criação de códigos, memória sob o código.",
  fr: "Première version : scanner de QR codes et codes-barres, vos codes avec interrupteur et scans, création de codes, mémoire sous le code.",
  de: "Erste Version: Scanner für QR-Codes und Barcodes, deine Codes mit Schalter und Scans, Codes erstellen, Erinnerung unter dem Code.",
};

const listing = JSON.parse(readFileSync(LISTING, "utf8"));
const versionCode = Number(/versionCode\s*=\s*(\d+)/.exec(readFileSync(GRADLE, "utf8"))?.[1]);
if (!versionCode) throw new Error("versionCode not found in app/build.gradle.kts");

const problems = [];
for (const [lang, locale] of Object.entries(LOCALES)) {
  const t = listing[lang];
  if (!t) throw new Error(`listing.json has no "${lang}"`);
  const files = { title: t.name, short_description: t.short, full_description: t.description };
  const dir = `${OUT}/${locale}`;
  mkdirSync(`${dir}/changelogs`, { recursive: true });
  for (const [name, text] of Object.entries(files)) {
    if (!text?.trim()) throw new Error(`${lang}: empty ${name}`);
    const len = [...text].length; // characters, as Play counts them
    if (len > LIMITS[name]) problems.push(`${locale} ${name}: ${len} > ${LIMITS[name]}`);
    writeFileSync(`${dir}/${name}.txt`, text.trim() + "\n");
  }
  if (versionCode === 1) writeFileSync(`${dir}/changelogs/1.txt`, FIRST[lang] + "\n");
}
if (problems.length) {
  console.error("Too long for Google Play:\n  " + problems.join("\n  "));
  process.exit(1);
}
console.log(`ok: ${Object.keys(LOCALES).length} locales → fastlane/metadata/android (versionCode ${versionCode})`);
