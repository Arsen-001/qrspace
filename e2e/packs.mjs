// Пакеты кодов в маркете (владелец 08.10.2026): купил пакет — коды скачиваются без оплаты, под каждым место пакета.
import { chromium } from "playwright";
const out = new URL("./out/", import.meta.url).pathname;
const B = "http://localhost:3720";
const browser = await chromium.launch();
const errors = [];
const ok = (c, m) => { console.log(c ? "  ✓" : "  ✗", m); if (!c) errors.push(m); };
const ready = (p) => p.waitForFunction(() => /Код читается/.test(document.body.innerText), null, { timeout: 30000 });

for (const w of [1280, 390]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: 900 }, locale: "ru-RU", acceptDownloads: true });
  const p = await ctx.newPage();
  p.on("pageerror", (e) => errors.push(e.message));
  await p.goto(B + "/market", { waitUntil: "networkidle" });
  await p.getByText("Сразу несколько кодов — выгоднее").scrollIntoViewIfNeeded();
  await p.waitForTimeout(300);
  await p.locator("section[aria-labelledby=packs-title]").screenshot({ path: `${out}pk-${w}-market.png` });
  ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${w}: no horizontal scroll`);
  await ctx.close();
}

const ctx = await browser.newContext({ viewport: { width: 390, height: 900 }, locale: "ru-RU", acceptDownloads: true });
const p = await ctx.newPage();
p.on("pageerror", (e) => errors.push(e.message));
p.on("console", (m) => m.type() === "error" && !/401/.test(m.text()) && errors.push(m.text()));
// Гость: «Купить пакет» → окно входа → после входа пакет куплен
await p.goto(B + "/market", { waitUntil: "networkidle" });
await p.getByRole("button", { name: /Купить пакет: 5 кодов, 10 MB/ }).click();
await p.getByRole("dialog").getByRole("button", { name: /Лилит/ }).click();
await p.waitForSelector("text=Пакет ваш");
ok(true, "guest signs in and the pack is bought");
await p.waitForSelector("text=Осталось в ваших пакетах");
ok((await p.locator("text=Осталось в ваших пакетах").textContent()).includes("5"), "5 codes left");
// Первый простой — бесплатно, как и было
await p.goto(B + "/", { waitUntil: "networkidle" });
await p.getByLabel("Адрес сайта").fill("example.com/pack-free");
await ready(p);
await p.getByRole("button", { name: /Скачать PNG/ }).click();
await p.waitForSelector("text=Ваш первый простой код — бесплатно");
await Promise.all([p.waitForEvent("download"), p.getByRole("button", { name: "Скачать бесплатно" }).click()]);
ok(true, "first simple code is still free (pack untouched)");
// Красивый — из пакета, без оплаты
await p.getByLabel("Адрес сайта").fill("example.com/pack-styled");
await p.getByRole("tab", { name: "Форма", exact: true }).click();
await p.getByRole("radio", { name: "Звёзды", exact: true }).click();
await ready(p);
await p.getByRole("button", { name: /Скачать PNG/ }).click();
await p.waitForSelector("text=Код из пакета");
ok((await p.getByRole("dialog", { name: /К оплате/ }).innerText()).includes("10 MB"), "pay box: from pack, 10 MB under the code");
await p.screenshot({ path: `${out}pk-390-download.png` });
await Promise.all([p.waitForEvent("download"), p.getByRole("button", { name: "Скачать из пакета" }).click()]);
ok(true, "styled code downloaded from the pack");
const r = await p.evaluate(async () => {
  const packs = await fetch("/api/packs").then((x) => x.json());
  const list = await fetch("/api/codes").then((x) => x.json());
  const c = list.mine.find((x) => x.content?.fields?.url?.includes("pack-styled"));
  return { left: packs.left, quota: c?.storage?.quota };
});
ok(r.left === 4, `one code used — ${r.left} left`);
ok(r.quota === 10 * 1024 * 1024, `code from the pack has 10 MB (${r.quota})`);

console.log("errors:", errors.length ? errors : "none");
await browser.close();
process.exit(errors.length ? 1 : 0);
