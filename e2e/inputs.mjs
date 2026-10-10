// Что человек вводит в шаге 1 «как попало» — и что потом видит тот, кто отсканировал (проверка 10.10.2026: «тестировать
// весь процесс создания QR-кодов до идеального состояния»). Ошибки — под полем, когда из него вышли; с ошибкой, из-за
// которой скан вёл бы в никуда, скачать нельзя и шаг 3 объясняет почему; не хватает поля — «Осталось заполнить».
// Странные, но понятные записи (t.me/имя, имя с пробелом, ссылка на карту, длинный адрес) — код работает как надо.
import fs from "node:fs";
import { chromium } from "playwright";
const out = new URL("./out/", import.meta.url).pathname;
const B = "http://localhost:3720";
const browser = await chromium.launch();
const errors = [];
const ok = (c, m) => { console.log(c ? "  ✓" : "  ✗", m); if (!c) errors.push(m); };
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: "ru-RU", isMobile: true, hasTouch: true, acceptDownloads: true });
await ctx.request.post(B + "/api/me", { data: { personId: "ani" } });
const p = await ctx.newPage();
p.on("pageerror", (e) => errors.push(e.message));
p.on("console", (m) => m.type() === "error" && !/40[12]/.test(m.text()) && errors.push(m.text()));
const guest = await (await browser.newContext({ viewport: { width: 390, height: 844 }, locale: "ru-RU", isMobile: true, hasTouch: true, acceptDownloads: true })).newPage();
guest.on("pageerror", (e) => errors.push(e.message));

const pick = async (type) => {
  const r = p.getByRole("radio", { name: type, exact: true });
  await r.evaluate((e) => e.scrollIntoView({ block: "center" }));
  await r.click();
};
const field = (name) => p.getByRole("textbox", { name, exact: true });
const leave = async (name) => { await field(name).blur(); await p.waitForTimeout(250); };
/** Поле с подписью и тем, что под ним. */
const note = (name) => field(name).locator("xpath=ancestor::div[2]");
const text = () => p.evaluate(() => document.body.innerText);
const png = () => p.getByRole("button", { name: /Скачать PNG/ });

// ——— Ошибки в полях ———
await p.goto(B + "/create", { waitUntil: "networkidle" });
await pick("WhatsApp");
await field("Номер телефона").fill("091 555 779");
ok(!(await note("Номер телефона").innerText()).includes("кодом страны"), "while typing — no error under the field yet");
await leave("Номер телефона");
ok((await note("Номер телефона").innerText()).includes("Нужен номер с кодом страны"), "WhatsApp 091…: needs the country code (shown after leaving the field)");
ok((await field("Номер телефона").getAttribute("aria-invalid")) === "true", "WhatsApp 091…: field marked invalid");
ok(await png().isDisabled(), "WhatsApp 091…: download is off");
ok((await text()).includes("Исправьте шаг 1. Нужен номер с кодом страны"), "WhatsApp 091…: step 3 says why");
// Кнопка в закреплённой полосе ведёт к полю с ошибкой
await p.evaluate(() => scrollTo(0, document.body.scrollHeight));
await p.getByRole("button", { name: /^Исправить ↑/ }).click();
await p.waitForTimeout(800);
ok(await p.evaluate(() => document.activeElement?.getAttribute("aria-invalid") === "true"), "«Исправить ↑» in the sticky bar brings you to the bad field");
await p.screenshot({ path: out + "inputs-wa-bad.png" });
await field("Номер телефона").fill("00374 91 555 779");
await leave("Номер телефона");
ok(!(await text()).includes("Нужен номер с кодом страны") && (await png().isEnabled()), "WhatsApp 00374…: accepted");

await pick("Почта");
await field("Адрес почты").fill("ani@gmial.com");
await leave("Адрес почты");
ok((await text()).includes("Может быть, ani@gmail.com?"), "email typo: «Может быть, ani@gmail.com?»");
await p.getByRole("button", { name: "Исправить", exact: true }).click();
ok((await field("Адрес почты").inputValue()) === "ani@gmail.com", "email typo: «Исправить» fixes it");
await field("Адрес почты").fill("ani gmail.com");
await leave("Адрес почты");
ok((await text()).includes("Проверьте адрес почты") && (await png().isDisabled()), "bad email: error, download off");

await pick("Событие");
await field("Название").fill("Встреча выпускников");
await leave("Название");
ok((await text()).includes("Осталось заполнить: «Начало»"), "event without a start: «Осталось заполнить: «Начало»»");
await field("Начало").fill("2026-11-01T18:30");
await field("Конец (необязательно)").fill("2026-11-01T17:00");
await leave("Конец (необязательно)");
ok((await text()).includes("Конец раньше начала") && (await png().isDisabled()), "event ends before it starts: error, download off");
ok((await field("Конец (необязательно)").getAttribute("min")) === "2026-11-01T18:30", "end picker can't go before the start");

