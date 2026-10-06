import QRCode from "qrcode";
import { chromium } from "playwright";
// «Проверить код»: по фото с QR сайт отличает настоящий код QR Space от наклейки с чужой ссылкой.
const out = new URL("./out/", import.meta.url).pathname;
const B = "http://localhost:3720";
const browser = await chromium.launch();
const errors = [];
const ok = (c, m) => { console.log(c ? "  ✓" : "  ✗", m); if (!c) errors.push(m); };
const ctx = await browser.newContext({ viewport: { width: 390, height: 900 }, locale: "ru-RU" });
const p = await ctx.newPage();
p.on("pageerror", (e) => errors.push(e.message));
// настоящие коды: питомец (видно имя) и машина (имя скрыто) — берём из списка Армана
await p.goto(B + "/login?next=/codes");
await p.getByRole("button", { name: /Арман/ }).click();
await p.waitForURL(/codes$/);
await p.waitForSelector("text=Бублик");
const list = await p.evaluate(() => fetch("/api/codes").then((r) => r.json()));
const pet = list.mine.find((c) => c.title === "Бублик");
const car = list.mine.find((c) => c.title === "Моя машина");
const png = async (text) => ({ name: "qr.png", mimeType: "image/png", buffer: await QRCode.toBuffer(text, { width: 600, margin: 4 }) });
const check = async (text, expect, name) => {
  await p.goto(B + "/verify", { waitUntil: "networkidle" });
  await p.locator("input[type=file]").setInputFiles(await png(text));
  await p.waitForSelector(`text=${expect}`, { timeout: 15000 }).then(() => ok(true, name), () => ok(false, name));
};
await check(`${list.base}/c/${pet.id}`, "Настоящий код QR Space", "genuine pet code");
ok(await p.locator("text=Бублик").count() >= 1, "shows the pet's name");
await p.screenshot({ path: out + "v-ours.png", fullPage: true });
await check(`${list.base.toUpperCase()}/K/${car.short}`, "Настоящий код QR Space", "genuine small code (/K/…)");
ok(await p.locator("text=Моя машина").count() === 0, "car name stays hidden");
await check("https://evil-pay.example/parking", "Это не код QR Space", "foreign sticker detected");
ok(await p.locator("text=evil-pay.example").count() >= 1, "shows where the fake leads");
await p.screenshot({ path: out + "v-fake.png", fullPage: true });
await check(`${list.base}/c/NOPE1234`, "такого кода нет", "our link, missing code");
await check("Просто текст", "не ссылка, а текст", "plain text");
console.log("errors:", errors.length ? errors : "none");
await browser.close();
