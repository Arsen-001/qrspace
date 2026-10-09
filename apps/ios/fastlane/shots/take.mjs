// App Store screenshots: 6.9" (iPhone 17 Pro Max, 1320×2868) and 6.5" (iPhone 14 Plus, 1284×2778) for each locale,
// against production (qrspace.co runs in demo mode) as the demo person "arman".
//   node apps/ios/fastlane/shots/take.mjs                 all locales (ru en-US de-DE es-ES fr-FR pt-BR)
//   node apps/ios/fastlane/shots/take.mjs ru en-US        only these
// Production writes are kept to a minimum and undone: two temporary memory codes (an album with a photo and a
// "Guest Wi‑Fi" note) are created, their texts switched per locale, and both are deleted at the end — also on failure.
// Every Simulator run holds the shared build lock (/tmp/qrspace-build.lock); see apps/ios/README.md.
import { execFileSync, spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ios = join(dirname(fileURLToPath(import.meta.url)), "../..");
const SERVER = "https://qrspace.co";
const LOCK = "/tmp/qrspace-build.lock";
const ALL = ["ru", "en-US", "de-DE", "es-ES", "fr-FR", "pt-BR"];
const locales = process.argv.slice(2).length ? process.argv.slice(2) : ALL;
const DEVICES = [
  { name: "QRS 17 Pro Max", type: "com.apple.CoreSimulator.SimDeviceType.iPhone-17-Pro-Max", suffix: "6.9in" },
  { name: "QRS 14 Plus", type: "com.apple.CoreSimulator.SimDeviceType.iPhone-14-Plus", suffix: "6.5in" },
];
// App Store locale → app language, region format, and the temporary codes' texts.
const T = {
  ru: { lang: "ru", locale: "ru_RU", album: "Семейный альбом", caption: "Арарат на закате — вид с дачи",
    recipe: "Бабушкин рецепт гаты: 3 стакана муки, 200 г масла, сахар и ваниль. Печь 40 минут.",
    wifi: "Wi‑Fi для гостей", wifiText: "Сеть: Ararat-Guest\nПароль: apricot2026\nРоутер — в прихожей." },
  "en-US": { lang: "en", locale: "en_US", album: "Family album", caption: "Ararat at sunset — the view from our country house",
    recipe: "Grandma’s gata recipe: 3 cups of flour, 200 g butter, sugar and vanilla. Bake for 40 minutes.",
    wifi: "Guest Wi‑Fi", wifiText: "Network: Ararat-Guest\nPassword: apricot2026\nThe router is in the hallway." },
  "de-DE": { lang: "de", locale: "de_DE", album: "Familienalbum", caption: "Der Ararat bei Sonnenuntergang — Blick vom Garten",
    recipe: "Omas Gata-Rezept: 3 Tassen Mehl, 200 g Butter, Zucker und Vanille. 40 Minuten backen.",
    wifi: "WLAN für Gäste", wifiText: "Netz: Ararat-Guest\nPasswort: apricot2026\nDer Router steht im Flur." },
  "es-ES": { lang: "es", locale: "es_ES", album: "Álbum familiar", caption: "El Ararat al atardecer, desde nuestra casa de campo",
    recipe: "La receta de gata de la abuela: 3 tazas de harina, 200 g de mantequilla, azúcar y vainilla. Hornear 40 minutos.",
    wifi: "Wi‑Fi para invitados", wifiText: "Red: Ararat-Guest\nContraseña: apricot2026\nEl router está en el pasillo." },
  "fr-FR": { lang: "fr", locale: "fr_FR", album: "Album de famille", caption: "L’Ararat au coucher du soleil, vu de la maison de campagne",
    recipe: "La recette de gata de mamie : 3 tasses de farine, 200 g de beurre, sucre et vanille. Cuire 40 minutes.",
    wifi: "Wi‑Fi invités", wifiText: "Réseau : Ararat-Guest\nMot de passe : apricot2026\nLe routeur est dans l’entrée." },
  "pt-BR": { lang: "pt", locale: "pt_BR", album: "Álbum de família", caption: "O Ararat ao pôr do sol, visto da nossa casa de campo",
    recipe: "A receita de gata da vovó: 3 xícaras de farinha, 200 g de manteiga, açúcar e baunilha. Assar por 40 minutos.",
    wifi: "Wi‑Fi para visitas", wifiText: "Rede: Ararat-Guest\nSenha: apricot2026\nO roteador fica no corredor." },
};
for (const l of locales) if (!T[l]) throw new Error(`unknown locale ${l} (known: ${ALL.join(" ")})`);

const sleep = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
const run = (cmd, args, opts = {}) => {
  const r = spawnSync(cmd, args, { stdio: "inherit", ...opts });
  if (r.status !== 0) throw new Error(`${cmd} ${args.slice(0, 3).join(" ")}… failed (${r.status})`);
};
function locked(fn) {
  for (;;) { try { mkdirSync(LOCK); break; } catch { sleep(5000); } }
  try { return fn(); } finally {
    spawnSync("xcrun", ["simctl", "shutdown", "all"], { stdio: "ignore" });
    try { rmdirSync(LOCK); } catch {}
  }
}

// --- assets: the camera picture, the album photo, a video bigger than 1 MB (all in the gitignored .testdata)
const data = join(ios, ".testdata");
if (!existsSync(join(data, "still.png")) || !existsSync(join(data, "photo.jpg"))) run("swift", [join(ios, "fastlane/shots/make-assets.swift"), data]);
if (!existsSync(join(data, "big.mp4"))) run("swift", [join(ios, "scripts/make-test-video.swift"), join(data, "big.mp4")]);
// The name shows under the composer's picker.
const video = join(data, "shots", "Summer-2026.mp4");
mkdirSync(dirname(video), { recursive: true });
copyFileSync(join(data, "big.mp4"), video);

// --- simulators
const listed = JSON.parse(execFileSync("xcrun", ["simctl", "list", "devices", "available", "-j"], { encoding: "utf8" })).devices;
const runtime = Object.keys(listed).filter((k) => k.includes("iOS")).sort().pop();
for (const d of DEVICES) {
  d.udid = Object.values(listed).flat().find((x) => x.name === d.name)?.udid
    ?? execFileSync("xcrun", ["simctl", "create", d.name, d.type, runtime], { encoding: "utf8" }).trim();
}

// --- production: sign in as the demo person, two temporary codes
let cookie = "";
async function api(path, method = "GET", body) {
  const headers = { cookie };
  let payload;
  if (body instanceof FormData) payload = body;
  else if (body) { headers["content-type"] = "application/json"; payload = JSON.stringify(body); }
  // A long Simulator run can leave a pooled connection dead ("other side closed"): retry what is safe to repeat.
  let r;
  for (let attempt = 1; ; attempt++) {
    try { r = await fetch(SERVER + path, { method, headers, body: payload }); break; }
    catch (e) { if (method === "POST" || attempt >= 3) throw e; sleep(1000 * attempt); }
  }
  const set = r.headers.getSetCookie?.() ?? [];
  for (const c of set) if (c.startsWith("qr-session=")) cookie = c.split(";")[0];
  if (!r.ok) throw new Error(`${method} ${path} → ${r.status}`);
  return r.headers.get("content-type")?.includes("json") ? r.json() : null;
}
const block = (code, i) => code.blocks[i].id;

const made = [];
const failed = [];
async function cleanup() {
  for (const id of made.splice(0)) {
    try { await api(`/api/codes/${id}`, "DELETE"); console.log(`deleted temporary code ${id}`); }
    catch (e) { console.error(`! couldn't delete ${id} on ${SERVER}: ${e.message} — delete it by hand`); }
  }
}
process.on("SIGINT", async () => { await cleanup(); process.exit(130); });

// Build first (it may wait a long time for the lock), then make the temporary codes.
locked(() => run("xcodebuild", ["-project", "QRSpace.xcodeproj", "-scheme", "QRSpaceE2E", "-destination", `id=${DEVICES[0].udid}`,
  "-derivedDataPath", "build/DerivedData", "-quiet", "build-for-testing"], { cwd: ios }));

try {
  await api("/api/me", "POST", { personId: "arman" });
  const first = T[locales[0]];
  // The Wi‑Fi note first, the album last — the newest code is the first card.
  let wifi = await api("/api/codes", "POST", { title: first.wifi, kind: "memory" });
  made.push(wifi.id);
  let album = await api("/api/codes", "POST", { title: first.album, kind: "memory" });
  made.push(album.id);
  await api(`/api/codes/${album.id}`, "PATCH", { visibility: "all" });
  const form = new FormData();
  form.set("text", first.caption);
  form.set("file", new Blob([readFileSync(join(data, "photo.jpg"))], { type: "image/jpeg" }), "photo.jpg");
  album = await api(`/api/codes/${album.id}/blocks`, "POST", form);
  const textForm = (t) => { const f = new FormData(); f.set("text", t); return f; };
  album = await api(`/api/codes/${album.id}/blocks`, "POST", textForm(first.recipe));
  wifi = await api(`/api/codes/${wifi.id}/blocks`, "POST", textForm(first.wifiText));
  console.log(`temporary codes: album ${album.id}, wifi ${wifi.id}`);

  for (const l of locales) {
    const t = T[l];
    await api(`/api/codes/${album.id}`, "PATCH", { title: t.album });
    await api(`/api/codes/${album.id}/blocks/${block(album, 0)}`, "PATCH", { text: t.caption });
    await api(`/api/codes/${album.id}/blocks/${block(album, 1)}`, "PATCH", { text: t.recipe });
    await api(`/api/codes/${wifi.id}`, "PATCH", { title: t.wifi });
    await api(`/api/codes/${wifi.id}/blocks/${block(wifi, 0)}`, "PATCH", { text: t.wifiText });
    for (const d of DEVICES) {
      console.log(`\n=== ${l} · ${d.name}`);
      locked(() => {
        spawnSync("xcrun", ["simctl", "boot", d.udid], { stdio: "ignore" });
        run("xcrun", ["simctl", "bootstatus", d.udid, "-b"], { stdio: "ignore" });
        run("xcrun", ["simctl", "ui", d.udid, "appearance", "light"]);
        run("xcrun", ["simctl", "status_bar", d.udid, "override", "--time", "9:41", "--dataNetwork", "wifi", "--wifiMode", "active",
          "--wifiBars", "3", "--cellularMode", "active", "--cellularBars", "4", "--batteryState", "discharging", "--batteryLevel", "100"]);
        const env = { ...process.env, TEST_RUNNER_QR_SHOTS_DIR: join(ios, "fastlane/screenshots", l), TEST_RUNNER_QR_SHOT_LANG: t.lang,
          TEST_RUNNER_QR_SHOT_LOCALE: t.locale, TEST_RUNNER_QR_SHOT_SUFFIX: d.suffix, TEST_RUNNER_QR_SHOT_CODE: album.id,
          TEST_RUNNER_QR_STILL: join(data, "still.png"), TEST_RUNNER_QR_VIDEO: video };
        const test = (only, e = process.env) => run("xcodebuild", ["-project", "QRSpace.xcodeproj", "-scheme", "QRSpaceE2E",
          "-destination", `id=${d.udid}`, "-derivedDataPath", "build/DerivedData", "-collect-test-diagnostics", "never", "-quiet",
          `-only-testing:${only}`, "test-without-building"], { cwd: ios, env: e });
        // StoreKit testing for the app on this Simulator (store prices in the shots), then the shots.
        test("QRSpaceTests/StoreKitConfigTests");
        try { test("QRSpaceUITests/StoreShots", env); } catch (e) { failed.push(`${l} ${d.suffix}`); console.error(`! ${l} ${d.suffix}: ${e.message}`); }
      });
    }
  }
} finally {
  await cleanup();
}
console.log("\nscreenshots → apps/ios/fastlane/screenshots/<locale>/");
if (failed.length) { console.error(`! some shots need a look (a step failed): ${failed.join(", ")}`); process.exit(1); }
