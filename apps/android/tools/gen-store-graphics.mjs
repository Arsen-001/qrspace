// Google Play graphics in the brand style (black stage #0B0B0C, lime #C6FF2E, the QR-dot grid, Unbounded / Onest /
// JetBrains Mono from the app's own res/font): the 512×512 icon (32-bit PNG, full bleed — Play rounds the corners
// itself) and the 1024×500 feature graphic (24-bit PNG, no alpha). Written to fastlane/metadata/android/en-US/images —
// the default listing language; other languages show these too unless they get their own.
// Run from apps/android (needs the web app's node_modules: playwright + its Chromium, sharp):
//   node tools/gen-store-graphics.mjs        (take the shared build lock first — it starts a browser)
import { mkdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { createRequire } from "node:module";

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = resolve(HERE, "../../..");
const require = createRequire(`${WEB}/package.json`);
const { chromium } = require("playwright");
const sharp = require("sharp");
// Inline (a page from setContent may not load file:// fonts).
const FONT = (f) => `data:font/ttf;base64,${readFileSync(resolve(HERE, "../app/src/main/res/font", f)).toString("base64")}`;
const OUT = resolve(HERE, "../fastlane/metadata/android/en-US/images");
mkdirSync(OUT, { recursive: true });

const css = `
@font-face { font-family: Unbounded; src: url(${FONT("unbounded.ttf")}); font-weight: 200 900; }
@font-face { font-family: Onest; src: url(${FONT("onest.ttf")}); font-weight: 100 900; }
@font-face { font-family: Mono; src: url(${FONT("jetbrains_mono.ttf")}); font-weight: 100 800; }
* { margin: 0; box-sizing: border-box; }
html, body { background: #0b0b0c; color: #f3f2ec; overflow: hidden; }
.grid { position: absolute; inset: 0; background-image: radial-gradient(rgba(243,242,236,.075) 1.6px, transparent 1.8px); background-size: 18px 18px; }
`;

// The launcher mark (res/drawable/ic_launcher_foreground.xml, 512 grid): three finder squares, lime cores, the module.
const mark = (size, extra = "") => `
<svg width="${size}" height="${size}" viewBox="0 0 512 512" ${extra}>
  <g fill="none" stroke="#F3F2EC" stroke-width="22">
    <rect x="121" y="121" width="104" height="104" rx="26"/><rect x="287" y="121" width="104" height="104" rx="26"/>
    <rect x="121" y="287" width="104" height="104" rx="26"/>
  </g>
  <g fill="#C6FF2E"><rect x="152" y="152" width="48" height="48" rx="7"/><rect x="318" y="152" width="48" height="48" rx="7"/>
    <rect x="152" y="318" width="48" height="48" rx="7"/><rect x="352" y="352" width="46" height="46" rx="8"/></g>
  <g fill="#F3F2EC"><rect x="290" y="290" width="46" height="46" rx="8"/><rect x="352" y="290" width="46" height="46" rx="8"/>
    <rect x="290" y="352" width="46" height="46" rx="8"/></g>
</svg>`;

// A QR-like pattern (same idea as the site's opengraph image): fixed pseudo-random cells, three finder corners.
const N = 25;
function cell(x, y) {
  const corner = (cx, cy) => x >= cx && x < cx + 7 && y >= cy && y < cy + 7;
  if (corner(0, 0) || corner(N - 7, 0) || corner(0, N - 7)) {
    const lx = x < 7 ? x : x - (N - 7), ly = y < 7 ? y : y - (N - 7);
    return lx === 0 || ly === 0 || lx === 6 || ly === 6 || (lx >= 2 && lx <= 4 && ly >= 2 && ly <= 4);
  }
  return ((x * 73856093) ^ (y * 19349663) ^ 0x5bd1e995) % 7 < 3;
}
const qr = (s) => {
  let r = "";
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (cell(x, y)) {
    const lime = (x * 7 + y * 3) % 11 === 0;
    r += `<rect x="${x * s}" y="${y * s}" width="${s - 2}" height="${s - 2}" rx="${s / 4}" fill="${lime ? "#C6FF2E" : "#0b0b0c"}"/>`;
  }
  return `<svg width="${N * s}" height="${N * s}">${r}</svg>`;
};

const icon = `<style>${css} body { width: 512px; height: 512px; }</style>
<div style="position:absolute;inset:0;background:#0b0b0c"></div><div class="grid" style="background-size:22px 22px"></div>
<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center">${mark(512)}</div>`;

const feature = `<style>${css} body { width: 1024px; height: 500px; }
.k { font: 600 15px/1 Mono; letter-spacing: .14em; color: #C6FF2E; text-transform: uppercase; }
.t { font: 900 76px/0.95 Unbounded; letter-spacing: -.02em; }
.s { font: 500 23px/1.35 Onest; color: rgba(243,242,236,.78); max-width: 470px; }
.pill { display:inline-flex; align-items:center; gap:10px; padding:8px 16px 8px 8px; border-radius:999px; background:#C6FF2E; color:#0b0b0c; font: 800 18px/1 Mono; letter-spacing:.06em; }
.dot { width:30px; height:30px; border-radius:50%; background:#0b0b0c; }
.tag { font: 600 14px/1 Mono; letter-spacing:.08em; color: rgba(243,242,236,.6); border:1px solid rgba(243,242,236,.18); padding:9px 12px; border-radius:8px; }
</style>
<div class="grid"></div>
<div style="position:absolute;left:64px;top:0;bottom:0;display:flex;flex-direction:column;justify-content:center;gap:22px">
  <div style="display:flex;align-items:center;gap:14px">${mark(56, 'style="background:#0b0b0c;border-radius:12px;outline:1.5px solid rgba(243,242,236,.18)"')}<span class="k">Scanner · Codes · Memory</span></div>
  <div class="t">QR <span style="color:#C6FF2E">Space</span></div>
  <div class="s">Scan any QR or barcode. Make a beautiful code. Keep photos, video and text under it.</div>
  <div style="display:flex;gap:10px"><span class="tag">EAN · UPC · QR · PDF417</span><span class="tag">WI‑FI</span><span class="tag">7 LANGUAGES</span></div>
</div>
<div style="position:absolute;right:70px;top:50%;transform:translateY(-50%) rotate(-4deg);">
  <div style="position:relative;padding:22px;background:#F3F2EC;border-radius:22px;box-shadow:0 0 0 10px rgba(198,255,46,.12),0 30px 60px rgba(0,0,0,.5)">${qr(13)}</div>
  <div style="position:absolute;left:-42px;bottom:-22px;transform:rotate(4deg)"><span class="pill"><span class="dot"></span>ON</span></div>
</div>`;

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ deviceScaleFactor: 1 });
  for (const [name, html, w, h, alpha] of [["icon.png", icon, 512, 512, true], ["featureGraphic.png", feature, 1024, 500, false]]) {
    await page.setViewportSize({ width: w, height: h });
    await page.setContent(html, { waitUntil: "load" });
    const fonts = await page.evaluate(async () => {
      await Promise.all(["900 10px Unbounded", "500 10px Onest", "600 10px Mono"].map((f) => document.fonts.load(f)));
      return ["Unbounded", "Onest", "Mono"].filter((f) => document.fonts.check(`12px ${f}`));
    });
    if (name !== "icon.png" && fonts.length < 3) throw new Error(`fonts not loaded: ${fonts}`);
    const png = await page.screenshot({ clip: { x: 0, y: 0, width: w, height: h } });
    // Play: icon — 32-bit PNG with alpha (opaque); feature graphic — 24-bit, no alpha.
    const img = sharp(png);
    await (alpha ? img.ensureAlpha() : img.removeAlpha()).png({ compressionLevel: 9 }).toFile(`${OUT}/${name}`);
    const m = await sharp(`${OUT}/${name}`).metadata();
    console.log(`${name}: ${m.width}×${m.height}, ${m.channels} channels`);
  }
} finally {
  await browser.close();
}
