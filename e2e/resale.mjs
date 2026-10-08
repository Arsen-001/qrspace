import { chromium } from "playwright";
const out = new URL("./out/", import.meta.url).pathname;
const B = "http://localhost:3720";
const browser = await chromium.launch();
const errors = [];
const mk = async (w) => {
  const ctx = await browser.newContext({ viewport: { width: w, height: 900 }, locale: "ru-RU" });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(`${w} ${e.message}`));
  page.on("console", (m) => m.type() === "error" && errors.push(`${w} ${m.text()}`));
  return page;
};
const shot = async (p, name) => { await p.waitForTimeout(300); await p.screenshot({ path: out + name + ".png", fullPage: true }); const o = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth); console.log(name, o ? `OVERFLOW ${o}` : "ok"); };
const ok = (c, m) => { console.log(c ? "  ✓" : "  ✗", m); if (!c) errors.push(m); };
const login = async (p, who, next) => { await p.goto(`${B}/login?next=${encodeURIComponent(next)}`); await p.getByRole("button", { name: new RegExp(who) }).click(); await p.waitForURL((u) => !u.pathname.startsWith("/login")); };

const l = await mk(390);
await l.goto(B + "/market", { waitUntil: "networkidle" });
await l.waitForSelector("text=Перепродажа и аукционы");
await shot(l, "x-390-market");
await login(l, "Лилит", "/market");
await l.getByRole("link", { name: /Пергамент № 12/ }).click();
await l.waitForSelector("text=Купить — $40");
await shot(l, "x-390-lot-fixed");
await l.getByRole("button", { name: "Купить — $40" }).click();
await l.waitForSelector("text=Продано:");
ok(await l.locator("text=Продано: вы — $40").count() === 1, "Lilit bought parchment for $40");
ok(await l.locator("section:has(h2:text('Владельцы')) >> text=Ани").count() === 1, "owners history shows Ani");
// аукцион: ставка Лилит
await l.goto(B + "/market", { waitUntil: "networkidle" });
await l.getByRole("link", { name: /Туманность № 3/ }).click();
await l.waitForSelector("text=Сделать ставку — $27");
await l.getByRole("button", { name: /Сделать ставку/ }).click();
await l.waitForSelector("text=Ваша ставка — лучшая");
const lotUrl = l.url();
await shot(l, "x-390-lot-auction");
// продавец Давид завершает
const d = await mk(1280);
await login(d, "Давид", lotUrl.replace(B, ""));
await d.waitForSelector("text=Завершить аукцион сейчас");
await d.getByRole("button", { name: /Завершить аукцион сейчас/ }).click();
await d.waitForSelector("text=Продано: Лилит — $27");
ok(true, "auction ended, Lilit won at $27");
// у Лилит оба кода, чистые
await l.goto(B + "/codes", { waitUntil: "networkidle" });
await l.waitForSelector("text=№ 12 / 100");
ok(await l.locator("text=№ 3 / 30").count() === 1, "both codes are Lilit's now");
await shot(l, "x-390-lilit-codes");
// Арман покупает дизайн и выставляет на аукцион
const a = await mk(1280);
await login(a, "Арман", "/market/nebula");
await a.getByRole("button", { name: /Купить — \$15/ }).click();
await a.waitForSelector("text=Продать");
await a.getByLabel("Стартовая ставка").fill("30");
await a.getByRole("button", { name: /Сколько длится аукцион/ }).click();
await a.getByRole("option", { name: "1 час" }).click();
await a.getByRole("button", { name: "Выставить" }).click();
await a.waitForSelector("text=Выставлен");
await shot(a, "x-1280-sell");
await a.getByRole("link", { name: "открыть лот" }).click();
await a.waitForSelector("text=Снять с продажи");
await a.getByRole("button", { name: "Снять с продажи" }).click();
await a.waitForSelector("text=Лот закрыт");
ok(true, "seller can cancel a lot without bids");
console.log("errors:", errors.length ? errors : "none");
await browser.close();
