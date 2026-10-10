// Аукцион для любых своих кодов (владелец 10.10.2026: «аукцион, где смогут продавать свои QR-коды»): обычный оплаченный
// код из генератора выставляется, в маркете виден ссылкой (как домен), а не названием; покупатель получает его чистым —
// без номера, памяти и людей прежнего хозяина; ссылка и вид остаются. Бесплатная заготовка — нельзя.
import { chromium, request } from "playwright";
const out = new URL("./out/", import.meta.url).pathname;
const B = "http://localhost:3720";
const errors = [];
const ok = (c, m) => { console.log(c ? "  ✓" : "  ✗", m); if (!c) errors.push(m); };
const as = async (who) => {
  const r = await request.newContext({ baseURL: B });
  await r.post("/api/me", { data: { personId: who } });
  return r;
};
const arman = await as("arman");
const ani = await as("ani");

// Обычный код из генератора: телефон Армана, оплачен
await arman.post("/api/purchases", { data: { key: "g:sellany01", tier: "simple" } });
const made = await (await arman.post("/api/codes/quick", { data: { content: { type: "phone", fields: { phone: "+374 91 777 888" } }, key: "g:sellany01" } })).json();
ok(!!made.id, "a paid generator code (phone) is created");
await arman.post(`/api/codes/${made.id}/blocks`, { multipart: { text: "Личная заметка Армана" } });
const before = await (await arman.get(`/api/codes/${made.id}`)).json();
ok(before.title.includes("777") && before.content?.fields?.phone, "before: title and content hold Arman's number");

// Бесплатная заготовка (код с памятью, не скачан) — нельзя
const draft = await (await arman.post("/api/codes", { data: { title: "Заготовка", kind: "memory" } })).json();
ok((await arman.post("/api/listings", { data: { code: draft.id, mode: "fixed", price: 10 } })).status() === 403, "a free unpaid draft can't be sold");

// Выставить — в маркете ссылкой, без названия с номером
const lot = await (await arman.post("/api/listings", { data: { code: made.id, mode: "fixed", price: 30 } })).json();
ok(!!lot.id && lot.view.title === null && lot.view.short === before.short, "listed: the lot shows the code's link, not its title");
const browser = await chromium.launch();
const p = await (await browser.newContext({ viewport: { width: 390, height: 844 }, locale: "ru-RU", isMobile: true, hasTouch: true })).newPage();
p.on("pageerror", (e) => errors.push(e.message));
await p.goto(`${B}/market/lot/${lot.id}`, { waitUntil: "networkidle" });
ok(await p.getByText(`/K/${before.short}`).first().isVisible(), "lot page names it by link «…/K/…»");
ok(!(await p.getByText("777 888").count()), "lot page doesn't show the seller's number");
await p.screenshot({ path: out + "sellany-lot.png", fullPage: true });
await browser.close();

// Купить — код у Ани, чистый
ok((await ani.post(`/api/listings/${lot.id}`, { data: { action: "buy" } })).status() === 200, "Ani buys it");
const after = await (await ani.get(`/api/codes/${made.id}`)).json();
ok(after.access === "owner" && after.short === before.short, "Ani owns the same code with the same link");
ok(!after.content && !after.title.includes("777") && !(after.blocks ?? []).length, "bought clean: no number, no title with it, no memory");
ok(JSON.stringify(after.style) === JSON.stringify(before.style), "the look stays");
ok((await (await arman.get(`/api/codes/${made.id}`)).json()).access !== "owner", "Arman no longer owns it");

if (errors.length) { console.log("errors:", errors); process.exit(1); }
console.log("sellany: ok");
process.exit(0);
