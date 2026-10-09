// Вход проверяющих App Store / Google Play (09.10.2026, как в BookTime): логин и код из env → свой аккаунт «App Review»
// с примерами кодов; из приложения — тот же вход и возврат в приложение; неверный код и подбор — отказ.
// Нужны REVIEW_LOGIN=appreview и REVIEW_LOGIN_CODE (run.mjs пишет их в .env.local).
import { chromium, request } from "playwright";
const out = new URL("./out/", import.meta.url).pathname;
const B = "http://localhost:3720";
const CODE = "test-review-code-01";
const browser = await chromium.launch();
const errors = [];
const ok = (c, m) => { console.log(c ? "  ✓" : "  ✗", m); if (!c) errors.push(m); };
// Каждой проверке — свой адрес (x-real-ip), чтобы счёт ошибок не мешал соседним.
const api = (ip) => request.newContext({ baseURL: B, extraHTTPHeaders: { "x-real-ip": ip } });
const review = (r, login, code) => r.post("/api/auth/review", { data: { login, code } });

ok((await (await (await api("10.0.0.1")).get("/api/me")).json()).review === true, "review sign-in is on when env is set");

// Сайт: формы нет (она только на входе из приложения); неверный код — сообщение; вход → своя главная с примерами кодов
for (const w of [1280, 390]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: 900 }, locale: "ru-RU", extraHTTPHeaders: { "x-real-ip": `10.0.1.${w % 250}` } });
  const p = await ctx.newPage();
  p.on("pageerror", (e) => errors.push(e.message));
  p.on("console", (m) => m.type() === "error" && !/40[14]/.test(m.text()) && errors.push(m.text()));
  await p.goto(B + "/login", { waitUntil: "networkidle" });
  ok((await p.getByText("Вход по коду проверки").count()) === 0, `${w}: site sign-in page has no review form`);
  await p.goto(B + "/login?next=/app/callback", { waitUntil: "networkidle" });
  await p.getByText("Вход по коду проверки").click();
  await p.getByLabel("Логин").fill("appreview");
  await p.getByLabel("Код").fill("wrong-code-000");
  await p.getByRole("button", { name: "Войти", exact: true }).click();
  // role=alert есть и у Next (объявление переходов) — ищем по тексту
  await p.getByText("Неверный логин или код.").waitFor();
  ok(true, `${w}: wrong code → message`);
  await p.screenshot({ path: `${out}review-form-${w}.png`, fullPage: true });
  ok((await ctx.request.post(B + "/api/auth/review", { data: { login: "  AppReview ", code: CODE } })).status() === 200, `${w}: login ignores case and spaces`);
  await p.goto(B + "/", { waitUntil: "networkidle" });
  await p.getByRole("heading", { name: "Мои QR-коды" }).waitFor();
  await p.getByText("Website").first().waitFor();
  for (const title of ["Website", "Guest Wi‑Fi", "Welcome note"]) ok(await p.getByText(title).first().isVisible(), `${w}: sample code "${title}"`);
  ok(await p.getByText("сканов").first().isVisible(), `${w}: sample codes have scans`);
  ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${w}: home fits`);
  await p.screenshot({ path: `${out}review-home-${w}.png`, fullPage: true });
  const prof = await (await ctx.request.get(B + "/api/profile")).json();
  ok(prof.provider === "review" && prof.email === "" && prof.codes === 3 && prof.stats.scans > 0, `${w}: profile — review account, no email, 3 codes with scans`);
  await p.goto(B + "/account?tab=settings", { waitUntil: "networkidle" });
  ok(await p.getByText("Аккаунт для проверки").first().isVisible(), `${w}: account says it is the review account`);
  await ctx.close();
}

// Тот же аккаунт при повторном входе — примеры не дублируются
const again = await api("10.0.2.1");
ok((await review(again, "appreview", CODE)).status() === 200, "second sign-in works");
const { mine } = await (await again.get("/api/codes")).json();
ok(mine.length === 3 && mine.filter((c) => c.title === "Website").length === 1, "samples are not added twice");

// Из приложения: страница входа без меню сайта → вход → одноразовый код → сессия приложения
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: "en-US", extraHTTPHeaders: { "x-real-ip": "10.0.3.1" } });
  const p = await ctx.newPage();
  await p.goto(B + "/login?next=/app/callback", { waitUntil: "networkidle" });
  ok((await p.getByRole("link", { name: "Market" }).count()) === 0, "in-app sign-in page: no site menu");
  await p.getByText("Sign in with a review code").click();
  await p.getByLabel("Login").fill("appreview");
  await p.getByLabel("Code").fill(CODE);
  await p.screenshot({ path: `${out}review-app.png`, fullPage: true });
  // Браузер теста не откроет qrspace:// — ждём сам переход на /app/callback, а ответ сервера берём тем же входом (cookie).
  const nav = p.waitForRequest((r) => new URL(r.url()).pathname === "/app/callback");
  await p.getByRole("button", { name: "Sign in", exact: true }).click();
  await nav;
  ok(true, "after review sign-in the browser goes back to the app (/app/callback)");
  const back = (await ctx.request.get(B + "/app/callback", { maxRedirects: 0 })).headers()["location"] ?? "";
  const token = /^qrspace:\/\/auth\?token=([\w-]+)$/.exec(back)?.[1];
  ok(!!token, "after review sign-in the app gets a one-time token");
  const app = await api("10.0.3.2");
  const r = await app.post("/api/auth/token", { data: { token } });
  const meNow = await (await app.get("/api/me")).json();
  ok(r.status() === 200 && !!meNow.me, "app session is the review account");
  ok((await (await app.get("/api/profile")).json()).provider === "review", "app sees the review account");
  await ctx.close();
}

// Подбор: 5 неверных попыток с одного адреса — дальше отказ даже с верным кодом; с другого адреса — входит
const brute = await api("10.0.4.1");
const statuses = [];
for (let i = 0; i < 5; i++) statuses.push((await review(brute, "appreview", `guess-${i}-000000`)).status());
ok(statuses.every((s) => s === 401), "wrong codes → 401");
ok((await review(brute, "appreview", CODE)).status() === 429, "after 5 wrong codes — 429 even with the right code");
ok((await review(await api("10.0.4.2"), "appreview", CODE)).status() === 200, "another address is not blocked");
ok((await review(await api("10.0.4.3"), "someone", CODE)).status() === 401, "right code with a wrong login → 401");
ok((await review(await api("10.0.4.4"), "", "")).status() === 401, "empty → 401");

// Удалить аккаунт (Apple проверяет) → следующий вход заводит его заново, с примерами
const del = await api("10.0.5.1");
await review(del, "appreview", CODE);
const before = (await (await del.get("/api/me")).json()).me;
ok((await del.delete("/api/profile")).status() === 200, "review account can be deleted");
ok((await (await del.get("/api/me")).json()).me === null, "signed out after deletion");
await review(del, "appreview", CODE);
const after = (await (await del.get("/api/me")).json()).me;
ok(!!after && after !== before && (await (await del.get("/api/profile")).json()).codes === 3, "next sign-in creates a fresh review account with samples");

await browser.close();
if (errors.length) { console.log("errors:", errors); process.exit(1); }
console.log("review: ok");
process.exit(0);
