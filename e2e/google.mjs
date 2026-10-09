import http from "node:http";
import { chromium } from "playwright";
const B = "http://localhost:3720";
// Подставной «Google»: обменивает код на id_token. В коде теста зашиты nonce, почта и имя.
const seen = [];
const mock = http.createServer((req, res) => {
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    const p = new URLSearchParams(body);
    seen.push(Object.fromEntries(p));
    const info = JSON.parse(Buffer.from(p.get("code"), "base64url").toString());
    const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
    const idToken = `${b64({ alg: "RS256" })}.${b64({ iss: "https://accounts.google.com", aud: "test-client.apps.googleusercontent.com", sub: info.sub, exp: Math.floor(Date.now() / 1000) + 600, nonce: info.nonce, email: info.email, email_verified: true, name: info.name })}.sig`;
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ id_token: idToken }));
  });
}).listen(3729);
const browser = await chromium.launch();
const errors = [];
const ok = (c, m) => { console.log(c ? "  ✓" : "  ✗", m); if (!c) errors.push(m); };
const login = async (email, name, sub, next) => {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: "ru-RU" });
  const p = await ctx.newPage();
  p.on("pageerror", (e) => errors.push(e.message));
  await p.goto(`${B}/login?next=${encodeURIComponent(next)}`);
  const href = await p.getByRole("link", { name: "Войти через Google" }).getAttribute("href");
  // Наш сервер отправляет на Google (это и проверяем), а «Google» отвечает как настоящий: назад с кодом и state.
  const r = await p.request.get(B + href, { maxRedirects: 0 });
  const u = new URL(r.headers()["location"]);
  if (u.host !== "accounts.google.com") throw new Error("not google: " + u);
  const code = Buffer.from(JSON.stringify({ nonce: u.searchParams.get("nonce"), email, name, sub })).toString("base64url");
  await p.goto(`${u.searchParams.get("redirect_uri")}?state=${u.searchParams.get("state")}&code=${code}`);
  await p.waitForURL(B + next);
  return p;
};
const a = await login("mariam.test@gmail.com", "Мариам Акопян", "g-111", "/codes");
const me = await a.evaluate(() => fetch("/api/me").then((r) => r.json()));
ok(!!me.me && !["arman", "ani", "david", "lilit", "nare"].includes(me.me), "new user created via Google and signed in");
ok(me.people.some((x) => x.name.ru === "Мариам Акопян"), "name from Google in directory");
ok(!JSON.stringify(me.people).includes("mariam.test@gmail.com"), "email not exposed to others");
ok(seen[0]?.code_verifier?.length > 40 && seen[0]?.client_secret === "test-secret", "PKCE verifier + secret sent to token endpoint");
await a.waitForSelector("text=Кодов пока нет");
// снова вход тем же Google — тот же человек
const a2 = await login("mariam.test@gmail.com", "Мариам Акопян", "g-111", "/market");
const me2 = await a2.evaluate(() => fetch("/api/me").then((r) => r.json()));
ok(me2.me === me.me, "same Google account → same user");
// дизайнер по почте
const d = await login("studio.designer@gmail.com", "Студия", "g-222", "/create");
await d.waitForSelector("text=Опубликовать в маркет");
ok(true, "DESIGNER_EMAILS gives designer panel");
// Арман (демо) добавляет Мариам к котлу по почте
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: "ru-RU" });
const o = await ctx.newPage();
await o.goto(B + "/login?next=/codes");
await o.getByRole("button", { name: /Арман/ }).click();
await o.waitForURL(/codes$/);
await o.getByRole("link", { name: /Котёл/ }).last().click();
await o.getByRole("tab", { name: /Кто видит/ }).click();
await o.getByLabel("Почта человека (Google или Apple)").fill("nobody@gmail.com");
await o.getByRole("button", { name: "+ Добавить" }).click();
await o.waitForSelector("text=Такой человек ещё не входил");
ok(true, "unknown email → hint to send invite");
await o.getByLabel("Почта человека (Google или Apple)").fill("Mariam.Test@gmail.com");
await o.getByRole("button", { name: "+ Добавить" }).click();
await o.waitForSelector("text=Мариам Акопян");
ok(true, "added Google user by email (case-insensitive)");
// Мариам теперь видит котёл
await a.goto(B + "/codes", { waitUntil: "networkidle" });
await a.waitForSelector("text=Котёл — как включить");
ok(true, "Mariam sees the shared boiler code");
// подделанная cookie не пускает
const ctx2 = await browser.newContext();
await ctx2.addCookies([{ name: "qr-session", value: `${me.me}.forged`, url: B }]);
const f = await ctx2.newPage();
const forged = await f.goto(B + "/api/me").then((r) => r.json());
ok(forged.me === null, "forged session cookie rejected");
console.log("errors:", errors.length ? errors : "none");
await browser.close();
mock.close();
