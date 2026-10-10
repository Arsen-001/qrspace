// Создание кодов в генераторе — все 18 видов, на телефоне (владелец 10.10.2026: «проверяй, чтобы создание кодов всё
// работало, а то пишу номер телефона — не создаётся новый QR»). Каждая оплата — новый код, даже с тем же содержимым:
// код — свой маленький домен с местом под ним. Тот же код в этот заход (PNG, потом SVG) — без новой оплаты и без дубля.
import { chromium } from "playwright";
const out = new URL("./out/", import.meta.url).pathname;
const B = "http://localhost:3720";
const browser = await chromium.launch();
const errors = [];
const ok = (c, m) => { console.log(c ? "  ✓" : "  ✗", m); if (!c) errors.push(m); };
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: "ru-RU", isMobile: true, hasTouch: true, acceptDownloads: true });
await ctx.request.post(B + "/api/me", { data: { personId: "david" } });
const p = await ctx.newPage();
p.on("pageerror", (e) => errors.push(e.message));
p.on("console", (m) => m.type() === "error" && !/40[12]/.test(m.text()) && errors.push(m.text()));
const mine = async () => (await (await ctx.request.get(B + "/api/codes")).json()).mine;
const guest = await (await browser.newContext({ locale: "ru-RU" })).newPage();

const ready = () => p.waitForFunction(() => /Код читается/.test(document.body.innerText), null, { timeout: 30000 });
const field = (name) => p.getByRole("textbox", { name, exact: true });
/** «Скачать PNG» → если спросили цену — согласиться; ждём файл. Возвращает, что было в окне оплаты (или null). */
const download = async (button = /Скачать PNG/) => {
  const asked = { text: null };
  const [d] = await Promise.all([
    p.waitForEvent("download", { timeout: 20000 }),
    (async () => {
      await p.getByRole("button", { name: button }).click();
      const pay = p.getByRole("button", { name: /Скачать бесплатно|Оплатить и скачать|Скачать из пакета/ });
      await pay.waitFor({ timeout: 2500 }).catch(() => {});
      if (await pay.count()) {
        asked.text = (await p.getByRole("dialog").first().innerText()).replace(/\s+/g, " ");
        await pay.click();
      }
    })(),
  ]);
  return { file: d.suggestedFilename(), asked: asked.text };
};
const pick = async (type) => {
  const r = p.getByRole("radio", { name: type, exact: true });
  await r.evaluate((e) => e.scrollIntoView({ block: "center" }));
  await r.click();
};

// Что вводить в каждый вид и что должно оказаться на странице кода после скана.
const KINDS = [
  ["Ссылка", { "Адрес сайта": "example.com/create-test" }, "a:has-text('Открыть сайт')"],
  ["Текст", { Текст: "Привет из теста создания" }, "text=Привет из теста создания"],
  ["Wi-Fi", { "Название сети": "TestNet", Пароль: "secret123" }, "text=TestNet"],
  ["Контакт", { Имя: "Ани", Фамилия: "Тестова", "Номер телефона": "+374 99 000111" }, "text=Ани Тестова"],
  ["Место на карте", { "Адрес, название места или координаты": "40.1811, 44.5136" }, "a[href*='maps.google.com']"],
  ["Событие", { Название: "Встреча теста", Начало: "2026-11-01T18:30" }, "text=Встреча теста"],
  ["Телефон", { "Номер телефона": "+374 91 555 777" }, "a[href='tel:+37491555777']"],
  ["SMS", { "Номер телефона": "+374 91 555 778", "Готовое сообщение (необязательно)": "Привет" }, "a[href^='sms:']"],
  ["Почта", { "Адрес почты": "test@example.com" }, "a[href^='mailto:test@example.com']"],
  ["WhatsApp", { "Номер телефона": "+374 91 555 779" }, "a[href='https://wa.me/37491555779']"],
  ["Telegram", { "Имя пользователя или ссылка на профиль": "@qrspace_test" }, "a[href='https://t.me/qrspace_test']"],
  ["Viber", { "Номер телефона": "+374 91 555 780" }, "a[href^='viber://']"],
  ["Instagram", { "Имя пользователя или ссылка на профиль": "qrspace.test" }, "a[href='https://instagram.com/qrspace.test']"],
  ["Facebook", { "Имя пользователя или ссылка на профиль": "qrspace.test" }, "a[href='https://facebook.com/qrspace.test']"],
  ["TikTok", { "Имя пользователя или ссылка на профиль": "qrspace.test" }, "a[href='https://www.tiktok.com/@qrspace.test']"],
  ["YouTube", { "Имя пользователя или ссылка на профиль": "qrspace" }, "a[href='https://youtube.com/@qrspace']"],
  ["LinkedIn", { "Имя пользователя или ссылка на профиль": "qrspace" }, "a[href='https://www.linkedin.com/in/qrspace']"],
  ["X (Twitter)", { "Имя пользователя или ссылка на профиль": "qrspace" }, "a[href='https://x.com/qrspace']"],
];

await p.goto(B + "/create", { waitUntil: "networkidle" });
// Скан рисунка-образца (до скачивания) — объяснение, а не «ничего нет»
await guest.goto(B + "/K/XXXXXX", { waitUntil: "networkidle" });
ok(await guest.getByRole("heading", { name: "Это образец кода" }).isVisible(), "sample link /K/XXXXXX explains it's a sample");

