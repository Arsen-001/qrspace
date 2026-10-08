// Код-ссылка: скан переадресует на адрес хозяина, адрес меняется (код тот же), сканы считаются; опасные адреса — нет.
import { chromium } from "playwright";
const out = new URL("./out/", import.meta.url).pathname;
const B = "http://localhost:3720";
const browser = await chromium.launch();
const errors = [];
const mk = async (w) => {
  const ctx = await browser.newContext({ viewport: { width: w, height: 900 }, locale: "ru-RU" });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(`${w} ${e.message}`));
  page.on("console", (m) => m.type() === "error" && !/400/.test(m.text()) && errors.push(`${w} ${m.text()}`));
  return page;
};
const shot = async (p, name) => { await p.waitForTimeout(300); await p.screenshot({ path: out + name + ".png", fullPage: true }); const o = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth); console.log(name, o ? `OVERFLOW ${o}` : "ok"); };
// Скан любого кода открывает нашу страницу с кнопками (владелец 08.10.2026) — считаем открытия страницы гостем.
let guestScans = 0;
const scan = async (p, id) => {
  await p.goto(`${B}/c/${id}`, { waitUntil: "networkidle" });
  guestScans += 1;
};
const openHref = (p) => p.locator("a:has-text('Открыть сайт')").getAttribute("href", { timeout: 10000 }).catch(() => null);
const ok = (c, m) => { console.log(c ? "  ✓" : "  ✗", m); if (!c) errors.push(m); };
const login = async (p, who, next) => { await p.goto(`${B}/login?next=${encodeURIComponent(next)}`); await p.getByRole("button", { name: new RegExp(who) }).click(); await p.waitForURL((u) => !u.pathname.startsWith("/login")); };

const a = await mk(1280);
// /codes?new=link — сразу форма с шаблоном «Ссылка»
await login(a, "Арман", "/codes?new=link");
await a.waitForURL(/\/codes\?new=link/);
ok((await a.getByRole("radio", { name: /^Ссылка/ }).getAttribute("aria-checked")) === "true", "/codes?new=link opens with «Link» chosen");
await a.getByLabel("Название кода").fill("Меню кафе");
await a.getByRole("button", { name: "Создать" }).click();
await a.waitForURL(/\/codes\/\w+/);
await a.waitForSelector("text=Что будет в коде");
const id = a.url().split("/").pop();
// Пока пусто — гость видит «ещё не настроил»
const g = await mk(390);
await scan(g, id);
await g.waitForSelector("text=Хозяин ещё не настроил");
ok(true, "nothing yet → «not set up yet»");
// Задаём сайт (без https — допишется сам)
await a.getByLabel("Адрес сайта").fill("menu.example.com/autumn");
await a.getByRole("button", { name: "Сохранить" }).click();
await a.waitForSelector("text=✓ Сохранено");
await scan(g, id);
ok((await openHref(g)) === "https://menu.example.com/autumn", "scan → our page with «Открыть сайт» to the owner's address");
// Короткая ссылка ведёт на нашу страницу кода
const short = await a.evaluate((i) => fetch(`/api/codes/${i}`).then((r) => r.json()).then((c) => c.short), id);
const k = await g.request.get(`${B}/K/${short}`, { maxRedirects: 0 });
ok(k.status() === 307 && k.headers()["location"] === `/c/${id}`, `short /K link → our page (${k.headers()["location"]})`);
// Меняем адрес — тот же код показывает новый
await a.getByLabel("Адрес сайта").fill("https://promo.example.com/");
await a.getByRole("button", { name: "Сохранить" }).click();
await a.waitForSelector("text=✓ Сохранено");
await scan(g, id);
ok((await openHref(g)) === "https://promo.example.com/", "changed address — same code shows the new one");
// Опасные адреса сервер не принимает
const patch = (body) => a.evaluate(([i, b]) => fetch(`/api/codes/${i}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(b) }).then((r) => r.status), [id, body]);
ok((await patch({ content: { type: "url", fields: { url: "javascript:alert(1)" } } })) === 400, "javascript: address refused (content)");
ok((await patch({ target: "javascript:alert(1)" })) === 400, "javascript: address refused (target)");
// Сканы посчитаны (каждое открытие страницы гостем; хозяина не считаем)
await a.reload({ waitUntil: "networkidle" });
await a.waitForSelector("text=Всего");
const total = await a.locator("dt:text('Всего') + dd").innerText();
// Каждый переход гостя — скан (включая ожидание сохранения); хозяина не считаем.
ok(total.trim() === String(guestScans), `stats: every guest scan counted, owner not (${total.trim()} = ${guestScans})`);
await shot(a, "lnk-1280-editor");
// Статистика у обычного кода с памятью
await a.goto(B + "/codes", { waitUntil: "networkidle" });
await a.getByRole("link", { name: /Wi/ }).last().click();
await a.getByRole("tab", { name: "Статистика" }).click();
await a.waitForSelector('svg[aria-label="Сканы по дням за 30 дней"]');
ok(true, "memory code has a Stats tab");
const m = await mk(390);
await login(m, "Арман", `/codes/${id}`);
await m.waitForSelector("text=Что будет в коде");
await shot(m, "lnk-390-editor");
console.log("errors:", errors.length ? errors : "none");
await browser.close();
