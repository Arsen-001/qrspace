// Собирает src/lib/qr/logos.ts — готовые логотипы для центра кода из Simple Icons (CC0, simpleicons.org).
// Запуск: node scripts/gen-logos.mjs (simple-icons — в devDependencies; на сайт уходит только сгенерированный файл).
import fs from "node:fs";
import * as si from "simple-icons";

const CATS = {
  social: ["instagram", "facebook", "tiktok", "youtube", "x", "threads", "snapchat", "pinterest", "reddit", "twitch", "kick", "discord", "vk", "odnoklassniki", "bluesky", "mastodon", "tumblr", "quora", "flickr", "behance", "dribbble", "medium", "substack", "patreon", "onlyfans", "clubhouse", "linktree", "github", "wikipedia"],
  messengers: ["whatsapp", "telegram", "viber", "messenger", "signal", "wechat", "line", "kakaotalk", "zalo", "zoom", "googlemeet", "gmail", "maildotru"],
  music: ["spotify", "applemusic", "youtubemusic", "soundcloud", "deezer", "shazam"],
  pay: ["paypal", "applepay", "googlepay", "venmo", "cashapp", "revolut", "etsy", "ebay", "shopify"],
  apps: ["appstore", "googleplay", "apple", "android", "googlemaps", "tripadvisor", "yelp", "airbnb", "uber", "glovo", "notion", "figma"],
};
const bySlug = Object.fromEntries(Object.values(si).filter((x) => x && x.slug).map((x) => [x.slug, x]));
const rows = [];
for (const [cat, slugs] of Object.entries(CATS))
  for (const slug of slugs) {
    const ic = bySlug[slug];
    if (!ic) throw new Error(`нет в simple-icons: ${slug}`);
    rows.push(`  { id: ${JSON.stringify(slug)}, title: ${JSON.stringify(ic.title)}, hex: "#${ic.hex}", cat: "${cat}", d: ${JSON.stringify(ic.path)} },`);
  }
const out = `// Сгенерировано scripts/gen-logos.mjs из Simple Icons (CC0) — не править руками.
import type { BrandLogo } from "./logo-art";

export const BRAND_LOGOS: BrandLogo[] = [
${rows.join("\n")}
];
`;
fs.writeFileSync(new URL("../src/lib/qr/logos.ts", import.meta.url), out);
console.log("logos:", rows.length, "size", Math.round(out.length / 1024) + " KB");
