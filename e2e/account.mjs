// Кабинет после входа (владелец 09.10.2026): вход → кабинет, цифры, вкладки с адресом, меню под аватаркой, старый /profile.
import { chromium } from "playwright";
const out = new URL("./out/", import.meta.url).pathname;
const B = "http://localhost:3720";
const browser = await chromium.launch();
const errors = [];
const ok = (c, m) => { console.log(c ? "  ✓" : "  ✗", m); if (!c) errors.push(m); };

for (const w of [1280, 390]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: 900 }, locale: "ru-RU" });
  const p = await ctx.newPage();
  p.on("pageerror", (e) => errors.push(e.message));
  p.on("console", (m) => m.type() === "error" && !/401/.test(m.text()) && errors.push(m.text()));
  // Вход с главной ведёт в кабинет
  await p.goto(B + "/", { waitUntil: "networkidle" });
  await p.getByRole("link", { name: "Войти" }).first().click();
  await p.getByRole("button", { name: /Арман/ }).click();
  // После входа главная — своя: мои коды с выключателями и сканами (владелец 09.10.2026)
  await p.waitForURL(B + "/");
  await p.getByRole("heading", { name: "Мои QR-коды" }).waitFor();
  ok(true, `${w}: login lands on my own home`);
  const sw = p.getByRole("switch", { name: /Ключи от дома/ });
  await sw.click();
  ok((await sw.getAttribute("aria-checked")) === "true", `${w}: code switch opens what is under it`);
  ok(await p.getByText("сканов").first().isVisible(), `${w}: scan count shown`);
  ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${w}: home fits`);
  await p.screenshot({ path: `${out}dash-${w}.png`, fullPage: true });
  await p.getByRole("link", { name: "Создать новый QR" }).first().click();
  await p.waitForURL(/\/create$/);
  ok(true, `${w}: create button opens the generator page`);
  await p.goto(B + "/account", { waitUntil: "networkidle" });
  await p.waitForSelector("text=Сканов за 30 дней");
  ok(await p.getByText("Быстрые действия").isVisible(), `${w}: overview shown`);
  ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${w}: no horizontal scroll`);
  await p.screenshot({ path: `${out}acc-${w}-overview.png`, fullPage: true });
  // Вкладки меняют адрес
  for (const [name, tab, text] of [["Покупки", "purchases", "Потрачено"], ["Пакеты", "packs", "Сразу несколько кодов — про запас"], ["Продажи", "sales", "Заработано"], ["Настройки", "settings", "Ваше имя"], ["Мои коды", "codes", "Все коды"]]) {
    await p.locator("nav[aria-label=Кабинет]").getByRole("button", { name }).click();
    await p.waitForURL(new RegExp(`tab=${tab}`));
    await p.getByText(text).first().waitFor();
    ok(true, `${w}: tab ${tab}`);
  }
  await p.screenshot({ path: `${out}acc-${w}-codes.png` });
  if (w >= 640) {
    // Меню под аватаркой
    await p.getByRole("button", { name: /Меню аккаунта/ }).click();
    await p.getByRole("menuitem", { name: "Пакеты" }).click();
    await p.waitForURL(/tab=packs/);
    ok(true, `${w}: avatar menu opens a tab`);
  } else {
    // Телефон: кабинет — в нижних вкладках (10.10.2026)
    await p.goto(B + "/", { waitUntil: "networkidle" });
    await p.getByRole("navigation", { name: "Разделы" }).getByRole("link", { name: "Кабинет" }).click();
    await p.waitForURL(/\/account$/);
    ok(true, `${w}: bottom tab opens the account`);
  }
  await ctx.close();
}

const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: "ru-RU" });
const p = await ctx.newPage();
p.on("pageerror", (e) => errors.push(e.message));
// Гость в кабинете — просьба войти; /profile ведёт в кабинет
await p.goto(B + "/profile", { waitUntil: "networkidle" });
ok(p.url().endsWith("/account"), "/profile redirects to /account");
await p.getByText("Войдите, чтобы увидеть свои коды").waitFor();
ok(true, "guest sees sign-in prompt");
// Купили пакет во вкладке — цифра «QR в пакетах» обновилась
await p.goto(B + "/login?next=/account?tab=packs", { waitUntil: "networkidle" });
await p.getByRole("button", { name: /Лилит/ }).click();
await p.waitForURL(/tab=packs/);
await p.getByRole("button", { name: /Купить пакет: 10 QR/ }).click();
await p.waitForSelector("text=Использовано 0 из 10");
ok(true, "bought pack appears in the list");
await p.locator("nav[aria-label=Кабинет]").getByRole("button", { name: "Покупки" }).click();
await p.getByText("Пакет · 10 QR").waitFor();
// Телефоны с уведомлениями: видно и можно убрать
await p.request.post(B + "/api/devices", { data: { token: "f".repeat(50) + "PHONE1", platform: "ios", lang: "ru" } });
await p.goto(B + "/account?tab=settings", { waitUntil: "networkidle" });
await p.getByText("Телефоны с уведомлениями").waitFor();
await p.getByRole("button", { name: "Убрать" }).click();
await p.getByText("Телефоны с уведомлениями").waitFor({ state: "detached" });
ok(true, "phone listed in settings and removed");
ok(true, "pack is in purchases");
await p.getByRole("button", { name: /Меню аккаунта/ }).click();
await p.getByRole("menuitem", { name: "Выйти" }).click();
await p.waitForURL(B + "/");
ok(true, "logout from the menu");

// Вход из приложения — только вход: без меню сайта (маркет, покупки — правила магазинов)
const appLogin = await (await browser.newContext({ viewport: { width: 390, height: 844 }, locale: "ru-RU" })).newPage();
await appLogin.goto(B + "/login?next=/app/callback", { waitUntil: "networkidle" });
ok((await appLogin.getByRole("link", { name: "Маркет" }).count()) === 0 && (await appLogin.getByRole("button", { name: /Арман/ }).count()) === 1, "in-app sign-in page has no site menu");
// Вход проверяющих выключен, пока не заданы REVIEW_LOGIN и REVIEW_LOGIN_CODE
ok((await appLogin.getByText("Вход по коду проверки").count()) === 0 && (await appLogin.request.post(B + "/api/auth/review", { data: { login: "appreview", code: "test-review-code-01" } })).status() === 404, "review sign-in is off without env");

await browser.close();
if (errors.length) { console.log("errors:", errors); process.exit(1); }
console.log("account: ok");