for (const [type, fields, sel] of KINDS) {
  await p.goto(B + "/create", { waitUntil: "networkidle" });
  await pick(type);
  for (const [name, v] of Object.entries(fields)) await field(name).fill(v);
  await ready();
  ok(await p.getByText("Пока это образец").isVisible(), `${type}: before download — the pattern is a sample, own link on download`);
  const before = (await mine()).length;
  const { file } = await download();
  await p.getByText("Готово — это ваш новый код").waitFor({ timeout: 10000 });
  const now = await mine();
  const link = (await p.locator("section[aria-label='Готово — это ваш новый код'] p.font-mono").innerText()).trim();
  const short = /\/K\/([A-Z2-9]{6})$/.exec(link)?.[1];
  const code = now.find((c) => c.short === short);
  ok(file === "qr-code.png" && now.length === before + 1 && !!code, `${type}: new code created (${link})`);
  ok(!(await p.getByText("Пока это образец").isVisible()), `${type}: after download — the preview is the real code`);
  if (code) {
    await guest.goto(`${B}/K/${short}`, { waitUntil: "networkidle" });
    ok(await guest.locator(sel).first().isVisible({ timeout: 10000 }).catch(() => false), `${type}: scan shows the content (${sel})`);
  }
  if (type === "Телефон") await p.screenshot({ path: out + "create-phone-made.png", fullPage: true });
}

// Телефон: тот же номер ещё раз — новый код (новая оплата), а не старый; записанный иначе — тоже новый, без ошибки
for (const num of ["+374 91 555 777", "+37491555777"]) {
  await p.goto(B + "/create", { waitUntil: "networkidle" });
  await pick("Телефон");
  await field("Номер телефона").fill(num);
  await ready();
  const before = await mine();
  const { asked } = await download();
  await p.getByText("Готово — это ваш новый код").waitFor({ timeout: 10000 });
  const now = await mine();
  ok(now.length === before.length + 1, `phone "${num}" again — a new code of its own (${now.length - before.length})`);
  ok(/\$1|пакета/.test(asked ?? ""), `phone "${num}" again — the new code is paid like any other (${asked})`);
  ok(!(await p.getByText("Не сохранилось").count()), `phone "${num}" again — no "not saved" error`);
  // Тот же код в этот заход: SVG — без цены и без второго кода
  const svg = await download(/Скачать SVG/);
  ok(svg.file === "qr-code.svg" && svg.asked === null && (await mine()).length === now.length, `phone "${num}": SVG of the same code — no payment, no duplicate`);
}
// Видео-код того же кода в этот заход — тоже без оплаты и без нового кода
{
  const before = (await mine()).length;
  const [v] = await Promise.all([p.waitForEvent("download", { timeout: 60000 }), p.getByRole("button", { name: /Видео-код/ }).click()]);
  ok(/-live\.(mp4|webm)$/.test(v.suggestedFilename()) && (await mine()).length === before, `video of the same code — no payment, no new code (${v.suggestedFilename()})`);
}
// Поменял номер после скачивания — это уже другой код (снова «образец» до скачивания)
await field("Номер телефона").fill("+374 91 555 999");
await ready();
ok(await p.getByText("Пока это образец").isVisible(), "changed number after download — a new code again (sample until download)");
ok(!(await p.getByText("Готово — это ваш новый код").count()), "changed number — the «done» card is gone");

// Гость на телефоне: «Скачать» → окно входа → после входа окно оплаты видно (раньше оно открывалось под нижними
// вкладками — нажал «Скачать», и будто ничего не произошло); цена — заранее, до нажатия.
{
  const g = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: "ru-RU", isMobile: true, hasTouch: true, acceptDownloads: true });
  const q = await g.newPage();
  q.on("pageerror", (e) => errors.push(e.message));
  await q.goto(B + "/create", { waitUntil: "networkidle" });
  const r = q.getByRole("radio", { name: "Телефон", exact: true });
  await r.evaluate((e) => e.scrollIntoView({ block: "center" }));
  await r.click();
  await q.getByRole("textbox", { name: "Номер телефона", exact: true }).fill("+374 91 000 001");
  await q.waitForFunction(() => /Код читается/.test(document.body.innerText), null, { timeout: 30000 });
  await q.getByRole("button", { name: /Скачать PNG/ }).click();
  await q.getByRole("dialog", { name: "Войдите, чтобы скачать" }).getByRole("button", { name: /Лилит/ }).click();
  const pay = q.getByRole("button", { name: "Скачать бесплатно" });
  await pay.waitFor({ timeout: 10000 });
  await q.waitForTimeout(1000);
  const box = await pay.boundingBox();
  const bar = await q.locator(".x-tabbar").boundingBox();
  ok(box && bar && box.y >= 0 && box.y + box.height <= bar.y, `after sign-in the pay window is on screen, above the tab bar (${Math.round(box?.y)}–${Math.round(box?.y + box?.height)}, bar at ${Math.round(bar?.y)})`);
  await q.screenshot({ path: out + "create-pay-visible.png" });
  await Promise.all([q.waitForEvent("download"), pay.click()]);
  await q.getByText("Готово — это ваш новый код").waitFor({ timeout: 10000 });
  ok(await q.getByText("Этот код уже ваш").isVisible(), "after download the price line says the code is already yours");
  await q.getByRole("textbox", { name: "Номер телефона", exact: true }).fill("+374 91 000 002");
  await q.waitForFunction(() => /Платите один раз/.test(document.body.innerText), null, { timeout: 15000 }).catch(() => {});
  ok(await q.getByText("Платите один раз — код ваш навсегда").isVisible(), "the next code's price is shown before tapping ($1, once, forever)");
  ok((await q.locator("text=$1").count()) > 0, "price $1 is on screen");
  await g.close();
}

await browser.close();
if (errors.length) { console.log("errors:", errors); process.exit(1); }
console.log("create: ok");
process.exit(0);
