import { chromium } from "playwright";
const out = new URL("./out/", import.meta.url).pathname;
const B = "http://localhost:3720";
const browser = await chromium.launch();
const errors = [];
const mk = async (w, locale = "ru-RU") => {
  const ctx = await browser.newContext({ viewport: { width: w, height: 900 }, locale });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(`${w} ${e.message}`));
  page.on("console", (m) => m.type() === "error" && !/409/.test(m.text()) && errors.push(`${w} ${m.text()}`));
  return page;
};
const shot = async (p, name) => { await p.waitForTimeout(300); await p.screenshot({ path: out + name + ".png", fullPage: true }); const o = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth); console.log(name, o ? `OVERFLOW ${o}` : "ok"); };
const ok = (c, m) => { console.log(c ? "  ✓" : "  ✗", m); if (!c) errors.push(m); };

for (const w of [1280, 390]) {
  const p = await mk(w);
  await p.goto(B + "/market", { waitUntil: "networkidle" });
  await p.waitForSelector("text=Осталось");
  await shot(p, `m-${w}-market`);
}
// каждый дизайн читается: со ссылкой-образцом и с длинной ссылкой
const p = await mk(1280);
const ids = ["nebula", "parchment", "circuit", "wood", "liquid", "hearts", "linen", "kraft"];
for (const id of ids) {
  await p.goto(`${B}/market/${id}`, { waitUntil: "networkidle" });
  for (const link of ["", "https://booktime.am/salon/ararat-beauty-studio?utm_source=qr&utm_campaign=autumn"]) {
    await p.locator("#try-link").fill(link);
    await p.waitForFunction(() => /Код читается|Код плохо/.test(document.body.innerText), null, { timeout: 30000 });
    const good = (await p.locator("text=Код читается").count()) > 0;
    ok(good, `${id} reads ${link ? "(long link)" : "(sample)"}`);
  }
  if (id === "nebula") await shot(p, "m-1280-design");
}
// покупка
await p.goto(B + "/market/linen", { waitUntil: "networkidle" });
ok(await p.locator("text=Войдите, чтобы купить").count() === 1, "guest sees sign-in to buy");
await p.goto(B + "/login?next=/market/linen");
await p.getByRole("button", { name: /Арман/ }).click();
await p.waitForURL(/market\/linen/);
await p.waitForSelector("button:has-text('Раскуплено')");
ok(await p.getByRole("button", { name: "Раскуплено" }).isDisabled(), "sold-out edition can't be bought");
await p.goto(B + "/market/nebula", { waitUntil: "networkidle" });
await p.getByRole("button", { name: /Купить — \$15/ }).click();
await p.waitForURL(/\/codes\/\w+/);
await p.waitForSelector("text=№ 22 / 30");
ok(true, "bought nebula #22/30, editor opened");
await shot(p, "m-1280-bought");
await p.goto(B + "/codes", { waitUntil: "networkidle" });
await p.waitForSelector("text=№ 22 / 30");
ok(true, "edition badge in my codes");
const m = await mk(390);
await m.goto(B + "/market/nebula", { waitUntil: "networkidle" });
await m.waitForSelector("text=Осталось 8 из 30");
ok(true, "left count updated (8 of 30)");
await shot(m, "m-390-design");
const h = await mk(390, "hy-AM");
await h.goto(B + "/market", { waitUntil: "networkidle" });
await shot(h, "m-390-hy-market");
console.log("errors:", errors.length ? errors : "none");
await browser.close();
