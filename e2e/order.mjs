import { chromium } from "playwright";
// «Мои коды»: порядок перетаскиванием (мышью; на телефоне — долгим нажатием) сохраняется на сервере; имя меняется в сетке.
const B = "http://localhost:3720";
const browser = await chromium.launch();
const errors = [];
const ok = (c, m) => { console.log(c ? "  ✓" : "  ✗", m); if (!c) errors.push(m); };
const titles = (p) => p.locator('[data-testid="my-codes"] li [data-name]').allInnerTexts();
const center = async (loc) => { const b = await loc.boundingBox(); return { x: b.x + b.width / 2, y: b.y + b.height / 3 }; };
const serverOrder = (p) => p.evaluate(() => fetch("/api/codes").then((r) => r.json()).then((d) => d.mine.map((c) => c.title)));

// Компьютер: мышью
const ctx = await browser.newContext({ viewport: { width: 1280, height: 1000 }, locale: "ru-RU" });
const p = await ctx.newPage();
p.on("pageerror", (e) => errors.push(e.message));
await p.goto(`${B}/login?next=/codes`);
await p.getByRole("button", { name: /Арман/ }).click();
await p.waitForURL(/\/codes$/);
await p.waitForSelector('[data-testid="my-codes"] li');
const before = await titles(p);
ok(before.length >= 4, `my codes in a grid (${before.length})`);
const cards = p.locator('[data-testid="my-codes"] li');
const from = await center(cards.nth(0));
const to = await center(cards.nth(2));
await p.mouse.move(from.x, from.y);
await p.mouse.down();
for (let i = 1; i <= 12; i++) await p.mouse.move(from.x + ((to.x - from.x) * i) / 12, from.y + ((to.y - from.y) * i) / 12);
await p.waitForTimeout(250);
await p.mouse.up();
await p.waitForSelector("text=Порядок сохранён");
ok(/\/codes$/.test(p.url()), "dropping does not open the code");
const expected = [before[1], before[2], before[0], ...before.slice(3)];
ok(JSON.stringify(await titles(p)) === JSON.stringify(expected), "dragged card moved to the third place");
await p.reload();
await p.waitForSelector('[data-testid="my-codes"] li');
ok(JSON.stringify(await titles(p)) === JSON.stringify(expected), "order kept after reload");
ok(JSON.stringify(await serverOrder(p)) === JSON.stringify(expected), "server returns the same order");
// кнопки «раньше / дальше» (клавиатура)
await cards.nth(0).getByRole("button", { name: /^Дальше в списке/ }).click();
await p.waitForSelector("text=Порядок сохранён");
ok((await titles(p))[1] === expected[0], "move-later button works");
// переименовать прямо в сетке
await cards.nth(1).getByRole("button", { name: /^Переименовать/ }).click();
const input = p.getByRole("textbox", { name: "Переименовать" });
await input.fill("Ключи — новая дача");
await input.press("Enter");
await p.waitForSelector('[data-testid="my-codes"] [data-name]:text-is("Ключи — новая дача")');
await p.reload();
await p.waitForSelector('[data-testid="my-codes"] li');
ok((await titles(p)).includes("Ключи — новая дача"), "rename saved");
// новый код — в начале
await p.evaluate(() => fetch("/api/codes", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ title: "Самый новый", kind: "memory" }) }));
await p.reload();
await p.waitForSelector('[data-testid="my-codes"] li');
ok((await titles(p))[0] === "Самый новый", "a new code comes first");
// чужие id сервер отбрасывает
const r = await p.evaluate(() => fetch("/api/codes/order", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ ids: ["nope", 5] }) }).then((x) => x.status));
ok(r === 400, "bad order body rejected");

// Телефон: долгое нажатие
const m = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: "ru-RU", hasTouch: true, isMobile: true });
const q = await m.newPage();
q.on("pageerror", (e) => errors.push(e.message));
await q.goto(`${B}/login?next=/codes`);
await q.getByRole("button", { name: /Арман/ }).click();
await q.waitForURL(/\/codes$/);
await q.waitForSelector('[data-testid="my-codes"] li');
const cdp = await m.newCDPSession(q);
const touch = (type, pt) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: pt ? [{ x: pt.x, y: pt.y }] : [] });
const mBefore = await titles(q);
const qc = q.locator('[data-testid="my-codes"] li');
await qc.nth(1).scrollIntoViewIfNeeded();
// быстрый свайп — не перетаскивание
let a = await center(qc.nth(0));
let z = await center(qc.nth(1));
await touch("touchStart", a);
for (let i = 1; i <= 6; i++) await touch("touchMove", { x: a.x + ((z.x - a.x) * i) / 6, y: a.y });
await touch("touchEnd");
await q.waitForTimeout(400);
ok(JSON.stringify(await titles(q)) === JSON.stringify(mBefore), "quick swipe does not reorder (page can scroll)");
// долгое нажатие и перетаскивание
a = await center(qc.nth(0));
z = await center(qc.nth(1));
await touch("touchStart", a);
await q.waitForTimeout(500);
for (let i = 1; i <= 10; i++) await touch("touchMove", { x: a.x + ((z.x - a.x) * i) / 10, y: a.y + ((z.y - a.y) * i) / 10 });
await q.waitForTimeout(250);
await touch("touchEnd");
await q.waitForSelector("text=Порядок сохранён");
ok((await titles(q))[1] === mBefore[0], "long-press drag on a phone reorders");
const overflow = await q.evaluate(() => document.documentElement.scrollWidth - innerWidth);
ok(overflow <= 0, "no horizontal scroll at 390");
console.log("errors:", errors.length ? errors : "none");
await browser.close();
