// Форма кода (владелец 10.10.2026: «вид QR-кода не могу полностью изменять, а не сделать его квадратным?»): круг,
// соты, сердце, капля, клякса — каждая читается (проверка сайта) с разными точками и с украшениями вокруг; скачанный PNG — по форме
// (углы прозрачные) и читается с настоящей ссылкой кода; рисунок с сервера (приложения) — тоже по форме.
import { createRequire } from "node:module";
import { readBarcodes } from "zxing-wasm/reader";
import { chromium } from "playwright";
const sharp = createRequire(import.meta.url)("sharp");
const out = new URL("./out/", import.meta.url).pathname;
const B = "http://localhost:3720";
const errors = [];
const ok = (c, m) => { console.log(c ? "  ✓" : "  ✗", m); if (!c) errors.push(m); };
const decode = async (buf) => {
  const { data, info } = await sharp(buf).flatten({ background: "#ffffff" }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const r = await readBarcodes({ data: new Uint8ClampedArray(data), width: info.width, height: info.height, colorSpace: "srgb" }, { formats: ["QRCode"], maxNumberOfSymbols: 1 });
  return r.find((x) => x.isValid)?.text ?? null;
};
const alphaAt = async (buf, x, y) => {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return data[(Math.round(y * (info.height - 1)) * info.width + Math.round(x * (info.width - 1))) * 4 + 3];
};

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: "ru-RU", isMobile: true, hasTouch: true, acceptDownloads: true });
await ctx.request.post(B + "/api/me", { data: { personId: "lilit" } });
const p = await ctx.newPage();
p.on("pageerror", (e) => errors.push(e.message));
const verdict = async () => {
  await p.waitForTimeout(400);
  await p.waitForFunction(() => /Код читается|может не прочитать/.test(document.body.innerText) && !/Проверяем/.test(document.body.innerText), null, { timeout: 30000 }).catch(() => {});
  return (await p.getByText("Код читается").count()) > 0;
};
const pickIn = async (group, name) => {
  const r = p.getByRole("radiogroup", { name: group }).getByRole("radio", { name, exact: true });
  await r.evaluate((e) => e.scrollIntoView({ block: "center" }));
  await r.click();
};

await p.goto(B + "/create", { waitUntil: "networkidle" });
await p.getByRole("textbox", { name: "Адрес сайта", exact: true }).fill("example.com/shapes");
await p.getByRole("tab", { name: "Форма", exact: true }).click();
ok(await p.getByRole("radiogroup", { name: "Форма кода" }).isVisible(), "«Форма кода» is the first thing in the «Форма» tab");
for (const dot of ["Квадраты", "Блоки", "Жидкие"]) {
  await pickIn("Точки", dot);
  for (const shape of ["Круг", "Соты", "Сердце", "Капля", "Клякса"]) {
    await pickIn("Форма кода", shape);
    ok(await verdict(), `${shape} × ${dot}: the code reads`);
  }
}
ok(await p.getByText("Красивый код").count() > 0, "a shaped code is the styled tier");

// Украшения вокруг (искры, звёзды, сердечки, конфетти) — за пустой рамкой: код читается и с ними, и с формой
for (const [orn, shape] of [["Искры", "Квадрат"], ["Звёзды", "Круг"], ["Сердечки", "Сердце"], ["Конфетти", "Клякса"]]) {
  await pickIn("Форма кода", shape);
  await pickIn("Украшения вокруг", orn);
  ok(await verdict(), `${orn} around × ${shape}: the code reads`);
}
await pickIn("Украшения вокруг", "Нет");

// Скачать сердце: PNG по форме (углы прозрачные), читается — с настоящей ссылкой кода
await pickIn("Точки", "Квадраты");
await pickIn("Форма кода", "Сердце");
await verdict();
await p.screenshot({ path: out + "shapes-heart.png", fullPage: true });
const [dl] = await Promise.all([
  p.waitForEvent("download", { timeout: 30000 }),
  (async () => {
    await p.getByRole("button", { name: /Скачать PNG/ }).click();
    const pay = p.getByRole("button", { name: /Скачать бесплатно|Оплатить и скачать|Скачать из пакета/ });
    await pay.waitFor({ timeout: 5000 }).catch(() => {});
    if (await pay.count()) await pay.click();
  })(),
]);
const png = await (await import("node:fs/promises")).readFile(await dl.path());
const link = await decode(png);
ok(/\/K\/[A-Z2-9]{6}$/.test(link ?? ""), `downloaded heart PNG reads: ${link}`);
ok((await alphaAt(png, 0.02, 0.98)) === 0 && (await alphaAt(png, 0.5, 0.5)) === 255, "outside the heart is transparent, inside is solid");

// Рисунок с сервера (приложения) — та же форма
const mine = (await (await ctx.request.get(B + "/api/codes")).json()).mine;
const code = mine.find((c) => link && link.endsWith(`/K/${c.short}`));
ok(code?.style?.shape === "heart", "the code keeps its shape on the server");
if (code) {
  const img = await ctx.request.get(`${B}/api/codes/${code.id}/image?format=png&size=1024`);
  const buf = await img.body();
  ok((await decode(buf)) === link && (await alphaAt(buf, 0.02, 0.98)) === 0, "server picture (apps) is the heart too and reads");
}

await browser.close();
if (errors.length) { console.log("errors:", errors); process.exit(1); }
console.log("shapes: ok");
process.exit(0);
