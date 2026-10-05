import { chromium } from "playwright";
const out = new URL("./out/", import.meta.url).pathname;
const B = "http://localhost:3720";
const browser = await chromium.launch();
const errors = [];
const mk = async (w) => {
  const ctx = await browser.newContext({ viewport: { width: w, height: 900 }, locale: "ru-RU" });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(`${w} ${e.message}`));
  page.on("console", (m) => m.type() === "error" && errors.push(`${w} ${m.text()}`));
  return page;
};
const overflow = (p) => p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
const shot = async (p, name) => { await p.screenshot({ path: out + name + ".png", fullPage: true }); console.log(name, "overflow", await overflow(p)); };

for (const w of [1280, 390]) {
  const p = await mk(w);
  await p.goto(B + "/", { waitUntil: "networkidle" });
  await shot(p, `${w}-01-generator`);
  await p.goto(B + "/codes", { waitUntil: "networkidle" });
  await shot(p, `${w}-02-codes-guest`);
  await p.getByRole("link", { name: "Войти" }).last().click();
  await p.waitForURL(/login/);
  await shot(p, `${w}-03-login`);
  await p.getByRole("button", { name: /Арман/ }).click();
  await p.waitForURL(/\/codes$/);
  await p.waitForSelector("text=Котёл");
  await p.waitForTimeout(300);
  await shot(p, `${w}-04-codes`);
  await p.getByRole("link", { name: /Котёл/ }).last().click();
  await p.waitForURL(/\/codes\/\w+/);
  await p.waitForSelector("text=Открыть как при скане", { timeout: 8000 }).catch(async (e) => { console.log("URL", p.url(), "\nMAIN", (await p.locator("body").innerText()).slice(0, 400)); await p.screenshot({ path: out + "fail.png" }); throw e; });
  await shot(p, `${w}-05-memory`);
  await p.getByRole("tab", { name: /Кто видит/ }).click();
  await shot(p, `${w}-06-access`);
  await p.getByRole("tab", { name: /Вид кода/ }).click();
  await p.waitForFunction(() => /Код (читается|плохо)/.test(document.body.innerText), null, { timeout: 20000 });
  await shot(p, `${w}-07-look`);
  if (w === 1280) {
    // Новый код: создать, добавить текст и фото, открыть доступ «все»
    await p.goto(B + "/codes", { waitUntil: "networkidle" });
    await p.getByRole("button", { name: /Новый код/ }).click();
    await p.getByLabel("Название кода").fill("Ключи от дачи");
    await p.getByRole("button", { name: "Создать" }).click();
    await p.waitForURL(/\/codes\/\w+/);
    await p.waitForSelector("text=Памяти пока нет");
    await p.getByPlaceholder("Что важно запомнить…").fill("Ключ от калитки — синий, от дома — с красной меткой.");
    await p.getByRole("button", { name: "Сохранить" }).click();
    await p.waitForSelector("text=калитки");
    await p.getByRole("radio", { name: "Фото" }).click();
    await p.locator('input[type=file][accept="image/*"]').setInputFiles(new URL("./photo.jpg", import.meta.url).pathname);
    await p.getByPlaceholder("Подпись (необязательно)").fill("Вид на дачу");
    await p.getByRole("button", { name: "Сохранить" }).click();
    await p.waitForSelector("img[alt='Вид на дачу']");
    await p.waitForFunction(() => document.querySelector("img[alt='Вид на дачу']").naturalWidth > 0);
    await shot(p, `${w}-08-new-memory`);
    await p.getByRole("tab", { name: /Кто видит/ }).click();
    await p.getByRole("radio", { name: /^Все/ }).click();
    await p.waitForSelector("text=Сохранено");
    const url = p.url().replace("/codes/", "/c/");
    // Гость без входа открывает код «для всех»
    const g = await mk(390);
    await g.goto(url, { waitUntil: "networkidle" });
    await g.waitForSelector("text=калитки");
    await shot(g, `390-09-scan-open-guest`);
    // Котёл: гость без входа — закрыт
    await p.goto(B + "/codes", { waitUntil: "networkidle" });
    const boiler = await p.getByRole("link", { name: /Котёл/ }).last().getAttribute("href");
    await g.goto(B + boiler.replace("/codes/", "/c/"), { waitUntil: "networkidle" });
    await g.waitForSelector("text=Код закрыт");
    await shot(g, `390-10-scan-closed-guest`);
    // Войти Давидом прямо отсюда — открыто для чтения
    await g.getByRole("link", { name: /Войдите/ }).click();
    await g.getByRole("button", { name: /Давид/ }).click();
    await g.waitForSelector("text=Открыть кран");
    await shot(g, `390-11-scan-david`);
    // Ани — может дописывать
    await g.goto(B + "/login?next=" + encodeURIComponent(boiler.replace("/codes/", "/c/")));
    await g.getByRole("button", { name: /Ани/ }).click();
    await g.waitForSelector("text=Вам можно дописывать");
    await shot(g, `390-12-scan-ani`);
    // Хозяин смотрит историю
    await p.goto(B + boiler, { waitUntil: "networkidle" });
    await p.getByRole("tab", { name: /Кто видит/ }).click();
    await shot(p, `1280-13-history`);
  }
}
console.log("errors:", errors.length ? errors : "none");
await browser.close();
