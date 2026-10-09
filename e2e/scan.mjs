// Наш сканер на сайте (/scan, 09.10.2026): фото с кодом → что в нём и кнопки; штрихкод → номер и поиск; наш код — «настоящий».
import QRCode from "qrcode";
import { writeBarcode } from "zxing-wasm/writer";
import { chromium } from "playwright";
const out = new URL("./out/", import.meta.url).pathname;
const B = "http://localhost:3720";
const browser = await chromium.launch();
const errors = [];
const ok = (c, m) => { console.log(c ? "  ✓" : "  ✗", m); if (!c) errors.push(m); };

const qr = async (text) => ({ name: "qr.png", mimeType: "image/png", buffer: await QRCode.toBuffer(text, { width: 600, margin: 4 }) });
const bar = async (text, format) => {
  const r = await writeBarcode(text, { format, scale: 4 });
  return { name: "bar.png", mimeType: "image/png", buffer: Buffer.from(await r.image.arrayBuffer()) };
};

for (const w of [390, 1280]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: 900 }, locale: "ru-RU" });
  const p = await ctx.newPage();
  p.on("pageerror", (e) => errors.push(e.message));
  const scan = async (file, expect, name) => {
    await p.goto(B + "/scan", { waitUntil: "networkidle" });
    await p.locator("input[type=file]").setInputFiles(file);
    await p.waitForSelector(`text=${expect}`, { timeout: 15000 }).then(() => ok(true, `${w}: ${name}`), () => ok(false, `${w}: ${name}`));
  };
  if (w === 390) {
    await p.goto(B + "/", { waitUntil: "networkidle" });
    ok((await p.getByRole("link", { name: "Сканер", exact: true }).count()) === 1, "scanner in the menu");
  }
  await scan(await qr("WIFI:T:WPA;S:Кафе Лайм;P:lime2026;;"), "Кафе Лайм", "Wi‑Fi: network name");
  ok(await p.getByText("lime2026").isVisible(), `${w}: Wi‑Fi password shown`);
  ok((await p.getByRole("button", { name: "Скопировать пароль" }).count()) === 1, `${w}: copy password button`);
  if (w === 390) await p.screenshot({ path: `${out}scan-${w}-wifi.png`, fullPage: true });
  await scan(await qr("BEGIN:VCARD\nVERSION:3.0\nN:Акопян;Ани\nTEL:+37491123456\nEMAIL:ani@example.com\nEND:VCARD"), "Ани Акопян", "contact card");
  ok((await p.getByRole("button", { name: "Сохранить в контакты" }).count()) === 1, `${w}: save contact button`);
  await scan(await qr("tel:+12345678912"), "+12345678912", "phone");
  await scan(await bar("4006381333931", "EAN13"), "4006381333931", "EAN-13 barcode number");
  ok(await p.getByText("Штрихкод · EAN13").isVisible(), `${w}: barcode type shown`);
  ok((await p.getByRole("link", { name: /Найти в интернете/ }).getAttribute("href")).includes("4006381333931"), `${w}: web search for the number`);
  if (w === 390) await p.screenshot({ path: `${out}scan-${w}-barcode.png`, fullPage: true });
  await scan(await bar("PARCEL-AM-2026-77", "Code128"), "PARCEL-AM-2026-77", "Code 128 barcode");
  await scan(await qr("https://phishing.example.net/pay"), "Это не код QR Space", "foreign link warned");
  ok((await p.getByRole("link", { name: /Открыть сайт/ }).count()) === 1, `${w}: foreign link still can be opened`);
  ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${w}: fits the screen`);
  await ctx.close();
}

// Наш код — «настоящий» и открывается у нас
const ctx = await browser.newContext({ viewport: { width: 390, height: 900 }, locale: "ru-RU" });
const p = await ctx.newPage();
await p.goto(B + "/login?next=/codes");
await p.getByRole("button", { name: /Арман/ }).click();
await p.waitForURL(/codes$/);
const list = await p.evaluate(() => fetch("/api/codes").then((r) => r.json()));
const pet = list.mine.find((c) => c.title === "Бублик");
await p.goto(B + "/scan", { waitUntil: "networkidle" });
await p.locator("input[type=file]").setInputFiles(await qr(`${list.base}/c/${pet.id}`));
await p.waitForSelector("text=Настоящий код QR Space", { timeout: 15000 }).then(() => ok(true, "our code recognised"), () => ok(false, "our code recognised"));
ok((await p.getByRole("link", { name: /Открыть/ }).first().getAttribute("href")) === `/c/${pet.id}`, "our code opens on our page");

await browser.close();
if (errors.length) { console.log("errors:", errors); process.exit(1); }
console.log("scan: ok");