await pick("Телефон");
await field("Номер телефона").fill("позвонить мне");
await leave("Номер телефона");
ok((await text()).includes("В номере нет цифр"), "phone without digits: error");
await pick("Текст");
await field("Текст").fill("     ");
ok((await text()).includes("Заполните шаг 1"), "text of spaces only — still the sample, not a «not saved» error later");
await pick("Ссылка");
await field("Адрес сайта").fill("javascript:alert(1)");
await leave("Адрес сайта");
ok((await text()).includes("Такой адрес не откроется") && (await png().isDisabled()), "javascript: address — explained, download off");
await field("Адрес сайта").fill("my site.com");
await leave("Адрес сайта");
ok((await text()).includes("В адресе сайта не бывает пробелов"), "spaces in a site address — explained");
await pick("Instagram");
await field("Имя пользователя или ссылка на профиль").fill("facebook.com/qrspace");
await leave("Имя пользователя или ссылка на профиль");
ok((await text()).includes("Это ссылка на facebook.com, а не на Instagram"), "Facebook link in Instagram — a hint");
await pick("Wi-Fi");
await field("Название сети").fill("Dacha");
await leave("Название сети");
ok((await text()).includes("Пароль пустой"), "Wi-Fi with WPA and no password — a hint");
// Поля адреса, почты, номера — без заглавной буквы и автозамены на телефоне; длинный текст — счётчик
await pick("Почта");
ok((await field("Адрес почты").getAttribute("autocapitalize")) === "none", "email field: no auto capital letter");
await pick("Текст");
await field("Текст").fill("a".repeat(2100));
ok((await field("Текст").inputValue()).length === 2000 && (await text()).includes("2000/2000"), "text stops at 2000 with a counter (server keeps all of it)");

// ——— Создать через генератор: странные, но понятные записи работают ———
const make = async (type, fields) => {
  await p.goto(B + "/create", { waitUntil: "networkidle" });
  await pick(type);
  for (const [name, v] of Object.entries(fields)) await field(name).fill(v);
  await p.waitForFunction(() => /Код читается/.test(document.body.innerText), null, { timeout: 30000 });
  await Promise.all([
    p.waitForEvent("download", { timeout: 20000 }),
    (async () => {
      await png().click();
      const pay = p.getByRole("button", { name: /Скачать бесплатно|Оплатить и скачать|Скачать из пакета/ });
      await pay.waitFor({ timeout: 8000 }).catch(() => {});
      if (await pay.count()) await pay.click();
    })(),
  ]);
  await p.getByText("Готово — это ваш новый код").waitFor({ timeout: 10000 });
  const link = (await p.locator("section[aria-label='Готово — это ваш новый код'] p.font-mono").innerText()).trim();
  ok(/^[a-z0-9.:-]+\/K\/[A-Z2-9]{6}$/.test(link), `${type}: «Готово» shows the link without https and with the site in lowercase (${link})`);
  const short = link.split("/K/")[1];
  await guest.goto(`${B}/K/${short}`);
  await guest.locator("section").first().waitFor({ timeout: 20000 });
  return short;
};
const href = async (sel) => guest.locator(sel).first().getAttribute("href").catch(() => null);

