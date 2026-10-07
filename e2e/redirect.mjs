// Наш код ведёт только через нашу короткую ссылку (решение владельца 07.10.2026): сайт, звонок, текст из генератора →
// в картинке HTTPS://<сайт>/K/XXXXXX, скан сразу переадресует (один переход). Wi-Fi — прямо в коде и только простой.
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

// Сайт
await p.getByLabel("Адрес сайта").fill("example.com/menu");
await ready();
ok(await p.locator("text=Адрес можно поменять").count() === 1, "note: address can be changed");
const site = await download();
ok(/^HTTPS?:\/\/[^/]+\/K\/[A-Z2-9]{6}$/.test(site ?? ""), `site code holds our short link: ${site}`);
const h1 = await hop(site);
ok(h1.status === 307 && h1.to === "https://example.com/menu", `scan → straight to the site in one hop (${h1.status} ${h1.to})`);
ok((await download()) === site, "same address again — same code, same short link");

// Звонок
await p.getByRole("radio", { name: "Телефон", exact: true }).click();
await p.getByLabel("Номер телефона").fill("+374 91 123456");
await ready();
const tel = await download();
const h2 = await hop(tel);
ok(tel !== site && h2.status === 307 && h2.to === "tel:+37491123456", `phone code → tel: (${h2.to})`);

// Текст — страница кода, видна всем
await p.getByRole("radio", { name: "Текст", exact: true }).click();
await p.getByLabel("Текст").fill("Сбор у входа в 10:00");
await ready();
const text = await download();
const h3 = await hop(text);
ok(h3.status === 307 && /^\/c\/\w+$/.test(h3.to ?? ""), `text code → our page (${h3.to})`);
const guest = await (await browser.newContext({ locale: "ru-RU" })).newPage();
await guest.goto(B + h3.to);
await guest.waitForSelector("text=Сбор у входа в 10:00", { timeout: 15000 }).then(() => ok(true, "guest sees the text"), () => ok(false, "guest sees the text"));

// Wi-Fi — прямо в коде, красивый вид нельзя
await p.getByRole("radio", { name: "Wi-Fi", exact: true }).click();
await p.getByLabel("Название сети").fill("Dacha");
await p.getByLabel("Пароль").fill("secret123");
await ready();
ok(await p.locator("text=Напрямую в телефон").count() === 1, "wifi note: straight to the phone");
const wifi = await download();
ok(wifi === "WIFI:T:WPA;S:Dacha;P:secret123;;", `wifi stays in the code: ${wifi}`);
await p.getByRole("radio", { name: "Звёзды", exact: true }).click();
await p.waitForSelector("text=только в простом виде. Выберите");
ok(await p.getByRole("button", { name: /Скачать PNG/ }).isDisabled(), "styled wifi cannot be downloaded");
await p.screenshot({ path: out + "r-wifi-styled.png", fullPage: true });

// Коды появились в «Мои коды»
const mine = (await (await p.request.get(B + "/api/codes")).json()).mine;
ok(mine.some((c) => c.kind === "link" && c.target === "https://example.com/menu") && mine.some((c) => c.kind === "link" && c.target === "tel:+37491123456"), "codes are in My codes");
ok(mine.filter((c) => c.target === "https://example.com/menu").length === 1, "no duplicates");
console.log("errors:", errors.length ? errors : "none");
await browser.close();
process.exit(errors.length ? 1 : 0);
