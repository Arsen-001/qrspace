// Жалобы и блокировка: гость жалуется, администратор блокирует, скан показывает «заблокирован», ссылка никуда не ведёт.
import { chromium } from "playwright";
const out = new URL("./out/", import.meta.url).pathname;
const B = "http://localhost:3720";
const browser = await chromium.launch();
const errors = [];
const mk = async (w) => {
  const ctx = await browser.newContext({ viewport: { width: w, height: 900 }, locale: "ru-RU" });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(`${w} ${e.message}`));
  page.on("console", (m) => m.type() === "error" && !/403/.test(m.text()) && errors.push(`${w} ${m.text()}`));
  return page;
};
const shot = async (p, name) => { await p.waitForTimeout(300); await p.screenshot({ path: out + name + ".png", fullPage: true }); const o = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth); console.log(name, o ? `OVERFLOW ${o}` : "ok"); };
const ok = (c, m) => { console.log(c ? "  ✓" : "  ✗", m); if (!c) errors.push(m); };
const login = async (p, who, next) => { await p.goto(`${B}/login?next=${encodeURIComponent(next)}`); await p.getByRole("button", { name: new RegExp(who) }).click(); await p.waitForURL((u) => !u.pathname.startsWith("/login")); };

// Хозяин: код «Wi‑Fi для гостей» (открыт всем) и код-ссылка
const a = await mk(1280);
await login(a, "Арман", "/codes");
await a.getByRole("link", { name: /Wi/ }).last().click();
await a.waitForURL(/\/codes\/\w+/);
const wifi = a.url().split("/").pop();
const link = await a.evaluate(async () => {
  const c = await fetch("/api/codes", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ title: "Акция", kind: "link", style: null }) }).then((r) => r.json());
  await fetch(`/api/codes/${c.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ target: "https://bank-login.example.com/" }) });
  return c.id;
});
// Обычный человек не попадает в кабинет администратора
ok((await a.evaluate(() => fetch("/api/admin").then((r) => r.status))) === 403, "non-admin can't open the admin API");
// Гость жалуется на оба
const g = await mk(390);
await g.goto(`${B}/c/${wifi}`, { waitUntil: "networkidle" });
await g.getByRole("button", { name: "Пожаловаться на этот код" }).click();
await g.getByRole("radio", { name: "Спам" }).click();
await g.getByLabel("Что не так (необязательно)").fill("Чужая реклама");
await g.getByRole("button", { name: "Отправить жалобу" }).click();
await g.waitForSelector("text=Жалоба отправлена");
await shot(g, "mod-390-reported");
const r2 = await g.evaluate((id) => fetch(`/api/codes/${id}/report`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ reason: "phishing", text: "Похоже на поддельный банк" }) }).then((r) => r.status), link);
ok(r2 === 200, "report on a link code accepted");
// Администратор
const ad = await mk(1280);
await login(ad, "Администратор", "/admin");
await ad.waitForSelector("text=Жалобы");
ok(await ad.getByRole("link", { name: "Админ", exact: true }).count() === 1, "admin sees the Admin nav item");
ok(await ad.locator("text=→ https://bank-login.example.com/").count() === 1, "admin sees where the link code leads");
await shot(ad, "mod-1280-admin");
await ad.locator("li:has-text('Похоже на поддельный банк')").getByRole("button", { name: "Заблокировать код" }).click();
await ad.waitForSelector("text=⛔ заблокирован");
// Ссылка больше не ведёт на подделку
const res = await g.request.get(`${B}/c/${link}`, { maxRedirects: 0 });
ok(res.status() === 200, `blocked link code doesn't redirect (status ${res.status()})`);
await g.goto(`${B}/c/${link}`, { waitUntil: "networkidle" });
await g.waitForSelector("text=Код заблокирован");
await shot(g, "mod-390-blocked");
// Хозяин видит, что код заблокирован, и получил уведомление
const n = await a.evaluate(() => fetch("/api/notifications").then((r) => r.json()));
ok(n.items.some((x) => x.kind === "codeBlocked"), "owner notified about the block");
await a.goto(`${B}/codes/${link}`, { waitUntil: "networkidle" });
await a.waitForSelector("text=Код заблокирован администратором");
ok(true, "owner sees the block banner");
// Жалобу на Wi‑Fi отклоняем — код работает
await ad.locator("li:has-text('Чужая реклама')").getByRole("button", { name: "Отклонить" }).click();
await ad.waitForSelector("text=отклонена");
await g.goto(`${B}/c/${wifi}`, { waitUntil: "networkidle" });
ok(await g.locator("text=Код заблокирован").count() === 0, "dismissed report leaves the code working");
// Разблокировать
await ad.locator("li:has-text('Похоже на поддельный банк')").getByRole("button", { name: "Разблокировать" }).click();
await ad.waitForTimeout(500);
const res2 = await g.request.get(`${B}/c/${link}`, { maxRedirects: 0 });
ok(res2.status() === 307, "unblocked link code redirects again");
console.log("errors:", errors.length ? errors : "none");
await browser.close();
