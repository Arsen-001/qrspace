import { chromium } from "playwright";
const out = new URL("./out/", import.meta.url).pathname;
const B = "http://localhost:3720";
const browser = await chromium.launch();
const errors = [];
const mk = async (w, locale = "ru-RU") => {
  const ctx = await browser.newContext({ viewport: { width: w, height: 900 }, locale });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(`${w} ${e.message}`));
  page.on("console", (m) => m.type() === "error" && !/429/.test(m.text()) && errors.push(`${w} ${m.text()}`));
  return page;
};
const shot = async (p, name) => { await p.waitForTimeout(250); await p.screenshot({ path: out + name + ".png", fullPage: true }); const o = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth); console.log(name, o ? `OVERFLOW ${o}` : "ok"); };
const ok = (cond, msg) => { console.log(cond ? "  ✓" : "  ✗", msg); if (!cond) errors.push(msg); };

const o = await mk(1280);
await o.goto(B + "/login");
await o.getByRole("button", { name: /Арман/ }).click();
await o.waitForSelector("text=Моя машина");
await shot(o, "t-01-codes");
const href = async (name) => o.getByRole("link", { name }).first().getAttribute("href");
const car = await href(/Моя машина/), keys = await href(/Ключи от дома/), pet = await href(/Бублик/);
const scan = (h) => B + h.replace("/codes/", "/c/");

await o.goto(B + car);
await o.waitForSelector("text=Сообщения через нас");
ok(await o.getByRole("tab", { name: /Связь/ }).getAttribute("aria-selected") === "true", "car opens on Contact tab");
await shot(o, "t-02-car-contact");

const g = await mk(390);
await g.goto(scan(car), { waitUntil: "networkidle" });
await g.waitForSelector("text=Написать владельцу");
ok(!(await g.locator("text=+374").count()), "phone hidden while switch off");
ok(!(await g.locator("text=Арман").count()), "owner name hidden on car");
ok(await g.locator("text=Связаться с владельцем машины").count() === 1, "generic car heading (title hidden)");
await shot(g, "t-03-car-scan-guest");
await g.getByRole("radio", { name: "Ваша машина перекрыла выезд" }).click();
await g.getByPlaceholder("Телефон или почта для ответа").fill("+374 77 000000");
await g.getByRole("button", { name: "Отправить" }).click();
await g.waitForSelector("text=Отправлено");
await shot(g, "t-04-car-sent");

// хозяин: сообщение пришло; включает номер
await o.reload();
await o.waitForSelector("text=Ваша машина перекрыла выезд");
ok(await o.locator("text=+374 77 000000").count() === 1, "owner sees reply contact");
await o.getByRole("switch", { name: /Показывать мой номер/ }).check({ force: true });
await o.waitForSelector("text=Сейчас номер видят все");
await g.reload({ waitUntil: "networkidle" });
await g.waitForSelector("text=Позвонить владельцу");
ok((await g.locator("a[href^='tel:']").getAttribute("href")) === "tel:+37499123456", "call link appears when switch on");
await shot(g, "t-05-car-phone-on");
await o.getByRole("switch", { name: /Показывать мой номер/ }).uncheck({ force: true });
await o.waitForSelector("text=Сейчас номер скрыт");

// лимит: ещё 5 сообщений от того же гостя
let limited = false;
for (let i = 0; i < 6 && !limited; i++) {
  await g.getByRole("button", { name: /Написать ещё/ }).click().catch(() => {});
  await g.getByPlaceholder("Сообщение").fill("тест " + i);
  await g.getByRole("button", { name: "Отправить" }).click();
  await g.waitForSelector("text=/Отправлено|Слишком много/");
  limited = (await g.locator("text=Слишком много").count()) > 0;
}
ok(limited, "rate limit kicks in");

// ключи: название скрыто; «Потеряно» с вознаграждением
await g.goto(scan(keys), { waitUntil: "networkidle" });
await g.waitForSelector("text=Нашли эту вещь?");
ok(!(await g.locator("text=Ключи от дома").count()), "keys title hidden");
await shot(g, "t-06-keys-scan");
await o.goto(B + keys);
await o.getByRole("switch", { name: /Режим «Потеряно»/ }).check({ force: true });
await o.waitForSelector("text=Включён");
await shot(o, "t-07-keys-contact");
await g.reload({ waitUntil: "networkidle" });
await g.waitForSelector("text=Хозяин ищет эту вещь");
ok(await g.locator("text=5 000 ֏").count() === 1, "reward shown when lost");
await shot(g, "t-08-keys-lost");

// питомец: анкета открыта, хозяин скрыт
await g.goto(scan(pet), { waitUntil: "networkidle" });
await g.waitForSelector("text=Бублик, 3 года");
ok(!(await g.locator("text=Арман").count()), "pet owner hidden");
await shot(g, "t-09-pet-scan");

// новый код «Машина» через форму
await o.goto(B + "/codes");
await o.getByRole("button", { name: /Новый код/ }).click();
await o.getByRole("radio", { name: /Машина/ }).click();
await shot(o, "t-10-new-code");
await o.getByLabel("Название кода").fill("Вторая машина");
await o.getByRole("button", { name: "Создать" }).click();
await o.waitForURL(/\/codes\/\w+/);
await o.waitForSelector("text=Сообщения через нас");
ok(true, "new car code created");

// армянский и телефон: настройки связи
const h = await mk(390, "hy-AM");
await h.goto(B + "/login");
await h.getByRole("button", { name: /Արման/ }).click();
await h.waitForURL(/codes$/);
await h.goto(B + car);
await h.waitForSelector("text=Հաղորդագրություններ մեր միջոցով");
await shot(h, "t-11-hy-car-contact");
await h.goto(scan(car), { waitUntil: "networkidle" });
console.log("errors:", errors.length ? errors : "none");
await browser.close();
