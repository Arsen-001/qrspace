import { AxeBuilder } from "@axe-core/playwright";
import { chromium } from "playwright";
// Доступность (WCAG 2.1 AA) на главных страницах — в светлой и тёмной теме, как гость и как хозяин кодов.
const B = "http://localhost:3720";
const browser = await chromium.launch();
const errors = [];
const report = new Map();
async function scan(p, name) {
  await p.waitForTimeout(800);
  const r = await new AxeBuilder({ page: p }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
  for (const v of r.violations) {
    const k = `${v.id}: ${v.help}`;
    const e = report.get(k) ?? { impact: v.impact, pages: new Set(), nodes: [] };
    e.pages.add(name);
    e.nodes.push(...v.nodes.slice(0, 2).map((n) => n.target.join(" ") + (n.any[0]?.data?.contrastRatio ? ` (${n.any[0].data.contrastRatio}: ${n.any[0].data.fgColor} on ${n.any[0].data.bgColor})` : "")));
    report.set(k, e);
  }
}
for (const scheme of ["light", "dark"]) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: "ru-RU", colorScheme: scheme });
  const p = await ctx.newPage();
  for (const path of ["/", "/create", "/market", "/market/nebula", "/how", "/login"]) {
    await p.goto(B + path, { waitUntil: "networkidle" });
    await scan(p, `${scheme} ${path}`);
  }
  await p.goto(B + "/login?next=/codes");
  await p.getByRole("button", { name: /Арман/ }).click();
  await p.waitForURL(/codes$/);
  await scan(p, `${scheme} /codes`);
  await p.getByRole("link", { name: /Котёл/ }).last().click();
  await p.waitForURL(/codes\/\w+/);
  await scan(p, `${scheme} editor`);
  for (const tab of [/Связь/, /Кто видит/, /Вид кода/]) {
    await p.getByRole("tab", { name: tab }).click();
    await scan(p, `${scheme} editor ${tab.source}`);
  }
  const scanUrl = p.url().replace("/codes/", "/c/");
  await p.goto(scanUrl, { waitUntil: "networkidle" });
  await scan(p, `${scheme} scan`);
  await p.goto(B + "/account", { waitUntil: "networkidle" });
  await scan(p, `${scheme} profile`);
  await ctx.close();
}
for (const [k, v] of report) {
  console.log(`✗ [${v.impact}] ${k}\n    pages: ${[...v.pages].join(", ")}\n    e.g.: ${[...new Set(v.nodes)].slice(0, 4).join(" | ")}`);
  errors.push(k);
}
console.log("errors:", errors.length ? errors.length : "none");
await browser.close();
