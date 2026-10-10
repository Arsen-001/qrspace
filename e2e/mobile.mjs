// Телефон — каждый экран сайта (владелец 10.10.2026: «полностью сосредоточимся на мобильной веб-версии каждого экрана»).
// Ширины 320 / 360 / 390 / 430: страница не ездит вбок, ничего не торчит за край, поля ввода не меньше 16px (иначе
// iPhone увеличивает страницу при вводе), кнопки и ссылки не меньше 40px, текст не мельче 11px. Снимки 360 — e2e/out/m/.
// Запуск: node e2e/mobile.mjs [часть имени экрана…]
import { mkdirSync } from "node:fs";
import { chromium, request } from "playwright";
const B = "http://localhost:3720";
const out = new URL("./out/m/", import.meta.url).pathname;
mkdirSync(out, { recursive: true });
const WIDTHS = [320, 360, 390, 430];
const SHOT = 360;
const only = process.argv.slice(2);
const errors = [];

// id кодов и лотов демо-данных
const asApi = async (who) => {
  const r = await request.newContext({ baseURL: B });
  if (who) await r.post("/api/me", { data: { personId: who } });
  return r;
};
const arman = await asApi("arman");
const mine = (await (await arman.get("/api/codes")).json()).mine;
const id = (title) => mine.find((c) => c.title.startsWith(title))?.id;
const lots = await (await arman.get("/api/listings")).json();
const lot = lots[0]?.id;
const short = mine.find((c) => c.title.startsWith("Wi"))?.short;

const tabs = async (p, shot) => {
  const list = p.locator("[role=tablist] [role=tab]");
  const n = await list.count();
  for (let i = 1; i < n; i++) {
    await list.nth(i).click();
    await p.waitForTimeout(400);
    await shot(`tab${i}`);
  }
};
const click = (name) => async (p) => {
  await p.getByRole("button", { name }).first().click();
  await p.waitForTimeout(500);
};

/** Экран: имя, кто смотрит (null — гость), адрес, что сделать после загрузки (может снять дополнительные снимки). */
const SCREENS = [
  ["home-guest", null, "/"],
  ["create", null, "/create"],
  ["create-wifi", null, "/create", async (p) => { const b = p.locator("button:visible", { hasText: /^Wi.?Fi$/ }).first(); await b.evaluate((e) => e.scrollIntoView({ block: "center" })); await b.click(); await p.waitForTimeout(400); }],
  ["market", null, "/market"],
  ["market-design", null, "/market/nebula"],
  ["market-lot", null, `/market/lot/${lot}`],
  ["how", null, "/how"],
  ["scan", null, "/scan"],
  ["verify", null, "/verify"],
  ["legal-terms", null, "/legal/terms"],
  ["legal-privacy", null, "/legal/privacy"],
  ["legal-refunds", null, "/legal/refunds"],
  ["login", null, "/login"],
  ["login-app", null, "/login?next=/app/callback"],
  ["c-wifi-guest", null, `/c/${id("Wi")}`],
  ["c-boiler-guest", null, `/c/${id("Котёл")}`],
  ["c-pet-guest", null, `/c/${id("Бублик")}`],
  ["c-car-guest", null, `/c/${id("Моя машина")}`],
  ["c-lost-guest", null, `/c/${id("Ключи")}`],
  ["c-album-guest", null, `/c/${id("Семейный")}`],
  ["short-link", null, `/K/${short}`],
  ["home-signed", "arman", "/"],
  ["codes", "arman", "/codes"],
  ["create-signed", "arman", "/create"],
  ["print", "arman", "/codes/print"],
  ["edit-boiler", "arman", `/codes/${id("Котёл")}`, tabs],
  ["edit-wifi", "arman", `/codes/${id("Wi")}`, tabs],
  ["edit-car", "arman", `/codes/${id("Моя машина")}`, tabs],
  ["edit-pet", "arman", `/codes/${id("Бублик")}`, tabs],
  ["edit-lost", "arman", `/codes/${id("Ключи")}`, tabs],
  ["c-boiler-owner", "arman", `/c/${id("Котёл")}`],
  ["c-car-owner", "arman", `/c/${id("Моя машина")}`],
  ["c-boiler-editor", "ani", `/c/${id("Котёл")}`],
  ["c-boiler-viewer", "david", `/c/${id("Котёл")}`],
  ["c-boiler-request", "lilit", `/c/${id("Котёл")}`],
  ["c-album-closed", "lilit", `/c/${id("Семейный")}`],
  ["account", "arman", "/account"],
  ["account-purchases", "arman", "/account?tab=purchases"],
  ["account-packs", "arman", "/account?tab=packs"],
  ["account-sales", "arman", "/account?tab=sales"],
  ["account-settings", "arman", "/account?tab=settings"],
  ["account-codes", "arman", "/account?tab=codes"],
  ["bell", "arman", "/", click(/Уведомления/)],
  ["lang", "arman", "/", async (p) => { await p.getByRole("button", { name: "Language" }).first().click(); await p.waitForTimeout(400); }],
  ["market-signed", "ani", "/market"],
  ["designer-market", "nare", "/market"],
  ["admin", "admin", "/admin"],
];

