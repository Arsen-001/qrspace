// Кабинет администратора (владелец 10.10.2026: «своя админка — смотреть юзеров, менять всякое в маркете»):
// не-администратор получает 403 на каждом маршруте /api/admin/*; администратор видит людей, блокирует человека (тот не
// входит и не создаёт коды, его коды и лоты — заблокированы), разблокирует; коды — поиск и блокировка; маркет — скрыть
// дизайн (пропадает из /market, не купить), цена (маркет показывает новую и берёт её), подборка, дроп дня, название,
// вернуть как было, снять лот; покупки. Снимки 390 и 1280 — e2e/out/admin-*.
import { chromium, request } from "playwright";
const out = new URL("./out/", import.meta.url).pathname;
const B = "http://localhost:3720";
const browser = await chromium.launch();
const errors = [];
const ok = (c, m) => { console.log(c ? "  ✓" : "  ✗", m); if (!c) errors.push(m); };
const asApi = async (who) => {
  const r = await request.newContext({ baseURL: B });
  if (who) await r.post("/api/me", { data: { personId: who } });
  return r;
};
const page = async (who, w) => {
  const ctx = await browser.newContext({ viewport: { width: w, height: 900 }, locale: "ru-RU" });
  if (who) await ctx.request.post(B + "/api/me", { data: { personId: who } });
  const p = await ctx.newPage();
  p.on("pageerror", (e) => errors.push(`${w} ${e.message}`));
  // 401/403/404 — ожидаемые ответы проверок (заблокированный, не найден).
  p.on("console", (m) => m.type() === "error" && !/40[134]/.test(m.text()) && errors.push(`${w} ${m.text()}`));
  return p;
};
const fits = (p) => p.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
const tab = (p, name) => p.locator('nav[aria-label="Кабинет администратора"] button', { hasText: name });
const shot = async (p, name) => {
  await p.waitForTimeout(300);
  await p.screenshot({ path: `${out}admin-${name}.png`, fullPage: true });
  ok(await fits(p), `${name}: fits the screen`);
};

// ── 1. Не-администратор (гость, обычный человек, дизайнер) — 403 на каждом маршруте, и ничего не меняется ──
const admin = await asApi("admin");
const lots0 = await (await admin.get("/api/listings")).json();
const anyLot = lots0[0]?.id ?? "nolot";
const codes0 = await (await admin.get("/api/admin/codes")).json();
const anyCode = codes0.rows[0]?.id ?? "nocode";
const ROUTES = [
  ["get", "/api/admin"],
  ["get", "/api/admin/users"],
  ["get", "/api/admin/users?q=ani&filter=real"],
  ["get", "/api/admin/users/arman"],
  ["patch", "/api/admin/users/ani", { action: "block", note: "x", codes: true }],
  ["get", "/api/admin/codes"],
  ["patch", `/api/admin/codes/${anyCode}`, { action: "block", reason: "spam" }],
  ["get", "/api/admin/market"],
  ["patch", "/api/admin/designs/kraft", { hidden: true }],
  ["patch", `/api/admin/listings/${anyLot}`, { action: "remove" }],
  ["get", "/api/admin/purchases"],
  ["patch", "/api/admin/reports/none", { action: "dismiss" }],
];
for (const who of [null, "arman", "nare"]) {
  const r = await asApi(who);
  const bad = [];
  for (const [m, url, data] of ROUTES) {
    const s = (await r[m](url, data ? { data } : undefined)).status();
    if (s !== 403) bad.push(`${m} ${url} → ${s}`);
  }
  ok(!bad.length, `${who ?? "guest"}: 403 on all ${ROUTES.length} admin routes${bad.length ? ` (${bad.join("; ")})` : ""}`);
}
const m0 = await (await admin.get("/api/market")).json();
ok(m0.designs.some((d) => d.id === "kraft"), "non-admin attempts changed nothing (Kraft still in the market)");
const ani0 = await asApi("ani");
ok((await (await ani0.get("/api/me")).json()).me === "ani", "non-admin attempts didn't block Ani");

