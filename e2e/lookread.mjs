// «Код читается» — правда: для разных видов скачиваем PNG и SVG того же кода и читаем оба файла (SVG — растром),
// в них должна быть настоящая короткая ссылка этого кода (проверка 10.10.2026). Плюс: похожие цвета — предупреждение,
// подпись и номер под кодом не мешают чтению, цена простого и красивого.
import fs from "node:fs";
import { chromium } from "playwright";
import { prepareZXingModule, readBarcodes } from "zxing-wasm/reader";
prepareZXingModule({ overrides: { wasmBinary: fs.readFileSync(new URL("../node_modules/zxing-wasm/dist/reader/zxing_reader.wasm", import.meta.url)).buffer }, fireImmediately: true });
const out = new URL("./out/", import.meta.url).pathname;
const B = "http://localhost:3720";
const browser = await chromium.launch();
const errors = [];
const ok = (c, m) => { console.log(c ? "  ✓" : "  ✗", m); if (!c) errors.push(m); };
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: "ru-RU", acceptDownloads: true });
await ctx.request.post(B + "/api/me", { data: { personId: "lilit" } });
const p = await ctx.newPage();
p.on("pageerror", (e) => errors.push(e.message));

/** Прочитать код из файла: картинку (и SVG) рисуем в браузере на холст и отдаём точки читалке. */
const decode = async (file) => {
  const img = await p.evaluate(
    async ({ b64, svg }) => {
      const blob = await (await fetch(`data:${svg ? "image/svg+xml" : "image/png"};base64,${b64}`)).blob();
      const url = URL.createObjectURL(blob);
      const im = new Image();
      await new Promise((r, j) => ((im.onload = r), (im.onerror = j), (im.src = url)));
      const w = 700;
      const h = Math.round((w * im.naturalHeight) / im.naturalWidth);
      const c = document.createElement("canvas");
      c.width = w;
      c.height = h;
      const g = c.getContext("2d");
      g.fillStyle = "#fff";
      g.fillRect(0, 0, w, h);
      g.drawImage(im, 0, 0, w, h);
      return { w, h, data: Array.from(g.getImageData(0, 0, w, h).data) };
    },
    { b64: fs.readFileSync(file).toString("base64"), svg: file.endsWith(".svg") },
  );
  const [r] = await readBarcodes({ data: Uint8ClampedArray.from(img.data), width: img.w, height: img.h, colorSpace: "srgb" }, { formats: ["QRCode"], tryHarder: true, tryInvert: true });
  return r?.text ?? null;
};
const settle = async () => {
  await p.waitForTimeout(400);
  await p.waitForFunction(() => /Код читается|Код плохо читается/.test(document.body.innerText) && !/Проверяем, читается/.test(document.body.innerText), null, { timeout: 30000 });
  return (await p.getByText("Код читается", { exact: true }).count()) ? "ok" : "bad";
};
const save = async (name, i) => {
  const [d] = await Promise.all([
    p.waitForEvent("download", { timeout: 30000 }),
    (async () => {
      await p.getByRole("button", { name }).click();
      const pay = p.getByRole("button", { name: /Скачать бесплатно|Оплатить и скачать|Скачать из пакета/ });
      await pay.waitFor({ timeout: 8000 }).catch(() => {});
      if (await pay.count()) await pay.click();
    })(),
  ]);
  const f = `${out}look-${i}.${d.suggestedFilename().split(".").pop()}`;
  await d.saveAs(f);
  return f;
};
const tab = (n) => p.getByRole("tab", { name: n, exact: true }).click();
const radio = (n) => p.getByRole("radio", { name: n, exact: true }).first().click();

await p.goto(B + "/create", { waitUntil: "networkidle" });
const VARIANTS = [
  ["classic", "simple", async () => {}],
  ["Лайм", "styled", () => radio("Лайм")],
  ["Ночь (light on dark)", "styled", () => radio("Ночь")],
  ["Техно (circuit)", "styled", () => radio("Техно")],
  ["Закат (gradient)", "styled", () => radio("Закат")],
  ["logo Instagram", "simple", async () => { await radio("Классика"); await p.locator("button[title='Instagram']").first().click(); await p.waitForTimeout(600); }],
  ["caption + phone", "simple", async () => {
    await p.getByRole("textbox", { name: "Текст под кодом" }).fill("Сканируй меню — Բարեւ");
    await p.getByRole("textbox", { name: "Номер телефона под кодом" }).fill("+374 91 123456");
    await p.getByRole("textbox", { name: "Номер телефона под кодом" }).blur();
  }],
  ["texture wood", "styled", async () => { await tab("Фон"); await radio("Дерево"); }],
  ["effect carved", "styled", async () => { await radio("Ровный"); await radio("Вырезанные"); }],
  ["photo", "styled", async () => { await radio("Плоско"); await tab("Фото и логотип"); await p.locator("input[type=file]").first().setInputFiles(new URL("./photo.jpg", import.meta.url).pathname); await p.waitForTimeout(1500); }],
];
let i = 0;
for (const [label, tier, act] of VARIANTS) {
  i++;
  await act();
  await p.getByLabel("Адрес сайта").fill(`example.com/look-${i}`);
  const st = await settle();
  const shownTier = (await p.locator("text=Красивый код").count()) ? "styled" : "simple";
  ok(shownTier === tier, `${label}: tier ${shownTier}`);
  if (st === "bad") await p.getByRole("button", { name: /Всё равно скачать/ }).click();
  const png = await save(/Скачать PNG/, i);
  await p.getByText("Готово — это ваш новый код").waitFor({ timeout: 10000 });
  const link = (await p.locator("section[aria-label='Готово — это ваш новый код'] p.font-mono").innerText()).trim().toUpperCase();
  const svg = await save(/Скачать SVG/, i);
  const [a, b] = [await decode(png), await decode(svg)];
  const good = (x) => (x ?? "").toUpperCase().endsWith(link);
  ok(st === "ok", `${label}: the check says it reads`);
  ok(good(a) && good(b), `${label}: downloaded PNG and SVG both hold this code's link ${link} (png ${a}, svg ${b})`);
}
await p.screenshot({ path: out + "lookread-photo.png" });

// Похожие цвета — предупреждение
await p.goto(B + "/create", { waitUntil: "networkidle" });
await p.getByLabel("Адрес сайта").fill("example.com/pale");
await p.locator("label:has-text('Точки') input[type=color]").first().fill("#e8e8e8");
await p.waitForTimeout(500);
ok(await p.getByText("Точки и фон слишком похожи").isVisible(), "pale dots on white — a warning");
const st = await settle();
ok(st === "bad" && (await p.getByRole("button", { name: /Скачать PNG/ }).isDisabled()), "pale dots: the check says it reads badly, download needs «Всё равно скачать»");

console.log("errors:", errors.length ? errors : "none");
await browser.close();
process.exit(errors.length ? 1 : 0);
