// Наш код ведёт только через нашу короткую ссылку: в картинке HTTPS://<сайт>/K/XXXXXX, скан открывает нашу страницу
// с содержимым и кнопками — сайт, звонок, текст и Wi-Fi тоже (решения владельца 07.10 и 08.10.2026).
import fs from "node:fs";
import { chromium } from "playwright";
import { prepareZXingModule, readBarcodes } from "zxing-wasm/reader";
prepareZXingModule({ overrides: { wasmBinary: fs.readFileSync(new URL("../node_modules/zxing-wasm/dist/reader/zxing_reader.wasm", import.meta.url)).buffer }, fireImmediately: true });
const out = new URL("./out/", import.meta.url).pathname;
const B = "http://localhost:3720";
const browser = await chromium.launch();
const errors = [];
const ok = (c, m) => { console.log(c ? "  ✓" : "  ✗", m); if (!c) errors.push(m); };
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: "ru-RU", acceptDownloads: true });
const p = await ctx.newPage();
p.on("pageerror", (e) => errors.push(e.message));
const ready = () => p.waitForFunction(() => /Код читается/.test(document.body.innerText), null, { timeout: 30000 });
// Скачанную картинку раскладываем на точки в браузере и читаем, что в коде на самом деле.
const decode = async (file) => {
  const img = await p.evaluate(async (b64) => {
    const bmp = await createImageBitmap(await (await fetch(`data:image/png;base64,${b64}`)).blob());
    // 2048 точек массивом — 16 млн чисел, тест вис; для чтения кода хватает 600.
    const n = Math.min(600, bmp.width);
    const c = new OffscreenCanvas(n, n);
    const g = c.getContext("2d");
    g.drawImage(bmp, 0, 0, n, n);
    return { w: n, h: n, data: Array.from(g.getImageData(0, 0, n, n).data) };
  }, fs.readFileSync(file).toString("base64"));
  const [r] = await readBarcodes({ data: Uint8ClampedArray.from(img.data), width: img.w, height: img.h, colorSpace: "srgb" }, { formats: ["QRCode"] });
  return r?.text ?? null;
};
const download = async () => {
  await p.getByRole("button", { name: /Скачать PNG/ }).click();
  const pay = p.getByRole("button", { name: /Скачать бесплатно|Оплатить и скачать/ });
  const [d] = await Promise.all([
    p.waitForEvent("download", { timeout: 20000 }),
    (async () => { await p.waitForTimeout(800); if (await pay.count()) await pay.click(); })(),
  ]);
  const file = out + `r-${Date.now()}.png`;
  await d.saveAs(file);
  return decode(file);
};
const hop = async (link) => {
  const r = await p.request.get(B + new URL(link.toLowerCase()).pathname.replace("/k/", "/K/").replace(/\/K\/(\w+)/, (_, s) => `/K/${s.toUpperCase()}`), { maxRedirects: 0 });
  return { status: r.status(), to: r.headers().location };
};

await p.goto(`${B}/login?next=/`);
await p.getByRole("button", { name: /Лилит/ }).click();
await p.waitForURL(B + "/");

// Любой код из генератора → наша короткая ссылка → наша страница с содержимым и кнопками (владелец 08.10.2026).
const guest = await (await browser.newContext({ locale: "ru-RU" })).newPage();
const scan = async (link) => {
  const h = await hop(link);
  ok(h.status === 307 && /^\/c\/\w+$/.test(h.to ?? ""), `/K → our page (${h.status} ${h.to})`);
  await guest.goto(B + h.to, { waitUntil: "networkidle" });
  return guest;
};
const has = async (g, sel, m) => ok(await g.locator(sel).first().isVisible({ timeout: 10000 }).catch(() => false), m);

// Сайт
await p.getByLabel("Адрес сайта").fill("example.com/menu");
await ready();
ok(await p.locator("text=Под вашим контролем").count() === 1, "note: you stay in control");
const site = await download();
ok(/^HTTPS?:\/\/[^/]+\/K\/[A-Z2-9]{6}$/.test(site ?? ""), `site code holds our short link: ${site}`);
let g = await scan(site);
await has(g, "a:has-text('Открыть сайт')", "site page: «Открыть сайт»");
ok((await g.locator("a:has-text('Открыть сайт')").getAttribute("href")) === "https://example.com/menu", "«Открыть сайт» leads to the site");
ok((await download()) === site, "same address again — same code, same short link");

// Звонок
await p.getByRole("radio", { name: "Телефон", exact: true }).click();
await p.getByLabel("Номер телефона").fill("+374 91 123456");
await ready();
const tel = await download();
ok(tel !== site, "phone — its own code");
g = await scan(tel);
ok((await g.locator("a:has-text('Позвонить')").getAttribute("href")) === "tel:+37491123456", "phone page: «Позвонить» → tel:");
await has(g, "button:has-text('Скопировать номер')", "phone page: «Скопировать номер»");

// Текст
await p.getByRole("radio", { name: "Текст", exact: true }).click();
await p.getByLabel("Текст").fill("Сбор у входа в 10:00");
await ready();
g = await scan(await download());
await has(g, "text=Сбор у входа в 10:00", "guest sees the text");

// Wi-Fi — тоже через нас, и красивый вид можно
await p.getByRole("radio", { name: "Wi-Fi", exact: true }).click();
await p.getByLabel("Название сети").fill("Dacha");
await p.getByLabel("Пароль").fill("secret123");
await p.getByRole("tab", { name: "Форма", exact: true }).click();
await p.getByRole("radio", { name: "Звёзды", exact: true }).click();
await ready();
const wifi = await download();
ok(/\/K\/[A-Z2-9]{6}$/.test(wifi ?? ""), `styled wifi downloads with our link: ${wifi}`);
g = await scan(wifi);
await has(g, "text=Dacha", "wifi page: network name");
await has(g, "button:has-text('Скопировать пароль')", "wifi page: «Скопировать пароль»");
await p.screenshot({ path: out + "r-wifi-styled.png", fullPage: true });

// Коды появились в «Мои коды»
const mine = (await (await p.request.get(B + "/api/codes")).json()).mine;
ok(mine.some((c) => c.content?.type === "url") && mine.some((c) => c.content?.type === "phone") && mine.some((c) => c.content?.type === "wifi"), "codes are in My codes");
ok(mine.filter((c) => c.content?.type === "url" && c.content.fields.url === "example.com/menu").length === 1, "no duplicates");
console.log("errors:", errors.length ? errors : "none");
await browser.close();
process.exit(errors.length ? 1 : 0);