// ── 2. Проверка ввода у администратора ──
const st = async (m, url, data) => (await admin[m](url, data ? { data } : undefined)).status();
ok((await st("patch", "/api/admin/designs/kraft", { price: 0 })) === 400, "design: price 0 → 400");
ok((await st("patch", "/api/admin/designs/kraft", { price: 2.5 })) === 400, "design: fractional price → 400");
ok((await st("patch", "/api/admin/designs/kraft", { price: 10001 })) === 400, "design: price over $10 000 → 400");
ok((await st("patch", "/api/admin/designs/kraft", { hidden: "yes" })) === 400, "design: hidden not boolean → 400");
ok((await st("patch", "/api/admin/designs/kraft", { name: { ru: "  " } })) === 400, "design: empty name → 400");
ok((await st("patch", "/api/admin/designs/kraft", {})) === 400, "design: nothing to change → 400");
ok((await st("patch", "/api/admin/designs/nope", { hidden: true })) === 404, "design: unknown → 404");
ok((await st("patch", "/api/admin/users/ani", { action: "ban" })) === 400, "user: unknown action → 400");
ok((await st("patch", "/api/admin/users/ani", { action: "block", codes: "yes" })) === 400, "user: codes not boolean → 400");
ok((await st("patch", "/api/admin/users/admin", { action: "block" })) === 409, "admin can't block self / another admin → 409");
ok((await st("patch", "/api/admin/users/nobody", { action: "block" })) === 404, "user: unknown → 404");
ok((await st("patch", `/api/admin/codes/${anyCode}`, { action: "block", reason: "because" })) === 400, "code: unknown reason → 400");
ok((await st("patch", `/api/admin/listings/${anyLot}`, { action: "delete" })) === 400, "lot: unknown action → 400");
ok((await st("get", "/api/admin/users?filter=everyone")) === 400, "users: unknown filter → 400");
ok((await st("get", "/api/admin/codes?filter=everyone")) === 400, "codes: unknown filter → 400");

// ── 3. Люди: список, поиск, почты демо скрыты ──
const users = await (await admin.get("/api/admin/users")).json();
ok(users.rows.length >= 6 && users.rows.some((u) => u.id === "arman" && u.codes > 0), "users: everyone listed with code counts");
ok(users.rows.every((u) => u.provider !== "demo" || u.email === ""), "users: demo emails are hidden");
const found = await (await admin.get(`/api/admin/users?q=${encodeURIComponent("Арм")}`)).json();
ok(found.rows.length === 1 && found.rows[0].id === "arman", "users: search by name");

// ── 4. Блокировка человека в кабинете (1280): Ани вместе с кодами и лотом ──
const aniCodes = (await (await admin.get("/api/admin/users/ani")).json()).codes;
const flowers = aniCodes.find((c) => c.title.startsWith("Цветы"));
const aniLot = lots0.find((l) => l.seller === "ani" && l.status === "open");
{
  const p = await page("admin", 1280);
  await p.goto(B + "/admin?tab=users", { waitUntil: "networkidle" });
  await p.getByRole("searchbox", { name: "Имя или почта" }).fill("Ани");
  await p.locator("[data-user=ani]").click();
  await p.getByRole("heading", { name: "Ани" }).waitFor();
  await p.getByText("Цветы на балконе").first().waitFor();
  ok(p.url().includes("user=ani"), "user page has its own address (?user=ani)");
  await shot(p, "user-1280");
  await p.getByRole("button", { name: "Заблокировать человека" }).click();
  await p.getByLabel("За что (видно только администраторам)").fill("Мошенничество с перепродажей");
  await p.getByLabel("Заодно заблокировать все его коды и снять его лоты").check();
  await shot(p, "user-block-1280");
  await p.getByRole("button", { name: "Заблокировать человека" }).click();
  await p.getByRole("button", { name: "Разблокировать человека" }).waitFor();
  ok(await p.getByText("⛔ Заблокирован").first().isVisible() && (await p.locator("p", { hasText: "Мошенничество с перепродажей" }).count()) === 1, "admin sees the person is blocked, with the note");
  await p.close();
}
// Её открытый вход перестал работать, коды не создать, войти нельзя
ok((await (await ani0.get("/api/me")).json()).me === null, "blocked: Ani's open session no longer works");
ok((await ani0.post("/api/codes", { data: { title: "Новый", kind: "memory", style: null } })).status() === 401, "blocked: can't create a code");
ok((await ani0.post("/api/market/kraft")).status() === 401, "blocked: can't buy in the market");
const again = await request.newContext({ baseURL: B });
const relog = await again.post("/api/me", { data: { personId: "ani" } });
ok(relog.status() === 403 && (await relog.json()).error === "blocked", "blocked: demo sign-in refused (403 blocked)");
ok((await (await admin.get("/api/listings")).json()).every((l) => l.id !== aniLot?.id), "blocked with codes: her lot is gone from the market");
const guest = await asApi(null);
ok((await (await guest.get(`/api/codes/${flowers.id}`)).json()).blocked === true, "blocked with codes: her code is blocked");
ok((await (await admin.get("/api/admin/users?filter=blocked")).json()).rows.map((u) => u.id).join() === "ani", "users filter «blocked» shows Ani");
{
  const p = await page(null, 390);
  await p.goto(B + "/login", { waitUntil: "networkidle" });
  await p.getByRole("button", { name: /Ани/ }).click();
  await p.getByText("Этот аккаунт заблокирован администратором").waitFor();
  ok(true, "login page explains the account is blocked");
  await p.screenshot({ path: `${out}admin-login-blocked-390.png`, fullPage: true });
  await p.close();
}
// Разблокировать (390) — снова входит, создаёт код, коды разблокированы
{
  const p = await page("admin", 390);
  await p.goto(B + "/admin?tab=users&user=ani", { waitUntil: "networkidle" });
  await p.getByRole("button", { name: "Разблокировать человека" }).click();
  await p.getByRole("button", { name: "Заблокировать человека" }).waitFor();
  ok(true, "admin unblocked Ani");
  await shot(p, "user-390");
  await p.close();
}
const ani1 = await asApi("ani");
ok((await (await ani1.get("/api/me")).json()).me === "ani", "unblocked: Ani can sign in again");
ok((await ani1.post("/api/codes", { data: { title: "После разблокировки", kind: "memory", style: null } })).status() === 200, "unblocked: can create a code");
ok((await (await guest.get(`/api/codes/${flowers.id}`)).json()).blocked === false, "unblocked: her codes work again");

