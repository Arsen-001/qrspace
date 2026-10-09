// Длина текстов для магазинов: node docs/store/check.mjs (пределы — в listing.json «_about»).
import { readFileSync } from "node:fs";
const all = JSON.parse(readFileSync(new URL("./listing.json", import.meta.url), "utf8"));
const MAX = { name: 30, subtitle: 30, promo: 170, keywords: 100, short: 80, description: 4000 };
let bad = 0;
for (const [lang, t] of Object.entries(all)) {
  if (lang.startsWith("_")) continue;
  for (const [k, max] of Object.entries(MAX)) {
    const n = [...(t[k] ?? "")].length;
    if (!n || n > max) {
      bad++;
      console.log(`✗ ${lang}.${k}: ${n} / ${max}`);
    }
  }
}
console.log(bad ? `${bad} problem(s)` : "store texts: ok");
process.exit(bad ? 1 : 0);
