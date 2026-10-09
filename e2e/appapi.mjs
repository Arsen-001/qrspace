// Сервер для приложений (09.10.2026): рисунок кода (SVG/PNG), вход из приложения одноразовым кодом, телефоны для уведомлений.
import { request } from "playwright";
const B = process.env.E2E_BASE ?? "http://localhost:3720";
const errors = [];
const ok = (c, m) => { console.log(c ? "  ✓" : "  ✗", m); if (!c) errors.push(m); };
const ctx = () => request.newContext({ baseURL: B });
const demo = async (who) => { const r = await ctx(); await r.post("/api/me", { data: { personId: who } }); return r; };

// Рисунок кода
const arman = await demo("arman");
const list = await (await arman.get("/api/codes")).json();
const keys = list.mine.find((c) => c.title === "Ключи от дома");
const bublik = list.mine.find((c) => c.title === "Бублик");
const svg = await arman.get(`/api/codes/${bublik.id}/image`);
ok(svg.status() === 200 && svg.headers()["content-type"].startsWith("image/svg+xml") && (await svg.text()).startsWith("<svg"), "code drawing as SVG");
const png = await arman.get(`/api/codes/${bublik.id}/image?format=png&size=256`);
const head = (await png.body()).subarray(0, 4).toString("hex");
ok(png.status() === 200 && png.headers()["content-type"] === "image/png" && head === "89504e47", `code drawing as PNG (${png.headers()["content-type"]})`);
const guest = await ctx();
ok((await guest.get(`/api/codes/${keys.id}/image`)).status() === 403, "closed code drawing hidden from a guest");
ok((await arman.get(`/api/codes/${keys.id}/image`)).status() === 200, "owner sees own closed code drawing");

// Вход из приложения: браузер приложения вошёл → одноразовый код → сессия приложения
const back = await arman.get("/app/callback", { maxRedirects: 0 });
const loc = back.headers()["location"] ?? "";
const token = /^qrspace:\/\/auth\?token=([A-Za-z0-9_-]{20,})$/.exec(loc)?.[1];
ok(back.status() === 302 && !!token, `callback returns to the app (${loc.slice(0, 26)}…)`);
const app = await ctx();
const swap = await app.post("/api/auth/token", { data: { token } });
ok(swap.status() === 200 && (await swap.json()).me === "arman", "token swapped for the app's own session");
ok((await (await app.get("/api/me")).json()).me === "arman", "app is signed in");
ok((await (await ctx()).post("/api/auth/token", { data: { token } })).status() === 401, "token works only once");
ok((await (await ctx()).post("/api/auth/token", { data: { token: "x".repeat(32) } })).status() === 401, "made-up token refused");
const anon = await (await ctx()).get("/app/callback", { maxRedirects: 0 });
ok(anon.status() >= 300 && anon.status() < 400 && (anon.headers()["location"] ?? "").includes("/login?next=/app/callback"), "not signed in → sign-in page, then back");

// Телефоны для уведомлений
const dev = "f".repeat(64);
ok((await (await app.post("/api/devices", { data: { token: dev, platform: "ios" } })).json()).ok === true, "device registered");
ok((await app.post("/api/devices", { data: { token: dev, platform: "windows" } })).status() === 400, "unknown platform refused");
ok((await (await ctx()).post("/api/devices", { data: { token: dev, platform: "ios" } })).status() === 401, "guest can't register a device");
ok((await (await app.delete("/api/devices", { data: { token: dev } })).json()).ok === true, "device removed on sign-out");

if (errors.length) { console.log("errors:", errors); process.exit(1); }
console.log("appapi: ok");
process.exit(0);
