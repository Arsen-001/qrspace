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
  await p.getByText("Сразу несколько кодов — про запас").scrollIntoViewIfNeeded();
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
await p.getByRole("button", { name: /Купить пакет: 5 кодов, 1 MB/ }).click();
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
ok((await p.getByRole("dialog", { name: /К оплате/ }).innerText()).includes("1 MB"), "pay box: from pack, 1 MB under the code");
await p.screenshot({ path: `${out}pk-390-download.png` });
await Promise.all([p.waitForEvent("download"), p.getByRole("button", { name: "Скачать из пакета" }).click()]);
ok(true, "styled code downloaded from the pack");
const r = await p.evaluate(async () => {
  const packs = await fetch("/api/packs").then((x) => x.json());
  const list = await fetch("/api/codes").then((x) => x.json());
  const c = list.mine.find((x) => x.content?.fields?.url?.includes("pack-styled"));
  return { left: packs.left, id: c?.id, quota: c?.storage?.quota };
});
ok(r.left === 4, `one code used — ${r.left} left`);
ok(r.quota === 1024 * 1024, `code from the pack has 1 MB (${r.quota})`);
// Место под кодом — помесячно, можно поменять (владелец 09.10.2026): 100 МБ на месяц, продлить, обратно 1 МБ
const post = (plan) => p.evaluate(([id, plan]) => fetch(`/api/codes/${id}/storage`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ plan }) }).then(async (x) => ({ status: x.status, body: await x.json() })), [r.id, plan]);
const day = 24 * 3600 * 1000;
const a1 = await post("s100");
ok(a1.body.storage?.quota === 100 * 1024 * 1024 && a1.body.storage.plan === "s100", "switched to 100 MB");
const left1 = (Date.parse(a1.body.storage.until) - Date.now()) / day;
ok(left1 > 29 && left1 <= 30, `paid for a month (${left1.toFixed(1)} days)`);
const a2 = await post("s100");
ok((Date.parse(a2.body.storage.until) - Date.now()) / day > 59, "same plan again — renewed for one more month");
const a3 = await post("free");
ok(a3.body.storage?.quota === 1024 * 1024 && a3.body.storage.plan === null && a3.body.storage.until === null, "back to free 1 MB");
// Экран: «Изменить место» в памяти кода
await p.goto(B + `/codes/${r.id}`, { waitUntil: "networkidle" });
const mem = p.getByRole("tab", { name: /Память/ });
if (await mem.count()) await mem.first().click();
await p.getByRole("button", { name: "Изменить место" }).click();
await p.getByRole("button", { name: /10 MB — \$1 \/ мес/ }).click();
await p.waitForSelector("text=оплачено до");
ok(true, "owner changes space on screen — paid-until date shown");
await p.getByRole("button", { name: "Изменить место" }).click();
await p.screenshot({ path: `${out}pk-390-storage.png`, fullPage: true });

console.log("errors:", errors.length ? errors : "none");
await browser.close();
process.exit(errors.length ? 1 : 0);
