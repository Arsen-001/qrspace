// Большой файл под код (владелец 09.10.2026): «скидывают большое — смотрим, сколько мегабайт, показываем цену, он платит,
// потом позволяем загрузить; не было так, чтобы показывали 5 МБ, разрешали, а он сразу поменял и загрузил 1 ГБ».
// Не влезает → размер, свободно, нужное место и цена → «Оплатить и загрузить» → запись есть, место — оплаченное.
// Схитрить: файл больше оплаченного места сервер не берёт (меряет сам), разрешение на загрузку — только под размер.
import { chromium } from "playwright";
const out = new URL("./out/", import.meta.url).pathname;
const B = process.env.E2E_BASE ?? "http://localhost:3720";
const browser = await chromium.launch();
const errors = [];
const ok = (c, m) => { console.log(c ? "  ✓" : "  ✗", m); if (!c) errors.push(m); };
const MB = 1024 * 1024;
const login = async (who, w = 1280) => {
  const ctx = await browser.newContext({ viewport: { width: w, height: 900 }, locale: "ru-RU" });
  const p = await ctx.newPage();
  p.on("pageerror", (e) => errors.push(e.message));
  await p.goto(`${B}/login?next=/codes`);
  await p.getByRole("button", { name: new RegExp(who) }).click();
  await p.waitForURL((u) => !u.pathname.startsWith("/login"));
  return p;
};
const codeId = async (p, title) => (await (await p.request.get(`${B}/api/codes`)).json()).mine.concat((await (await p.request.get(`${B}/api/codes`)).json()).shared).find((c) => c.title === title).id;

// Хозяин: видео 3 МБ в код с бесплатным 1 МБ
for (const w of [1280, 390]) {
  const p = await login("Лилит", w);
  await p.goto(`${B}/codes`, { waitUntil: "networkidle" });
  await p.getByRole("button", { name: /Новый код/ }).click();
  await p.getByLabel("Название кода").fill(`Большое видео ${w}`);
  await p.getByRole("button", { name: "Создать" }).click();
  await p.waitForURL(/\/codes\/\w+/);
  const id = p.url().split("/").pop();
  await p.getByRole("radio", { name: "Видео" }).click();
  await p.locator('input[type=file][accept^="video/"]').setInputFiles({ name: "big.mp4", mimeType: "video/mp4", buffer: Buffer.alloc(3 * MB, 7) });
  // Цену видно сразу после выбора — до «Сохранить»
  const offer = p.getByRole("alert").filter({ hasText: "Файл не помещается под кодом" });
  await offer.waitFor();
  const text = await offer.innerText();
  ok(/Файл: 3 MB/.test(text) && /из 1 MB/.test(text), `${w}: file size and free space shown (${text.split("\n")[1]})`);
  ok(/Нужно место 10 MB — \$1 в месяц/.test(text), `${w}: needed space and price shown`);
  await offer.screenshot({ path: `${out}room-${w}-offer.png` });
  await offer.getByRole("button", { name: "Оплатить $1 и загрузить" }).click();
  await p.locator("video[src*='/api/media/']").waitFor({ timeout: 60_000 });
  const c = await (await p.request.get(`${B}/api/codes/${id}`)).json();
  ok(c.storage.quota === 10 * MB && c.blocks.some((b) => b.kind === "video" && b.size === 3 * MB), `${w}: paid for 10 MB, video saved (${c.storage.used} / ${c.storage.quota})`);
  ok(!(await offer.isVisible()), `${w}: offer gone after upload`);
  ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${w}: fits the screen`);

  if (w === 1280) {
    // Схитрить формой: 20 МБ при оплаченных 10 — сервер меряет файл сам и не берёт
    const big = await p.evaluate(async ([u, n]) => { const f = new FormData(); f.set("text", ""); f.set("file", new Blob([new Uint8Array(n)], { type: "video/mp4" }), "x.mp4"); return (await fetch(u, { method: "POST", body: f })).status; }, [`/api/codes/${id}/blocks`, 20 * MB]);
    ok(big === 413, `file bigger than paid space rejected by the server (${big})`);
    // Разрешение на прямую загрузку — только под размер файла и свободное место (без хранилища на этом компьютере — 404)
    const direct = (await (await p.request.get(`${B}/api/codes/${id}/upload`)).json()).direct;
    if (direct) {
      const token = (size) => p.evaluate(async ([u, s]) => (await fetch(u, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ type: "blob.generate-client-token", payload: { pathname: u.split("/")[3] + "_aaaaaaaaaaaa.mp4", clientPayload: JSON.stringify({ size: s }), multipart: false } }) })).status, [`/api/codes/${id}/upload`, size]);
      ok((await token(20 * MB)) === 403, "upload permission refused for a file bigger than free space");
      ok((await token(1 * MB)) === 200, "upload permission given for a file that fits");
    } else console.log("  · прямой загрузки нет (нет хранилища) — разрешение проверяется на выкладке");
    // Оплата места — в «Покупках» кабинета и в «Потрачено»
    await p.goto(`${B}/account?tab=purchases`, { waitUntil: "networkidle" });
    await p.getByText("Место под кодом · 10 MB").first().waitFor();
    ok((await p.getByText("Потрачено").first().innerText()).includes("$1"), "space purchase listed in account purchases and spent");
  }
  await p.context().close();
}

// Не хозяин (может дописывать): цену не предлагаем — купить место может только хозяин
const a = await login("Ани");
const boiler = await codeId(a, "Котёл — как включить");
await a.goto(`${B}/c/${boiler}`, { waitUntil: "networkidle" });
await a.getByRole("radio", { name: "Видео" }).click();
await a.locator('input[type=file][accept^="video/"]').setInputFiles({ name: "big.mp4", mimeType: "video/mp4", buffer: Buffer.alloc(2 * MB, 7) });
const offer = a.getByRole("alert").filter({ hasText: "Файл не помещается под кодом" });
await offer.waitFor();
ok(/может только хозяин/.test(await offer.innerText()) && !(await offer.getByRole("button", { name: /Оплатить/ }).count()), "editor sees 'only the owner can buy space', no pay button");

await browser.close();
if (errors.length) { console.log("errors:", errors); process.exit(1); }
console.log("room: ok");
