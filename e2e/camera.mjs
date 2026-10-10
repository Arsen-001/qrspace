// Камера сканера (/scan) — владелец 10.10.2026: «с веб-версии включение камеры не работает». Подставная камера
// Chromium показывает кадры с QR-кодом → сайт читает код. Браузер без камеры для сайтов (Telegram, Instagram внутри
// приложения) — раньше чёрный квадрат без слов, теперь объяснение и «Сфотографировать код»; запрещённый доступ — как
// включить; «Выключить камеру» гасит её. И движок Safari (WebKit, iPhone): камера включается.
import { writeFileSync } from "node:fs";
import QRCode from "qrcode";
import { chromium, devices, webkit } from "playwright";
const out = new URL("./out/", import.meta.url).pathname;
const B = "http://localhost:3720";
const errors = [];
const ok = (c, m) => { console.log(c ? "  ✓" : "  ✗", m); if (!c) errors.push(m); };
const watch = (p) => p.on("pageerror", (e) => errors.push(e.message));
const camOn = (p) => p.evaluate(() => { const v = document.querySelector("video"); return !!v && v.videoWidth > 0 && !v.paused; });
const tracksLive = (p) => p.evaluate(() => { const v = document.querySelector("video"); return !!v?.srcObject && v.srcObject.getTracks().some((t) => t.readyState === "live"); });

// Кадры для подставной камеры: QR чужой ссылки на белом поле, JPEG подряд (MJPEG).
const FOREIGN = "https://evil-pay.example/parking";
const page0 = await (await chromium.launch()).newPage({ viewport: { width: 640, height: 480 } });
await page0.setContent(`<body style="margin:0;background:#fff;display:grid;place-items:center;height:100vh"><img src="${await QRCode.toDataURL(FOREIGN, { width: 400, margin: 4 })}"></body>`);
const frame = await page0.screenshot({ type: "jpeg", quality: 90 });
await page0.context().browser().close();
const mjpeg = out + "camera-qr.mjpeg";
writeFileSync(mjpeg, Buffer.concat(Array.from({ length: 30 }, () => frame)));

const fake = (file) => chromium.launch({ args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", ...(file ? [`--use-file-for-fake-video-capture=${file}`] : [])] });
const phone = { viewport: { width: 390, height: 844 }, locale: "ru-RU", isMobile: true, hasTouch: true };

// 1. Камера видит QR → сайт его прочитал и проверил
{
  const browser = await fake(mjpeg);
  const p = await (await browser.newContext({ ...phone, permissions: ["camera"] })).newPage();
  watch(p);
  await p.goto(B + "/scan", { waitUntil: "networkidle" });
  await p.getByRole("button", { name: /Навести камеру/ }).click();
  await p.waitForFunction(() => { const v = document.querySelector("video"); return v && v.videoWidth > 0; }, null, { timeout: 10000 }).catch(() => {});
  await p.screenshot({ path: out + "camera-on.png" });
  await p.getByText("Это не код QR Space").waitFor({ timeout: 20000 }).then(() => ok(true, "camera reads a QR code (foreign link → warning)"), () => ok(false, "camera reads a QR code"));
  ok((await p.locator("video").count()) === 0, "after reading — the camera is off");
  await browser.close();
}

// 2. «Выключить камеру» — видео пропало, камера погашена
{
  const browser = await fake();
  const p = await (await browser.newContext({ ...phone, permissions: ["camera"] })).newPage();
  watch(p);
  await p.goto(B + "/scan", { waitUntil: "networkidle" });
  await p.getByRole("button", { name: /Навести камеру/ }).click();
  await p.waitForFunction(() => { const v = document.querySelector("video"); return v && v.videoWidth > 0; }, null, { timeout: 10000 });
  ok((await camOn(p)) && (await tracksLive(p)), "camera starts and plays (Chromium)");
  await p.getByRole("button", { name: "Выключить камеру" }).click();
  ok((await p.locator("video").count()) === 0 && (await p.getByRole("button", { name: /Навести камеру/ }).isVisible()), "«Выключить камеру» — back to the start button");
  await browser.close();
}

// 3. Браузер без камеры для сайтов (встроенный в приложение) — объяснение, «Сфотографировать код» открывает камеру телефона
{
  const browser = await fake();
  const ctx = await browser.newContext(phone);
  await ctx.addInitScript(() => Object.defineProperty(navigator, "mediaDevices", { value: undefined }));
  const p = await ctx.newPage();
  watch(p);
  await p.goto(B + "/scan", { waitUntil: "networkidle" });
  await p.getByRole("button", { name: /Навести камеру/ }).click();
  ok(await p.getByText("Этот браузер не даёт сайту камеру").isVisible(), "no camera API (in-app browser) → explained, not a black square");
  ok((await p.locator("video").count()) === 0, "no camera API → no empty video box");
  ok((await p.locator("input[type=file][capture=environment]").count()) === 1, "«Сфотографировать код» opens the phone camera (capture)");
  ok(await p.getByRole("button", { name: "Скопировать ссылку" }).isVisible(), "link can be copied to open in Safari/Chrome");
  await p.screenshot({ path: out + "camera-no-support.png", fullPage: true });
  // Фото с кодом через ту же кнопку — читается
  await p.locator("input[type=file][capture=environment]").setInputFiles({ name: "qr.png", mimeType: "image/png", buffer: await QRCode.toBuffer(FOREIGN, { width: 600, margin: 4 }) });
  await p.getByText("Это не код QR Space").waitFor({ timeout: 15000 }).then(() => ok(true, "photo of the code is read"), () => ok(false, "photo of the code is read"));
  await browser.close();
}

// 4. Доступ к камере запрещён — как включить, «Попробовать ещё раз»
{
  const browser = await chromium.launch({ args: ["--use-fake-device-for-media-stream"] });
  const p = await (await browser.newContext(phone)).newPage();
  watch(p);
  await p.goto(B + "/scan", { waitUntil: "networkidle" });
  await p.getByRole("button", { name: /Навести камеру/ }).click();
  await p.getByText("Доступ к камере выключен").waitFor({ timeout: 10000 }).then(() => ok(true, "camera denied → «Доступ к камере выключен»"), () => ok(false, "camera denied → message"));
  ok(await p.getByText(/Настройки → Safari → Камера/).isVisible(), "says how to allow it on iPhone and Android");
  ok(await p.getByRole("button", { name: "Попробовать ещё раз" }).isVisible(), "«Попробовать ещё раз»");
  await p.screenshot({ path: out + "camera-denied.png", fullPage: true });
  await browser.close();
}

// 5. Движок Safari (WebKit, iPhone) — камера включается
{
  const browser = await webkit.launch();
  const p = await (await browser.newContext({ ...devices["iPhone 15"], locale: "ru-RU", permissions: ["camera"] })).newPage();
  watch(p);
  await p.goto(B + "/scan", { waitUntil: "networkidle" });
  await p.getByRole("button", { name: /Навести камеру/ }).click();
  await p.waitForFunction(() => { const v = document.querySelector("video"); return v && v.videoWidth > 0; }, null, { timeout: 10000 }).catch(() => {});
  ok(await camOn(p), "WebKit (Safari engine, iPhone): camera starts and plays");
  await browser.close();
}

if (errors.length) { console.log("errors:", errors); process.exit(1); }
console.log("camera: ok");
process.exit(0);