// ── 5. Коды: поиск по короткой ссылке и названию, блокировка с причиной, разблокировка ──
const arman = await asApi("arman");
const wifi = (await (await arman.get("/api/codes")).json()).mine.find((c) => c.title.startsWith("Wi"));
const byShort = await (await admin.get(`/api/admin/codes?q=${encodeURIComponent(`${B}/K/${wifi.short}`)}`)).json();
ok(byShort.rows.length === 1 && byShort.rows[0].id === wifi.id, "codes: search by short link");
{
  const p = await page("admin", 1280);
  await p.goto(B + "/admin?tab=codes", { waitUntil: "networkidle" });
  await p.getByRole("searchbox").fill("Wi‑Fi для гостей");
  const row = p.locator(`li[data-code="${wifi.id}"]`);
  await row.waitFor();
  await row.getByRole("button", { name: "Заблокировать код" }).click();
  await row.getByLabel("Причина").selectOption("spam");
  await row.getByRole("button", { name: "Заблокировать код" }).click();
  await row.getByText("⛔ Спам").waitFor();
  ok(true, "admin blocked a code from the Codes tab");
  await shot(p, "codes-1280");
  ok((await (await guest.get(`/api/codes/${wifi.id}`)).json()).blocked === true, "guest sees the code blocked");
  const n = await (await arman.get("/api/notifications")).json();
  ok(n.items.some((x) => x.kind === "codeBlockedAdmin"), "owner notified (blocked by admin)");
  await p.getByRole("button", { name: "С жалобами" }).click();
  await p.getByRole("button", { name: "Заблокированные" }).click();
  await row.getByRole("button", { name: "Разблокировать" }).click();
  await row.getByRole("button", { name: "Заблокировать код" }).waitFor();
  ok((await (await guest.get(`/api/codes/${wifi.id}`)).json()).blocked === false, "unblocked code works again");
  await p.close();
}