await make("Telegram", { "Имя пользователя или ссылка на профиль": "t.me/qrspace_news" });
ok((await href("a:has-text('Открыть в Telegram')")) === "https://t.me/qrspace_news", "Telegram «t.me/имя» → t.me/имя (was t.me/t.me/имя)");
await make("Instagram", { "Имя пользователя или ссылка на профиль": "qr space" });
ok((await href("a:has-text('Открыть в Instagram')")) === "https://instagram.com/qrspace", "Instagram name with a space — the space is dropped");
await make("YouTube", { "Имя пользователя или ссылка на профиль": "youtu.be/dQw4w9WgXcQ" });
ok((await href("a:has-text('Открыть в YouTube')")) === "https://youtu.be/dQw4w9WgXcQ", "YouTube youtu.be link — as is (was youtube.com/@youtu.be/…)");
await make("Место на карте", { "Адрес, название места или координаты": "https://maps.app.goo.gl/abc123" });
ok((await href("a:has-text('Открыть на карте')")) === "https://maps.app.goo.gl/abc123", "map link — opens that link (was a search for the link text)");
await make("Место на карте", { "Адрес, название места или координаты": "40,1811 44,5136" });
ok((await href("a:has-text('Открыть на карте')")) === "https://maps.google.com/?q=40.1811,44.5136", "coordinates with commas — a point on the map");
const long = "example.com/landing?utm_source=qr&utm_medium=print&utm_campaign=" + "autumn-sale-".repeat(40);
await make("Ссылка", { "Адрес сайта": long });
ok((await href("a:has-text('Открыть сайт')")) === `https://${long}`, `long site address (${long.length} chars) — kept whole (was cut at 300)`);
await make("Ссылка", { "Адрес сайта": "localhost:3000/menu" });
ok((await href("a:has-text('Открыть сайт')")) === "https://localhost:3000/menu", "address with a port — not taken for a scheme (was «not saved»)");
await make("Контакт", { Компания: "Кафе «Арарат»", "Адрес почты": "hello@ararat.am" });
ok(await guest.getByText("Кафе «Арарат»").first().isVisible(), "contact with only a company and email — created, the company is the title");
const rows = await guest.locator("section a[href^='mailto:'], section a[href^='tel:']").evaluateAll((as) => as.map((a) => a.getBoundingClientRect().height));
ok(rows.length > 0 && rows.every((h) => h >= 40), `contact links are finger-sized (${rows.map(Math.round).join(", ")}px)`);
await make("SMS", { "Номер телефона": "+374 91 555 778", "Готовое сообщение (необязательно)": "Хочу записаться" });
ok(await guest.getByText("Готовое сообщение", { exact: true }).isVisible(), "scan page labels without «(необязательно)»");
await make("Событие", { Название: "Свадьба", Начало: "2026-11-01T18:30", "Конец (необязательно)": "2026-11-02T01:00", "Адрес, название места или координаты": "Ереван, зал «Арарат»" });
ok(await guest.getByText("Место", { exact: true }).isVisible() && !(await guest.getByText("Адрес, название места или координаты").count()), "event scan page: «Место», not the form's long label");
const [ics] = await Promise.all([guest.waitForEvent("download"), guest.getByRole("button", { name: /Добавить в календарь/ }).click()]);
const icsText = fs.readFileSync(await ics.path(), "utf8");
ok(/\r\nUID:[\w]+@qrspace\.co\r\n/.test(icsText) && /\r\nDTSTAMP:\d{8}T\d{6}Z\r\n/.test(icsText) && icsText.includes("DTEND:20261102T010000"), "event .ics: UID, DTSTAMP and CRLF lines (calendars need them)");

// ——— Названия в «Моих кодах» понятны: чей это профиль и в каком приложении ———
const mine = (await (await ctx.request.get(B + "/api/codes")).json()).mine;
const titles = mine.map((c) => c.title);
ok(titles.includes("Telegram @qrspace_news") && titles.includes("Instagram @qrspace") && titles.includes("SMS +374 91 555 778"), `titles say which app (${titles.slice(0, 6).join(" | ")})`);

// Редактор кода («Что в коде»): та же проверка — с ошибкой не сохранить
{
  const wa = mine.find((c) => c.content?.type === "sms");
  await p.goto(`${B}/codes/${wa.id}`, { waitUntil: "networkidle" });
  await pick("WhatsApp");
  await field("Номер телефона").fill("091 555 779");
  await leave("Номер телефона");
  ok((await text()).includes("Нужен номер с кодом страны") && (await p.getByRole("button", { name: "Сохранить", exact: true }).isDisabled()), "code editor: WhatsApp 091… — error and «Сохранить» is off");
}

// Узкий телефон (320): длинная почта в подсказке не распирает карточку
{
  const c = await browser.newContext({ viewport: { width: 320, height: 700 }, locale: "ru-RU", isMobile: true, hasTouch: true });
  const q = await c.newPage();
  await q.goto(B + "/create", { waitUntil: "networkidle" });
  const r = q.getByRole("radio", { name: "Почта", exact: true });
  await r.evaluate((e) => e.scrollIntoView({ block: "center" }));
  await r.click();
  await q.getByRole("textbox", { name: "Адрес почты", exact: true }).fill("ani.petrosyan.very.long.name@gmial.com");
  await q.getByRole("textbox", { name: "Адрес почты", exact: true }).blur();
  await q.waitForTimeout(300);
  const wide = await q.evaluate(() => [...document.querySelectorAll("section")].filter((s) => s.scrollWidth > s.clientWidth + 1).length);
  ok(wide === 0 && (await q.evaluate(() => document.documentElement.scrollWidth <= innerWidth)), `320px: the long email suggestion wraps inside the card (${wide} cards too wide)`);
  await c.close();
}

console.log("errors:", errors.length ? errors : "none");
await browser.close();
process.exit(errors.length ? 1 : 0);
