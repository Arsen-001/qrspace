// Номерные коды: поиск номера, цена по редкости, покупка, «занят», сертификат, перепродажа на аукционе.
import { chromium } from "playwright";
const out = new URL("./out/", import.meta.url).pathname;
const B = "http://localhost:3720";
const browser = await chromium.launch();
const errors = [];
const mk = async (w) => {
  const ctx = await browser.newContext({ viewport: { width: w, height: 900 }, locale: "ru-RU" });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(`${w} ${e.message}`));
  page.on("console", (m) => m.type() === "error" && !/409|400/.test(m.text()) && errors.push(`${w} ${m.text()}`));
  return page;
};
const shot = async (p, name) => { await p.waitForTimeout(300); await p.screenshot({ path: out + name + ".png", fullPage: true }); const o = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth); console.log(name, o ? `OVERFLOW ${o}` : "ok"); };
const ok = (c, m) => { console.log(c ? "  ✓" : "  ✗", m); if (!c) errors.push(m); };
const login = async (p, who, next) => { await p.goto(`${B}/login?next=${encodeURIComponent(next)}`); await p.getByRole("button", { name: new RegExp(who) }).click(); await p.waitForURL((u) => !u.pathname.startsWith("/login")); };

// Гость видит витрину и цены
const g = await mk(390);
await g.goto(B + "/market", { waitUntil: "networkidle" });
await g.getByRole("link", { name: /Миллион номеров/ }).click();
await g.waitForSelector("text=Красивые номера");
await shot(g, "num-390-guest");
await g.getByLabel("Номер").fill("7");
await g.getByRole("button", { name: "Проверить" }).click();
await g.waitForSelector("text=Легенда");
await g.waitForSelector("text=Войдите, чтобы купить", { timeout: 10000 }).catch(() => {});
ok(await g.getByRole("link", { name: "Войдите, чтобы купить" }).count() === 1, "guest: number 7 is a legend, sign in to buy");

// Арман покупает № 777
const a = await mk(1280);
await login(a, "Арман", "/numbers");
await a.getByLabel("Номер").fill("777");
await a.getByRole("button", { name: "Проверить" }).click();
await a.waitForSelector("text=Красивый");
await a.getByRole("button", { name: "Купить — $30" }).click();
await a.waitForURL(/\/codes\/\w+/);
await a.waitForSelector("text=Номерной код");
ok(await a.getByRole("textbox", { name: "Название" }).inputValue() === "№ 777", "bought: code titled «№ 777»");
await shot(a, "num-1280-bought");
// Сертификат с номером
await a.getByRole("link", { name: /Сертификат подлинности/ }).click();
await a.waitForSelector("text=/ 1 000 000");
ok(true, "certificate shows № 777 / 1 000 000");

// Второй покупатель: номер занят
const l = await mk(390);
await login(l, "Лилит", "/numbers");
await l.getByLabel("Номер").fill("777");
await l.getByRole("button", { name: "Проверить" }).click();
await l.waitForSelector("text=Занят — хозяин: Арман");
ok(await l.getByRole("button", { name: /Купить/ }).count() === 0, "taken number can't be bought twice");
const twice = await l.evaluate(() => fetch("/api/numbers", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ n: 777 }) }).then((r) => r.status));
ok(twice === 409, "server refuses a second sale of the same number");
const bad = await l.evaluate(() => fetch("/api/numbers", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ n: 1000001 }) }).then((r) => r.status));
ok(bad === 400, "numbers above 1 000 000 are refused");

// Арман выставляет № 777 на аукцион, Лилит ставит, Арман завершает → номер у Лилит
await a.goBack();
await a.getByLabel("Стартовая ставка").fill("50");
await a.getByRole("button", { name: "Выставить" }).click();
await a.waitForSelector("text=Выставлен");
await l.goto(B + "/market", { waitUntil: "networkidle" });
await l.getByRole("link", { name: /№ 777/ }).first().click();
await l.getByRole("button", { name: /Сделать ставку/ }).click();
await l.waitForSelector("text=Ваша ставка — лучшая");
const lot = l.url();
await a.goto(lot, { waitUntil: "networkidle" });
await a.getByRole("button", { name: /Завершить аукцион сейчас/ }).click();
await a.waitForSelector("text=Продано: Лилит");
await l.goto(B + "/numbers", { waitUntil: "networkidle" });
await l.getByLabel("Номер").fill("777");
await l.getByRole("button", { name: "Проверить" }).click();
await l.waitForSelector("text=Это ваш номер");
ok(true, "after auction the number belongs to the winner");
console.log("errors:", errors.length ? errors : "none");
await browser.close();