// ── 6. Маркет: скрыть, цена, подборка, дроп, название, вернуть как было, снять лот ──
{
  const p = await page("admin", 1280);
  await p.goto(B + "/admin?tab=market", { waitUntil: "networkidle" });
  const card = (id) => p.locator(`li[data-design="${id}"]`);
  await card("kraft").getByRole("button", { name: "Скрыть" }).click();
  await card("kraft").getByText("Скрыт", { exact: true }).waitFor();
  await card("circuit").getByRole("button", { name: "Изменить" }).click();
  await card("circuit").getByLabel("Цена, $").fill("11");
  await card("circuit").getByLabel("Название · RU").fill("Микросхема Про");
  await card("circuit").getByRole("button", { name: "Сохранить" }).click();
  await card("circuit").getByText("$11").first().waitFor();
  await card("hearts").getByRole("button", { name: "В подборку" }).click();
  await card("hearts").getByRole("button", { name: "Из подборки" }).waitFor();
  await card("wood").getByRole("button", { name: "Сделать дропом дня" }).click();
  await card("wood").getByRole("button", { name: "Снять с дропа" }).waitFor();
  ok(true, "admin hid Kraft, set Circuit to $11 and renamed it, featured Hearts, made Wood the drop");
  await shot(p, "market-1280");

  // Публичный маркет — сразу с правками (новый гость)
  const g = await page(null, 1280);
  await g.goto(B + "/market", { waitUntil: "networkidle" });
  ok((await g.getByText("Крафт", { exact: true }).count()) === 0, "hidden design is gone from /market");
  const circuitCard = g.locator('a[href="/market/circuit"]');
  ok((await circuitCard.innerText()).includes("$11") && (await circuitCard.innerText()).includes("Микросхема Про"), "market shows the new price and name");
  const first = g.locator("ul li a[href^='/market/']:not([href*='/lot/'])").first();
  ok((await first.getAttribute("href")) === "/market/hearts" && (await first.innerText()).includes("Выбор QR Space"), "featured design is first, with «Выбор QR Space»");
  ok(await g.getByRole("heading", { name: "Дерево", level: 2 }).isVisible(), "Wood is the drop of the day");
  await g.screenshot({ path: `${out}admin-public-market-1280.png`, fullPage: true });
  await g.close();
  const buyer = await page("arman", 1280);
  await buyer.goto(B + "/market/kraft", { waitUntil: "networkidle" });
  ok((await buyer.getByRole("button", { name: /Купить/ }).count()) === 0 && (await buyer.getByText("Код не найден").count()) === 1, "hidden design page: not found, nothing to buy");
  await buyer.goto(B + "/market/circuit", { waitUntil: "networkidle" });
  ok(await buyer.getByRole("button", { name: "Купить — $11" }).isVisible(), "design page shows the new price");
  await buyer.close();
  ok((await arman.post("/api/market/kraft")).status() === 404, "hidden design can't be bought (404)");
  const bought = await arman.post("/api/market/circuit");
  ok(bought.status() === 200, "design with the new price can be bought");
  const buys = await (await admin.get("/api/admin/purchases")).json();
  ok(buys.rows[0].kind === "design" && buys.rows[0].price === 11 && buys.rows[0].person.id === "arman", "purchase charged the new price ($11)");

  // Лот перепродажи — снять
  const lot = (await (await admin.get("/api/listings")).json()).find((l) => l.status === "open");
  await p.reload({ waitUntil: "networkidle" });
  await p.locator(`li[data-lot="${lot.id}"]`).getByRole("button", { name: "Снять с продажи" }).click();
  // Открытый лот уходит из списка «продаётся» (внизу — среди закрытых, «снят администратором»).
  await p.locator(`li[data-lot="${lot.id}"]`).waitFor({ state: "detached" });
  ok((await (await admin.get("/api/listings")).json()).every((l) => l.id !== lot.id), "removed lot is gone from the market");
  const seller = await asApi(lot.seller);
  ok((await (await seller.get("/api/notifications")).json()).items.some((x) => x.kind === "lotRemoved"), "seller notified that the lot was taken down");
  ok((await seller.post(`/api/listings/${lot.id}`, { data: { action: "cancel" } })).status() === 409, "removed lot can't be acted on");

  // Вернуть как было
  for (const id of ["kraft", "circuit", "hearts", "wood"]) {
    await card(id).getByRole("button", { name: "Вернуть как было" }).click();
    await card(id).getByRole("button", { name: "Вернуть как было" }).waitFor({ state: "detached" });
  }
  const m1 = await (await guest.get("/api/market")).json();
  const circuit = m1.designs.find((d) => d.id === "circuit");
  ok(m1.designs.some((d) => d.id === "kraft") && circuit.price === 7 && circuit.name.ru === "Микросхема" && m1.designs.find((d) => d.drop)?.id === "nebula" && !m1.designs.some((d) => d.featured), "«Вернуть как было» restores the market");
  await p.close();
}

// ── 7. Все разделы — снимки 390 и 1280, ничего не вылезает ──
for (const w of [390, 1280]) {
  const p = await page("admin", w);
  await p.goto(B + "/admin", { waitUntil: "networkidle" });
  await p.getByRole("heading", { name: "Жалобы" }).waitFor();
  await shot(p, `overview-${w}`);
  for (const [name, wait, file] of [
    ["Люди", "[data-user]", "users"],
    ["Коды", "[data-code]", "codes-list"],
    ["Маркет", "[data-design]", "market-list"],
    ["Покупки", "text=Последние оплаты", "purchases"],
  ]) {
    await tab(p, name).click();
    await p.locator(wait).first().waitFor();
    ok((await tab(p, name).getAttribute("aria-current")) === "page", `${w}: tab «${name}» is current`);
    await shot(p, `${file}-${w}`);
  }
  ok(await p.getByText("Дизайн из маркета").first().isVisible(), `${w}: purchases list the market design`);
  await p.close();
}

console.log("errors:", errors.length ? errors : "none");
await browser.close();
process.exit(errors.length ? 1 : 0);
