// Ввод на телефоне не отстаёт (проверка 10.10.2026): процессор замедлен в 4 раза, как у недорогого телефона. Раньше каждая
// буква в шаге 1 перерисовывала весь генератор (сотни плиток вида, рисунок кода дважды) — ~130 мс на букву и десятки
// «длинных задач»; подпись под кодом перерисовывала код и проверку на каждую букву. Порог с запасом: на загруженном
// компьютере цифры выше, но прежние зависания он ловит.
import { chromium } from "playwright";
const B = "http://localhost:3720";
const browser = await chromium.launch();
const errors = [];
const ok = (c, m) => { console.log(c ? "  ✓" : "  ✗", m); if (!c) errors.push(m); };
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: "ru-RU", isMobile: true, hasTouch: true, deviceScaleFactor: 3 });
await ctx.request.post(B + "/api/me", { data: { personId: "ani" } });
const p = await ctx.newPage();
p.on("pageerror", (e) => errors.push(e.message));
await p.goto(B + "/create", { waitUntil: "networkidle" });
const cdp = await ctx.newCDPSession(p);

/** Напечатать в поле на замедленном процессоре: сколько «длинных задач» (>50 мс) и задержка от нажатия до кадра. */
const measure = async (box, text) => {
  await box.evaluate((e) => e.scrollIntoView({ block: "center" }));
  await box.click();
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  await p.waitForTimeout(1200);
  await p.evaluate(() => {
    window.__lt = [];
    new PerformanceObserver((l) => l.getEntries().forEach((e) => window.__lt.push(e.duration))).observe({ type: "longtask" });
    window.__lat = [];
    document.addEventListener("keydown", () => { const t0 = performance.now(); requestAnimationFrame(() => setTimeout(() => window.__lat.push(performance.now() - t0), 0)); }, true);
  });
  await p.keyboard.type(text, { delay: 90 });
  await p.waitForTimeout(1500);
  const r = await p.evaluate(() => ({ lt: window.__lt.filter((d) => d > 100).length, lat: window.__lat.sort((a, b) => a - b) }));
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
  return { long: r.lt, p50: Math.round(r.lat[r.lat.length >> 1]) };
};

const txt = p.getByRole("radio", { name: "Текст", exact: true });
await txt.evaluate((e) => e.scrollIntoView({ block: "center" }));
await txt.click();
const a = await measure(p.getByRole("textbox", { name: "Текст", exact: true }), "Привет, это проверка скорости ввода на телефоне");
ok(a.p50 < 90 && a.long <= 6, `step 1 text: ${a.p50} ms per key, ${a.long} tasks over 100 ms (was ~130 ms and 40+)`);
const b = await measure(p.getByRole("textbox", { name: "Текст под кодом" }), "Сканируй меню кафе");
ok(b.p50 < 90 && b.long <= 4, `caption under the code: ${b.p50} ms per key, ${b.long} tasks over 100 ms (was ~150 ms and 19)`);
// Подпись дошла до кода после паузы
await p.waitForTimeout(800);
ok(await p.evaluate(() => [...document.querySelectorAll("svg text")].some((t) => t.textContent.includes("Сканируй меню кафе"))), "the caption reaches the code after a pause");

console.log("errors:", errors.length ? errors : "none");
await browser.close();
process.exit(errors.length ? 1 : 0);
