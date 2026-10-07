import { chromium } from "playwright";
// Безопасность: испорченное оформление (попытка вставить код) не сохраняется; настоящее — с фото — сохраняется.
const B = "http://localhost:3720";
const browser = await chromium.launch();
const errors = [];
const ok = (c, m) => { console.log(c ? "  ✓" : "  ✗", m); if (!c) errors.push(m); };
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: "ru-RU", acceptDownloads: true });
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
// Postgres (jsonb) хранит ключи в своём порядке — сравниваем без учёта порядка.
const canon = (v) => (Array.isArray(v) ? v.map(canon) : v && typeof v === "object" ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, canon(v[k])])) : v);
ok(JSON.stringify(canon((await api("GET")).json.style)) === JSON.stringify(canon(before)), "stored style unchanged");
// настоящее оформление с фото
await p.getByRole("tab", { name: /Вид кода/ }).click();
await p.locator('input[type=file][multiple]').setInputFiles(new URL("./photo.jpg", import.meta.url).pathname);
await p.waitForFunction(() => /Код (читается|плохо)/.test(document.body.innerText), null, { timeout: 30000 });
await p.waitForSelector("text=Сохранено", { timeout: 15000 });
const saved = (await api("GET")).json.style;
ok(/^\/api\/asset\/[0-9a-f]{32}\.jpg$/.test(saved?.picture?.src ?? ""), "photo style saved; the photo moved to file storage (link in data)");
const img = await p.evaluate((u) => fetch(u).then((r) => [r.status, r.headers.get("content-type")]), saved.picture.src);
ok(img[0] === 200 && img[1] === "image/jpeg", "the stored photo is served");
// скачанный SVG — с картинкой внутри файла, а не ссылкой на наш сайт
await p.reload();
await p.getByRole("tab", { name: /Вид кода/ }).click();
await p.waitForFunction(() => /Код читается|Код плохо/.test(document.body.innerText), null, { timeout: 30000 });
// оплачиваем код заранее (демо), чтобы кнопка сразу скачивала
await p.evaluate((id) => fetch("/api/purchases", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ key: `code:${id}`, tier: "styled" }) }), id);
const [dl] = await Promise.all([p.waitForEvent("download"), p.getByRole("button", { name: /Скачать SVG/ }).click()]);
const svg = (await import("node:fs")).readFileSync(await dl.path(), "utf8");
ok(svg.includes("data:image/jpeg;base64,") && !svg.includes("/api/asset/"), "downloaded SVG embeds the photo");
await p.goto(B + "/market", { waitUntil: "networkidle" });
ok(!alerted, "no script ran anywhere");
console.log("errors:", errors.length ? errors : "none");
await browser.close();
