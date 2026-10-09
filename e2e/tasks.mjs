import { chromium } from "playwright";
const out = new URL("./out/", import.meta.url).pathname;
const B = "http://localhost:3720";
const browser = await chromium.launch();
const errors = [];
const mk = async (w, locale = "ru-RU") => {
  const ctx = await browser.newContext({ viewport: { width: w, height: 900 }, locale });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(`${w} ${e.message}`));
  page.on("console", (m) => m.type() === "error" && errors.push(`${w} ${m.text()}`));
  return page;
};
const shot = async (p, name) => { await p.waitForTimeout(300); await p.screenshot({ path: out + name + ".png", fullPage: true }); const o = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth); console.log(name, o ? `OVERFLOW ${o}` : "ok"); };
const ok = (c, m) => { console.log(c ? "  ✓" : "  ✗", m); if (!c) errors.push(m); };

const p = await mk(390);
await p.goto(B + "/login?next=/codes");
await p.getByRole("button", { name: /Арман/ }).click();
await p.waitForSelector("text=Что сделать");
const up = p.locator("section:has(h2:text('Что сделать'))");
ok(await up.locator("text=Проверить давление").count() === 1, "overdue boiler task listed");
ok(await up.locator("text=просрочено").count() === 1, "overdue marked");
ok(await up.locator("text=Полить фикус").count() === 1, "shared code task (edit) listed");
await shot(p, "r-390-codes");
await up.locator("li:has-text('Проверить давление')").getByRole("button", { name: /Сделано/ }).click();
await p.waitForFunction(() => !document.body.innerText.includes("Проверить давление"));
ok(true, "done → moved to next year, gone from upcoming");
// настройки котла: задачи с историей; добавить разовую
await p.getByRole("link", { name: /Котёл/ }).last().click();
await p.waitForSelector("text=Напоминания");
ok(await p.locator("li:has-text(\"Каждый год\")").count() === 1, "yearly task still there (next year)");
await p.getByLabel("Что сделать", { exact: true }).fill("Вызвать мастера на осмотр");
await p.getByRole("button", { name: "+ Добавить" }).click();
await p.waitForSelector("text=Вызвать мастера на осмотр");
await shot(p, "r-390-editor");
await p.locator("li:has-text('Вызвать мастера')").getByRole("button", { name: /Сделано/ }).click();
await p.waitForFunction(() => !document.body.innerText.includes("Вызвать мастера"));
ok(true, "one-time task disappears after done");
const boiler = p.url().replace("/codes/", "/c/");
// Давид (смотрит): видит напоминания без кнопок
const d = await mk(390);
await d.goto(B + "/login?next=" + encodeURIComponent(boiler.replace(B, "")));
await d.getByRole("button", { name: /Давид/ }).click();
await d.waitForSelector("text=Почистить фильтр");
ok(await d.getByRole("button", { name: /Сделано/ }).count() === 0, "viewer has no Done buttons");
await shot(d, "r-390-viewer");
// армянский
const h = await mk(1280, "hy-AM");
await h.goto(B + "/login?next=/codes");
await h.getByRole("button", { name: /Արման/ }).click();
await h.waitForSelector("text=Ինչ անել");
await shot(h, "r-1280-hy-codes");
console.log("errors:", errors.length ? errors : "none");
await browser.close();
