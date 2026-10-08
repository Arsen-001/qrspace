// Видео в память кода: 6 МБ (больше лимита Vercel 4,5 МБ). Без хранилища — обычной формой, с BLOB_READ_WRITE_TOKEN у
// сервера — прямо в Vercel Blob (/api/codes/<id>/upload). Затем видео отдаётся по кусочкам (Range), как просит iPhone.
import { chromium } from "playwright";
const B = process.env.E2E_BASE ?? "http://localhost:3720";
const browser = await chromium.launch();
const errors = [];
const ok = (c, m) => { console.log(c ? "  ✓" : "  ✗", m); if (!c) errors.push(m); };
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: "ru-RU" });
const p = await ctx.newPage();
p.on("pageerror", (e) => errors.push(e.message));
await p.goto(`${B}/login?next=/codes`);
await p.getByRole("button", { name: /Лилит/ }).click();
await p.waitForURL(/\/codes/);
await p.goto(`${B}/codes`, { waitUntil: "networkidle" });
await p.getByRole("button", { name: /Новый код/ }).click();
await p.getByLabel("Название кода").fill("Видео с дачи");
await p.getByRole("button", { name: "Создать" }).click();
await p.waitForURL(/\/codes\/\w+/);
const id = p.url().split("/").pop();
const direct = (await (await p.request.get(`${B}/api/codes/${id}/upload`)).json()).direct;
// Место под кодом — 1 МБ бесплатно (владелец 08.10.2026): видео 6 МБ не влезет, пока не взять пакет побольше.
const st0 = (await (await p.request.get(`${B}/api/codes/${id}`)).json()).storage;
console.log(st0?.quota === 1048576 ? "  ✓" : "  ✗", "free space under a code is 1 MB");
const bought = await p.evaluate((u) => fetch(u, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ plan: "s10" }) }).then((r) => r.json()), `/api/codes/${id}/storage`);
console.log(bought.storage?.quota === 10485760 ? "  ✓" : "  ✗", "bought 10 MB under the code");
await p.reload({ waitUntil: "networkidle" });
console.log("  · прямая загрузка в хранилище:", direct);
await p.getByRole("radio", { name: "Видео" }).click();
const size = 6 * 1024 * 1024;
const buffer = Buffer.alloc(size, 7);
await p.locator('input[type=file][accept^="video/"]').setInputFiles({ name: "dacha.mp4", mimeType: "video/mp4", buffer });
await p.getByPlaceholder("Подпись (необязательно)").fill("Дача летом");
await p.getByRole("button", { name: "Сохранить" }).click();
const video = p.locator("video[src*='/api/media/']");
await video.waitFor({ timeout: 120_000 }).catch(async () => ok(false, `video block: ${await p.locator("form .text-warn").allInnerTexts()}`));
const src = await video.getAttribute("src").catch(() => null);
if (src) {
  const whole = await p.request.get(B + src);
  ok(whole.status() === 200 && Number(whole.headers()["content-length"]) === size, `whole video ${whole.status()} ${whole.headers()["content-length"]}`);
  const part = await p.request.get(B + src, { headers: { range: "bytes=100-199" } });
  ok(part.status() === 206 && part.headers()["content-range"] === `bytes 100-199/${size}` && (await part.body()).length === 100, `range ${part.status()} ${part.headers()["content-range"]}`);
  // Чужое имя файла в форму не подсунуть.
  const res = await p.evaluate(async (u) => { const f = new FormData(); f.set("uploaded", "zzzzzzzz_aaaaaaaaaaaa.mp4"); return (await fetch(u, { method: "POST", body: f })).status; }, `/api/codes/${id}/blocks`);
  ok(res === 400, `foreign upload name rejected (${res})`);
  // Убрать за собой (в хранилище тоже).
  await p.evaluate((u) => fetch(u, { method: "DELETE" }), `/api/codes/${id}`);
}
console.log("errors:", errors.length ? errors : "none");
await browser.close();
process.exit(errors.length ? 1 : 0);
