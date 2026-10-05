import http from "node:http";
import { chromium } from "playwright";
const out = new URL("./out/", import.meta.url).pathname;
const B = "http://localhost:3720";
const mock = http.createServer((req, res) => { let body = ""; req.on("data", (c) => (body += c)); req.on("end", () => { const info = JSON.parse(Buffer.from(new URLSearchParams(body).get("code"), "base64url").toString()); const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url"); res.writeHead(200, { "content-type": "application/json" }); res.end(JSON.stringify({ id_token: `${b64({})}.${b64({ iss: "https://accounts.google.com", aud: "test-client.apps.googleusercontent.com", sub: info.sub, exp: Math.floor(Date.now() / 1000) + 600, nonce: info.nonce, email: info.email, email_verified: true, name: info.name })}.x` })); }); }).listen(3799);
const browser = await chromium.launch();
const errors = [];
const ok = (c, m) => { console.log(c ? "  ✓" : "  ✗", m); if (!c) errors.push(m); };
const shot = async (p, name) => { await p.waitForTimeout(300); await p.screenshot({ path: out + name + ".png", fullPage: true }); const o = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth); if (o) errors.push(`${name} overflow ${o}`); };
const page = async (w = 1280, perms) => { const ctx = await browser.newContext({ viewport: { width: w, height: 900 }, locale: "ru-RU", ...(perms && { permissions: ["geolocation"], geolocation: { latitude: 40.1792, longitude: 44.4991 } }) }); const p = await ctx.newPage(); p.on("pageerror", (e) => errors.push(e.message)); return p; };
const demo = async (who, next = "/codes", w) => { const p = await page(w); await p.goto(`${B}/login?next=${encodeURIComponent(next)}`); await p.getByRole("button", { name: new RegExp(who) }).click(); await p.waitForURL((u) => !u.pathname.startsWith("/login")); return p; };
const google = async (email, name, sub) => { const p = await page(390); await p.goto(`${B}/login`); const r = await p.request.get(B + (await p.getByRole("link", { name: "Войти через Google" }).getAttribute("href")), { maxRedirects: 0 }); const u = new URL(r.headers()["location"]); const code = Buffer.from(JSON.stringify({ nonce: u.searchParams.get("nonce"), email, name, sub })).toString("base64url"); await p.goto(`${u.searchParams.get("redirect_uri")}?state=${u.searchParams.get("state")}&code=${code}`); await p.waitForURL(/codes/); return p; };

// профиль и удаление аккаунта
const m = await google("mariam@gmail.com", "Мариам", "g-1");
await m.getByRole("button", { name: /Новый код/ }).click();
await m.getByLabel("Название кода").fill("Удалится");
await m.getByRole("button", { name: "Создать" }).click();
await m.waitForURL(/codes\/\w+/);
await m.goto(B + "/profile", { waitUntil: "networkidle" });
await m.waitForSelector("text=Google · mariam@gmail.com");
await m.getByLabel("Ваше имя").fill("Мариам А.");
await m.getByRole("button", { name: "Сохранить" }).click();
await m.waitForSelector("text=Сохранено");
await shot(m, "q-profile-390");
await m.getByRole("button", { name: "Удалить аккаунт" }).click();
await m.getByRole("button", { name: "Да, удалить навсегда" }).click();
await m.waitForURL(B + "/");
const me = await m.evaluate(() => fetch("/api/me").then((r) => r.json()));
ok(me.me === null && !me.people.some((x) => x.name.ru.startsWith("Мариам")), "account deleted, signed out, name gone");
const again = await google("mariam@gmail.com", "Мариам", "g-1");
await again.waitForSelector("text=Кодов пока нет");
ok(true, "signing in again starts a fresh account (old codes gone)");

// маленький код
const a = await demo("Арман");
await a.getByRole("link", { name: /Бублик/ }).click();
await a.waitForURL(/codes\/\w+/);
await a.getByRole("tab", { name: /Вид кода/ }).click();
await a.waitForFunction(() => /Код читается/.test(document.body.innerText), null, { timeout: 30000 });
const before = await a.locator('svg[width="420"]').first().getAttribute("viewBox");
await a.getByRole("switch", { name: /Маленький код/ }).check({ force: true });
await a.waitForFunction(() => /Код читается/.test(document.body.innerText), null, { timeout: 30000 });
await a.waitForTimeout(500);
const after = await a.locator('svg[width="420"]').first().getAttribute("viewBox");
console.log("  viewBox", before, "→", after);
ok(before !== after, "small code has fewer modules");
const short = await a.evaluate(() => fetch(location.pathname.replace("/codes/", "/api/codes/")).then((r) => r.json()).then((c) => c.short));
const g = await page(390);
await g.goto(`${B}/K/${short}`, { waitUntil: "networkidle" });
await g.waitForSelector("text=Бублик, 3 года");
ok(/\/c\//.test(g.url()), "/K/<short> opens the code page");
await g.goto(`${B}/K/${short.toLowerCase()}`, { waitUntil: "networkidle" });
ok(/\/c\//.test(g.url()), "lowercase short link works too");

// расписание номера
await a.goto(B + "/codes", { waitUntil: "networkidle" });
await a.getByRole("link", { name: /Моя машина/ }).click();
await a.waitForSelector("text=Сообщения через нас");
await a.getByRole("switch", { name: /Показывать мой номер/ }).check({ force: true });
await a.waitForSelector("text=По расписанию");
await a.getByRole("switch", { name: /По расписанию/ }).check({ force: true });
const now = new Date();
const hh = (d) => String(d).padStart(2, "0");
// окно, которое сейчас закрыто: начинается через 2 часа
await a.getByLabel("С", { exact: true }).fill(`${hh((now.getHours() + 2) % 24)}:00`);
await a.getByLabel("До", { exact: true }).fill(`${hh((now.getHours() + 3) % 24)}:00`);
await a.waitForTimeout(1500);
await shot(a, "q-schedule");
const carScan = a.url().replace("/codes/", "/c/");
await g.goto(carScan, { waitUntil: "networkidle" });
ok(await g.locator("text=Позвонить владельцу").count() === 0, "outside schedule → number hidden");
await a.getByLabel("С", { exact: true }).fill(`${hh((now.getHours() + 23) % 24)}:00`);
await a.waitForTimeout(1500);
await g.reload({ waitUntil: "networkidle" });
ok(await g.locator("text=Позвонить владельцу").count() === 1, "inside schedule → number shown");

// место нашедшего
const f = await page(390, true);
await f.goto(carScan, { waitUntil: "networkidle" });
await f.getByRole("radio", { name: "Открыто окно" }).click();
await f.getByLabel(/Отправить, где я сейчас/).check();
await f.getByRole("button", { name: "Отправить" }).click();
await f.waitForSelector("text=Отправлено");
await a.reload();
await a.waitForSelector("text=Открыто окно");
const href = await a.getByRole("link", { name: /Где отсканировали/ }).first().getAttribute("href");
ok(href?.includes("40.1792,44.4991"), "owner gets the finder's place on a map");
console.log("errors:", errors.length ? errors : "none");
await browser.close();
mock.close();
