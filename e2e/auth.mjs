import { chromium } from "playwright";
const out = new URL("./out/", import.meta.url).pathname;
const B = "http://localhost:3720";
const browser = await chromium.launch();
const errors = [];
const ok = (c, m) => { console.log(c ? "  ✓" : "  ✗", m); if (!c) errors.push(m); };
const shot = async (p, name) => { await p.waitForTimeout(300); await p.screenshot({ path: out + name + ".png", fullPage: true }); const o = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth); if (o) errors.push(`${name} overflow ${o}`); };
const page = async (w = 390) => { const ctx = await browser.newContext({ viewport: { width: w, height: 900 }, locale: "ru-RU" }); const p = await ctx.newPage(); p.on("pageerror", (e) => errors.push(e.message)); return p; };
const demo = async (who, next, w) => { const p = await page(w); await p.goto(`${B}/login?next=${encodeURIComponent(next)}`); await p.getByRole("button", { name: new RegExp(who) }).click(); await p.waitForURL((u) => !u.pathname.startsWith("/login")); return p; };

const brand = await demo("Ани", "/brand/auth", 1280);
await brand.getByLabel("Бренд").fill("Ararat Wear");
await brand.getByLabel("Товар").fill("Худи чёрное");
await brand.getByLabel("Сколько вещей").fill("3");
await brand.getByRole("button", { name: "Создать партию" }).click();
await brand.waitForSelector("text=Зарегистрировано 0 из 3");
await brand.getByRole("link", { name: /Ararat Wear/ }).click();
await brand.waitForSelector("text=№ 3");
await shot(brand, "a-labels");
const secrets = await brand.locator("main .font-mono").allInnerTexts(); // в шапке — метка «DEMO» тем же шрифтом
ok(secrets.length === 3 && secrets.every((s) => /^[A-Z2-9]{8}$/.test(s)), "3 tags with 8-char secrets");
const items = await brand.evaluate(() => fetch(location.pathname.replace("/brand/auth/", "/api/batches/")).then((r) => r.json()).then((d) => d.items));
const scan = `${B}/K/${items[0].short}`;
ok((await (await page()).goto(B + "/codes").then(() => true)), "");
// покупатель Лилит
const l = await demo("Лилит", "/codes");
await l.goto(scan, { waitUntil: "networkidle" });
await l.waitForSelector("text=✓ Оригинал");
ok(await l.locator("text=Вещь ещё не зарегистрирована").count() === 1, "free item shows Original + register");
await l.getByLabel("Секрет с бирки").fill("WRONG123");
await l.getByRole("button", { name: "Зарегистрировать" }).click();
await l.waitForSelector("text=Секрет не подходит");
await l.getByLabel("Секрет с бирки").fill(items[0].secret.toLowerCase());
await l.getByRole("button", { name: "Зарегистрировать" }).click();
await l.waitForSelector("text=Это ваша вещь");
await shot(l, "a-mine");
// другой человек видит «уже зарегистрирована»
const d = await demo("Давид", "/codes");
await d.goto(scan, { waitUntil: "networkidle" });
await d.waitForSelector("text=Проверьте вещь");
ok(await d.locator("text=уже зарегистрирована").count() === 1, "someone else sees: already registered → may be a copy");
await shot(d, "a-taken");
ok((await d.getByLabel("Секрет с бирки").count()) === 0, "can't register a taken item");
// старый секрет больше не работает даже после передачи; новый — работает
await l.reload({ waitUntil: "networkidle" });
await l.getByRole("button", { name: /Продаю/ }).click();
await l.waitForSelector("text=Передайте новому владельцу");
const newSecret = (await l.locator(".select-all").innerText()).trim();
await d.reload({ waitUntil: "networkidle" });
await d.waitForSelector("text=Владелец продаёт вещь");
await d.getByLabel("Секрет с бирки").fill(items[0].secret);
await d.getByRole("button", { name: "Зарегистрировать" }).click();
await d.waitForSelector("text=Секрет не подходит");
ok(true, "old tag secret no longer works");
await d.getByLabel("Секрет с бирки").fill(newSecret);
await d.getByRole("button", { name: "Зарегистрировать" }).click();
await d.waitForSelector("text=Это ваша вещь");
ok(true, "transfer: new owner registered with the new secret");
const n = await l.evaluate(() => fetch("/api/notifications").then((r) => r.json()));
ok(n.items.some((x) => x.kind === "itemPassed"), "previous owner notified");
await d.goto(B + "/codes", { waitUntil: "networkidle" });
await d.waitForSelector("text=Мои вещи — оригиналы");
ok(true, "item listed in buyer's My codes");
// много сканов — тревога
const g = await page();
for (let i = 0; i < 21; i++) await g.request.get(`${B}/api/codes/${items[1].id}?visit=1`);
await g.goto(`${B}/c/${items[1].id}`, { waitUntil: "networkidle" });
await g.waitForSelector("text=возможно, бирку скопировали");
ok(true, "suspicious scan count warns about a copied tag");
await shot(g, "a-suspicious");
// бренд: в «Моих кодах» вещи партии не засоряют список
await brand.goto(B + "/codes", { waitUntil: "networkidle" });
ok(await brand.locator("text=Худи чёрное № 1").count() === 0, "batch items not in brand's My codes");
// подбор секрета ограничен: 10 попыток в час
const codes = [];
for (let i = 0; i < 11; i++) codes.push(await d.evaluate((id) => fetch(`/api/codes/${id}/claim`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ secret: "AAAAAAAA" }) }).then((r) => r.status), items[2].id));
ok(codes.slice(0, 10).every((c) => c === 403) && codes[10] === 429, "secret guessing limited (10/hour)");
console.log("errors:", errors.length ? errors : "none");
await browser.close();
