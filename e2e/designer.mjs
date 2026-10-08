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

const p = await mk(1280);
await p.goto(B + "/login?next=/");
await p.getByRole("button", { name: /Наре/ }).click();
await p.waitForURL(B + "/");
await p.waitForSelector("text=Опубликовать в маркет");
// нечитаемое сочетание — публикация не проходит
await p.getByRole("tab", { name: "Форма", exact: true }).click();
await p.getByRole("radiogroup", { name: "Углы: рамка" }).getByRole("radio", { name: "Как точки" }).click();
await p.getByRole("radiogroup", { name: "Углы: центр" }).getByRole("radio", { name: "Звезда" }).click();
await p.getByLabel("Название дизайна", { exact: true }).fill("Плохой");
await p.getByRole("button", { name: "Опубликовать" }).click();
await p.waitForSelector("text=Код плохо читается — поправьте");
ok(true, "unreadable design rejected");
// хорошее оформление
await p.getByRole("radiogroup", { name: "Углы: рамка" }).getByRole("radio", { name: "Круг", exact: true }).click();
await p.getByRole("radiogroup", { name: "Углы: центр" }).getByRole("radio", { name: "В пару" }).click();
await p.getByRole("tab", { name: "Фон", exact: true }).click();
await p.getByRole("radio", { name: "Бетон", exact: true }).click();
await p.getByRole("tab", { name: "Форма", exact: true }).click();
await p.getByRole("radio", { name: "Звёзды", exact: true }).click();
await p.getByLabel("Название дизайна", { exact: true }).fill("Бетон и звёзды");
await p.getByLabel("Описание (необязательно)").fill("Серый бетон и звёзды — для мастерских и лофтов.");
await p.getByLabel("Цена, $").fill("6");
await p.getByRole("radio", { name: "С номерами" }).click();
await p.getByLabel("Сколько штук в тираже").fill("20");
await p.getByLabel("Сделать дропом дня").check();
await p.getByLabel(/№ 1 — на аукцион/).check();
await shot(p, "d-1280-publish");
await p.getByRole("button", { name: "Опубликовать" }).click();
await p.waitForSelector("text=Опубликовано");
await p.getByRole("link", { name: "открыть в маркете" }).click();
await p.waitForSelector("text=Дизайн: Наре");
await shot(p, "d-1280-design");
await p.goto(B + "/market", { waitUntil: "networkidle" });
await p.waitForSelector("text=Осталось 19 из 20");
const dropBox = (pg) => pg.locator("section:has-text('Дроп дня')").first();
ok((await dropBox(p).innerText()).includes("Бетон и звёзды"), "new design is the drop");
ok(await p.locator("text=Туманность").count() > 0, "old drop moved into the grid");
ok(await p.locator("text=Осталось 19 из 20").count() > 0, "№ 1 already taken by the auction");
ok(await p.locator("text=/Бетон и звёзды.*№ 1/").count() > 0 || (await p.getByRole("link", { name: /Бетон и звёзды/ }).count()) > 1, "№ 1 of the new drop is on auction");
await shot(p, "d-1280-market");
// Арман покупает № 1 / 20
const a = await mk(390);
await a.goto(B + "/login?next=/market");
await a.getByRole("button", { name: /Арман/ }).click();
await a.waitForURL(/market/);
await a.goto(B + (await dropBox(a).getByRole("link", { name: "Подробнее" }).getAttribute("href")), { waitUntil: "networkidle" });
await a.getByRole("button", { name: /Купить — \$6/ }).click();
await a.waitForSelector("text=№ 2 / 20");
ok(true, "bought #2/20 (#1 is on auction)");
await shot(a, "d-390-bought");
// дизайнер снимает с продажи
const href = await dropBox(p).getByRole("link", { name: "Подробнее" }).getAttribute("href");
await p.goto(B + href, { waitUntil: "networkidle" });
await p.getByRole("button", { name: "Снять с продажи" }).click();
await p.waitForURL(B + "/market");
await p.waitForSelector("text=Туманность");
// Лоты подгружаются отдельно — ждём, пока исчезнет и аукцион № 1 (до 10 с).
await p.waitForFunction(() => !document.body.innerText.includes("Бетон и звёзды"), null, { timeout: 10000 }).catch(() => {});
ok(!(await p.locator("text=Бетон и звёзды").count()), "unpublished design gone (and its № 1 auction without bids); nebula is drop again");
console.log("errors:", errors.length ? errors : "none");
await browser.close();
