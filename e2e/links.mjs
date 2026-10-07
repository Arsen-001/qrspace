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
// Куда сервер отправляет по ссылке (сам переход на чужой сайт не делаем).
let guestScans = 1; // первый — гость увидел «не настроено»
const where = async (p, path) => {
  const r = await p.request.get(B + path, { maxRedirects: 0 });
  if (/^\/(c|K)\//.test(path)) guestScans += 1; // каждый переход гостя по /c и /K — это скан
  return r.status() === 307 || r.status() === 308 ? r.headers()["location"] : `${r.status()}`;
};
// Ждём, пока сервер сохранит адрес: интерфейс показывает новый адрес сразу, ещё до ответа сервера.
const whereSoon = async (p, path, want) => {
  for (let i = 0; i < 40; i++) {
    const w = await where(p, path);
    if (w === want) return w;
    await p.waitForTimeout(250);
  }
  return where(p, path);
};
const ok = (c, m) => { console.log(c ? "  ✓" : "  ✗", m); if (!c) errors.push(m); };
const login = async (p, who, next) => { await p.goto(`${B}/login?next=${encodeURIComponent(next)}`); await p.getByRole("button", { name: new RegExp(who) }).click(); await p.waitForURL((u) => !u.pathname.startsWith("/login")); };

const a = await mk(1280);
// /codes?new=link — сразу форма с шаблоном «Ссылка» (генератор теперь сам делает код-ссылку — e2e/redirect.mjs)
await login(a, "Арман", "/codes?new=link");
await a.waitForURL(/\/codes\?new=link/);
ok((await a.getByRole("radio", { name: /^Ссылка/ }).getAttribute("aria-checked")) === "true", "/codes?new=link opens with «Link» chosen");
await a.getByLabel("Название кода").fill("Меню кафе");
await a.getByRole("button", { name: "Создать" }).click();
await a.waitForURL(/\/codes\/\w+/);
await a.waitForSelector("text=Куда ведёт код");
const id = a.url().split("/").pop();
// Пока адреса нет — гость видит «ещё не настроено»
const g = await mk(390);
await g.goto(`${B}/c/${id}`, { waitUntil: "networkidle" });
await g.waitForSelector("text=Хозяин ещё не настроил");
ok(true, "no address yet → «not set up yet»");
// Задаём адрес (без https — допишется сам)
await a.getByLabel("Куда ведёт код").fill("menu.example.com/autumn");
await a.getByRole("button", { name: "Сохранить" }).click();
await a.waitForSelector("text=Сейчас ведёт на");
ok((await whereSoon(g, `/c/${id}`, "https://menu.example.com/autumn")) === "https://menu.example.com/autumn", "scan redirects to the owner's address");
// Короткая ссылка тоже
const short = await a.evaluate((i) => fetch(`/api/codes/${i}`).then((r) => r.json()).then((c) => c.short), id);
ok((await where(g, `/K/${short}`)) === "https://menu.example.com/autumn", "short /K link goes straight to the owner's address (one hop)");
// Меняем адрес — тот же код ведёт на новый
await a.getByLabel("Куда ведёт код").fill("https://promo.example.com/");
await a.getByRole("button", { name: "Сохранить" }).click();
await a.waitForSelector("text=promo.example.com");
ok((await whereSoon(g, `/c/${id}`, "https://promo.example.com/")) === "https://promo.example.com/", "changed address — same code leads to the new one");
// Опасные адреса сервер не принимает
const bad = await a.evaluate((i) => fetch(`/api/codes/${i}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ target: "javascript:alert(1)" }) }).then((r) => r.status), id);
ok(bad === 400, "javascript: address refused");
// Сканы посчитаны (3 перехода гостя; хозяина не считаем)
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
await m.waitForSelector("text=Куда ведёт код");
await shot(m, "lnk-390-editor");
console.log("errors:", errors.length ? errors : "none");
await browser.close();
