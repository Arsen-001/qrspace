import { chromium } from "playwright";
// Безопасность: испорченное оформление (попытка вставить код) не сохраняется; настоящее — с фото — сохраняется.
const B = "http://localhost:3720";
const browser = await chromium.launch();
const errors = [];
const ok = (c, m) => { console.log(c ? "  ✓" : "  ✗", m); if (!c) errors.push(m); };
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: "ru-RU" });
const p = await ctx.newPage();
let alerted = false;
p.on("dialog", (d) => { alerted = true; d.dismiss(); });
p.on("pageerror", (e) => errors.push(e.message));
await p.goto(B + "/login?next=/codes");
await p.getByRole("button", { name: /Арман/ }).click();
await p.waitForURL(/codes$/);
await p.getByRole("link", { name: /Бублик/ }).click();
await p.waitForURL(/codes\/\w+/);
const id = p.url().split("/").pop();
const api = (method, body) => p.evaluate(([u, m, b]) => fetch(u, { method: m, headers: { "content-type": "application/json" }, body: b && JSON.stringify(b) }).then(async (r) => ({ status: r.status, json: await r.json().catch(() => null) })), [`/api/codes/${id}`, method, body]);
const before = (await api("GET")).json.style;
const evil = [
  { ...before, logo: { src: 'x" onload="alert(1)', scale: 0.2 } },
  { ...before, rotate: '0"><script>alert(1)</script>' },
  { ...before, fg: "red;}</style><script>alert(1)</script>" },
  { ...before, logo: { src: "https://evil.example/x.png", scale: 0.2 } },
  { ...before, dot: "<img src=x onerror=alert(1)>" },
];
for (const s of evil) ok((await api("PATCH", { style: s })).status === 400, `rejected: ${JSON.stringify(s).match(/(logo|rotate|fg|dot)[^,]{0,40}/)?.[0]}`);
ok(JSON.stringify((await api("GET")).json.style) === JSON.stringify(before), "stored style unchanged");
// настоящее оформление с фото
await p.getByRole("tab", { name: /Вид кода/ }).click();
await p.locator('input[type=file][multiple]').setInputFiles(new URL("./photo.jpg", import.meta.url).pathname);
await p.waitForFunction(() => /Код (читается|плохо)/.test(document.body.innerText), null, { timeout: 30000 });
await p.waitForSelector("text=Сохранено", { timeout: 15000 });
const saved = (await api("GET")).json.style;
ok(!!saved?.picture?.src?.startsWith("data:image/"), "photo style saved");
await p.goto(B + "/market", { waitUntil: "networkidle" });
ok(!alerted, "no script ran anywhere");
console.log("errors:", errors.length ? errors : "none");
await browser.close();
