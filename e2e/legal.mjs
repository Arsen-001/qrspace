// Юридические страницы: все три открываются на трёх языках, ссылки в подвале и у входа, телефон без прокрутки вбок.
import { chromium } from "playwright";
const out = new URL("./out/", import.meta.url).pathname;
const B = "http://localhost:3720";
const browser = await chromium.launch();
const errors = [];
const ok = (c, m) => { console.log(c ? "  ✓" : "  ✗", m); if (!c) errors.push(m); };
for (const [locale, title] of [["ru-RU", "Условия использования"], ["en-GB", "Terms of use"], ["hy-AM", "Օգտագործման պայմաններ"]]) {
  const p = await (await browser.newContext({ viewport: { width: 390, height: 900 }, locale })).newPage();
  p.on("pageerror", (e) => errors.push(e.message));
  await p.goto(B + "/", { waitUntil: "networkidle" });
  await p.getByRole("link", { name: title }).first().click();
  await p.waitForSelector(`h1:text("${title}")`);
  ok(true, `${locale}: footer → terms`);
  for (const doc of ["privacy", "refunds"]) {
    await p.goto(`${B}/legal/${doc}`, { waitUntil: "networkidle" });
    ok((await p.locator("h2").count()) >= 5, `${locale}: ${doc} has sections`);
    ok((await p.evaluate(() => document.documentElement.scrollWidth - innerWidth)) === 0, `${locale}: ${doc} fits the phone`);
  }
  await p.screenshot({ path: `${out}legal-${locale}.png`, fullPage: true });
}
const l = await (await browser.newContext({ locale: "ru-RU" })).newPage();
await l.goto(B + "/login", { waitUntil: "networkidle" });
ok(await l.getByRole("link", { name: "Конфиденциальность" }).count() >= 1, "sign-in page links to privacy");
const nf = await l.goto(B + "/legal/nothing");
ok(nf?.status() === 404, "unknown legal page → 404");
console.log("errors:", errors.length ? errors : "none");
await browser.close();
