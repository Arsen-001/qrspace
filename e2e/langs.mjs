// Новые языки (испанский, португальский, французский, немецкий): сайт открывается на языке системы,
// переключатель — список, на телефоне ничего не вылезает вбок; где перевода нет — английский, а не пусто.
import { chromium } from "playwright";
const out = new URL("./out/", import.meta.url).pathname;
const B = "http://localhost:3720";
const browser = await chromium.launch();
const errors = [];
const ok = (c, m) => { console.log(c ? "  ✓" : "  ✗", m); if (!c) errors.push(m); };
const CASES = [
  ["es-ES", "es", "Generador", "Mercado de códigos"],
  ["pt-BR", "pt", "Gerador", "Mercado de códigos"],
  ["fr-FR", "fr", "Générateur", "Marché des codes"],
  ["de-DE", "de", "Generator", "Code-Markt"],
];
for (const [locale, lang, nav, market] of CASES) {
  const p = await (await browser.newContext({ viewport: { width: 390, height: 900 }, locale })).newPage();
  p.on("pageerror", (e) => errors.push(`${lang} ${e.message}`));
  await p.goto(B + "/", { waitUntil: "networkidle" });
  ok((await p.getByRole("link", { name: nav, exact: true }).count()) === 1, `${lang}: opens in the system language`);
  ok((await p.evaluate(() => document.documentElement.lang)) === lang, `${lang}: <html lang> set`);
  for (const path of ["/", "/market", "/numbers", "/how", "/login", "/legal/privacy", "/verify"]) {
    await p.goto(B + path, { waitUntil: "networkidle" });
    const o = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    ok(o === 0, `${lang} ${path}: fits the phone${o ? ` (overflow ${o})` : ""}`);
    // Ключ словаря вместо текста (например «notice.x») — значит, перевода нет
    const raw = await p.evaluate(() => /\b(tpl|vis|notice|status|tier|preset|reason)\.[a-z]+\b/i.test(document.body.innerText));
    ok(!raw, `${lang} ${path}: no raw dictionary keys`);
  }
  await p.goto(B + "/market", { waitUntil: "networkidle" });
  ok((await p.locator(`h1:text("${market}")`).count()) === 1, `${lang}: market title translated`);
  await p.screenshot({ path: `${out}lang-${lang}-market.png`, fullPage: true });
  await p.goto(B + "/", { waitUntil: "networkidle" });
  await p.screenshot({ path: `${out}lang-${lang}-home.png`, fullPage: true });
}
// Переключение списком и запоминание
const p = await (await browser.newContext({ viewport: { width: 390, height: 900 }, locale: "ru-RU" })).newPage();
await p.goto(B + "/", { waitUntil: "networkidle" });
await p.getByRole("button", { name: "Language" }).click();
await p.getByRole("option", { name: "Français" }).click();
await p.waitForSelector("text=Générateur");
await p.goto(B + "/market", { waitUntil: "networkidle" });
ok((await p.locator('h1:text("Marché des codes")').count()) === 1, "switching language sticks across pages");
await p.getByRole("button", { name: "Language" }).click();
// с клавиатуры: первые буквы и Enter
await p.keyboard.type("ru");
await p.keyboard.press("Enter");
await p.waitForSelector("text=Генератор");
ok(true, "switch back to Russian");
console.log("errors:", errors.length ? errors : "none");
await browser.close();
