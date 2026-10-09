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
  await p.waitForURL(/\/account$/);
  await p.waitForSelector("text=Сканов за 30 дней");
  ok(true, `${w}: login lands in the account`);
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
  // Меню под аватаркой
  await p.getByRole("button", { name: /Меню аккаунта/ }).click();
  await p.getByRole("menuitem", { name: "Пакеты" }).click();
  await p.waitForURL(/tab=packs/);
  ok(true, `${w}: avatar menu opens a tab`);
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
ok(true, "pack is in purchases");
await p.getByRole("button", { name: /Меню аккаунта/ }).click();
await p.getByRole("menuitem", { name: "Выйти" }).click();
await p.waitForURL(B + "/");
ok(true, "logout from the menu");

await browser.close();
if (errors.length) { console.log("errors:", errors); process.exit(1); }
console.log("account: ok");