/** Проблемы на открытой странице. */
// Ширина — та, что задана экрану: на телефоне браузер сам уменьшает масштаб, если что-то шире, и innerWidth растёт.
const audit = (p, W) =>
  p.evaluate((W) => {
    const found = [];
    const vis = (el) => {
      const s = getComputedStyle(el);
      const b = el.getBoundingClientRect();
      return s.visibility !== "hidden" && s.display !== "none" && +s.opacity > 0 && b.width > 2 && b.height > 2;
    };
    const name = (el) => {
      const t = (el.getAttribute("aria-label") || el.textContent || el.getAttribute("placeholder") || el.getAttribute("name") || "").trim().replace(/\s+/g, " ").slice(0, 40);
      return `${el.tagName.toLowerCase()}${t ? ` «${t}»` : ""}`;
    };
    const clipped = (el) => {
      for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) if (/(auto|scroll|hidden|clip)/.test(getComputedStyle(a).overflowX)) return true;
      return false;
    };
    const head = document.querySelector("body header");
    if (head && head.getBoundingClientRect().height > 84) found.push(`header wraps: ${Math.round(head.getBoundingClientRect().height)}px`);
    const wide = Math.max(innerWidth, document.documentElement.scrollWidth);
    if (wide > W + 1) found.push(`wider than the screen: ${wide}px`);
    for (const el of document.body.querySelectorAll("*")) {
      if (!vis(el) || el.closest("[aria-hidden=true], svg")) continue;
      const b = el.getBoundingClientRect();
      if ((b.right > W + 1 || b.left < -1) && !clipped(el) && getComputedStyle(el).position !== "fixed") found.push(`sticks out ${Math.round(b.left)}…${Math.round(b.right)}: ${name(el)}`);
    }
    for (const el of document.querySelectorAll("input:not([type=checkbox]):not([type=radio]):not([type=range]):not([type=color]):not([type=file]):not([type=hidden]), select, textarea")) {
      if (vis(el) && parseFloat(getComputedStyle(el).fontSize) < 16) found.push(`input font ${getComputedStyle(el).fontSize} (iPhone zooms): ${name(el)}`);
    }
    for (const el of document.querySelectorAll("a[href], button, [role=button], [role=tab], [role=switch], [role=menuitem], select, summary")) {
      if (!vis(el)) continue;
      const s = getComputedStyle(el);
      if (el.tagName === "A" && s.display === "inline" && el.closest("p, li, span")) continue; // ссылка в тексте
      const b = el.getBoundingClientRect();
      // Невидимая зона нажатия шире значка: ::before с отрицательным inset (так у «?» и маленьких значков).
      const pre = getComputedStyle(el, "::before");
      const grow = pre.content !== "none" && pre.position === "absolute" ? Math.max(0, -parseFloat(pre.top) || 0) * 2 : 0;
      if (b.height + grow < 40 || b.width + grow < 40) found.push(`small target ${Math.round(b.width)}×${Math.round(b.height)}: ${name(el)}`);
    }
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const el = n.parentElement;
      // Наклейки на листе печати — в миллиметрах (настоящий размер на бумаге), их не считаем.
      if (!el || !n.textContent.trim() || !vis(el) || el.closest('[aria-hidden=true], svg, .sr-only, [style*="mm"]')) continue;
      const fs = parseFloat(getComputedStyle(el).fontSize);
      if (fs < 11) found.push(`tiny text ${fs}px: «${n.textContent.trim().slice(0, 30)}»`);
    }
    return [...new Set(found)];
  }, W);

const browser = await chromium.launch();
const ctxs = new Map();
const ctxFor = async (who, w) => {
  const k = `${who}:${w}`;
  if (!ctxs.has(k)) {
    const ctx = await browser.newContext({ viewport: { width: w, height: 780 }, locale: "ru-RU", deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    if (who) await ctx.request.post(B + "/api/me", { data: { personId: who } });
    // Значок Next.js (только на этом компьютере) закрывает нижние вкладки на снимках.
    await ctx.addInitScript(() => addEventListener("DOMContentLoaded", () => document.head.append(Object.assign(document.createElement("style"), { textContent: "nextjs-portal{display:none!important}" }))));
    ctxs.set(k, ctx);
  }
  return ctxs.get(k);
};

const report = [];
for (const [screen, who, path, after] of SCREENS) {
  if (only.length && !only.some((o) => screen.includes(o))) continue;
  const issues = new Map();
  for (const w of WIDTHS) {
    const p = await (await ctxFor(who, w)).newPage();
    p.on("pageerror", (e) => errors.push(`${screen} ${w}: ${e.message}`));
    try {
      await p.goto(B + path, { waitUntil: "networkidle" });
      await p.waitForTimeout(600);
      const shot = async (suffix) => {
        for (const x of await audit(p, w)) issues.set(x, [...(issues.get(x) ?? []), `${w}${suffix ? ` ${suffix}` : ""}`]);
        if (w === SHOT) await p.screenshot({ path: `${out}${screen}${suffix ? `-${suffix}` : ""}.png`, fullPage: true });
      };
      // after(p, shot) снимает свои состояния сам (вкладки) — сначала исходный вид; after(p) — сначала действие (окно, меню).
      if (after?.length === 2) {
        await shot("");
        await after(p, shot);
      } else {
        if (after) await after(p);
        await shot("");
      }
    } catch (e) {
      issues.set(`failed: ${e.message.split("\n")[0]}`, [String(w)]);
    }
    await p.close();
  }
  report.push([screen, issues]);
  console.log(`${issues.size ? "✗" : "✓"} ${screen}`);
  for (const [x, ws] of issues) console.log(`    ${x}  [${[...new Set(ws)].join(", ")}]`);
}
await browser.close();
const bad = report.filter(([, i]) => i.size).length;
if (errors.length) console.log("errors:", errors);
console.log(bad || errors.length ? `mobile: ${bad} screens with issues` : "mobile: ok");
process.exit(bad || errors.length ? 1 : 0);
