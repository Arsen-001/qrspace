// Готовые логотипы для центра кода: бренды (Simple Icons, CC0 — src/lib/qr/logos.ts, грузится по требованию)
// и наши простые значки. Логотип рисуем как значок приложения: цветная плитка, знак — белый (на светлом — тёмный).
import type { ContentType } from "./payload";

export type LogoCat = "basic" | "social" | "messengers" | "music" | "pay" | "apps";
export type BrandLogo = { id: string; title: string; hex: string; cat: LogoCat; d: string; stroke?: boolean };
export const LOGO_CATS: LogoCat[] = ["basic", "social", "messengers", "music", "pay", "apps"];

const basic = (id: string, d: string): BrandLogo => ({ id, title: id, hex: "#0b0b0c", cat: "basic", d, stroke: true });
/** Простые значки (линии) — подписи берутся из словаря (logo.<id>). */
export const BASIC_LOGOS: BrandLogo[] = [
  basic("globe", "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18ZM3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3Z"),
  basic("phone", "M6.5 3.5h3l1.5 4-2 1.5a11 11 0 0 0 6 6l1.5-2 4 1.5v3a2 2 0 0 1-2 2A16 16 0 0 1 4.5 5.5a2 2 0 0 1 2-2Z"),
  basic("mail", "M5.5 5h13A2.5 2.5 0 0 1 21 7.5v9a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 16.5v-9A2.5 2.5 0 0 1 5.5 5ZM4 7l8 6 8-6"),
  basic("chat", "M4 5h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H9l-4 3.5V17H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z"),
  basic("wifi", "M2.5 9a14 14 0 0 1 19 0M5.5 12.5a9.5 9.5 0 0 1 13 0M8.6 16a5 5 0 0 1 6.8 0M12 19.2h.01"),
  basic("pin", "M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21ZM12 7a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5Z"),
  basic("calendar", "M6.5 5h11a3 3 0 0 1 3 3v9a3 3 0 0 1-3 3h-11a3 3 0 0 1-3-3V8a3 3 0 0 1 3-3ZM3.5 10h17M8 3v4M16 3v4"),
  basic("user", "M12 4a4 4 0 1 0 0 8 4 4 0 0 0 0-8ZM4.5 20.5c.9-3.6 3.9-5.5 7.5-5.5s6.6 1.9 7.5 5.5"),
  basic("menu", "M7 3v8M5 3v4a2 2 0 0 0 4 0V3M7 11v10M16 3c-1.7 1-2.5 3-2.5 6s1 3.5 2.5 3.5V21M16 3v18"),
  basic("heart", "M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.2a4.3 4.3 0 0 1 7.5 2.6C19.5 15.4 12 20 12 20Z"),
  basic("star", "m12 3.5 2.6 5.4 5.9.8-4.3 4.1 1 5.8-5.2-2.8-5.2 2.8 1-5.8-4.3-4.1 5.9-.8Z"),
  basic("bag", "M5 8h14l-1 12.5H6ZM9 8V6.5a3 3 0 0 1 6 0V8"),
];
/** LinkedIn в Simple Icons нет (снят по просьбе владельца марки) — свой простой знак «in». */
export const LINKEDIN: BrandLogo = {
  id: "linkedin",
  title: "LinkedIn",
  hex: "#0a66c2",
  cat: "social",
  d: "M5 3.3a2.2 2.2 0 1 1 0 4.4 2.2 2.2 0 0 1 0-4.4ZM3.1 9.3h3.8V21H3.1ZM9.4 9.3h3.6v1.6c.6-1 1.9-1.9 3.8-1.9 3.9 0 4.6 2.5 4.6 5.8V21h-3.8v-5.5c0-1.4 0-3.1-1.9-3.1s-2.2 1.5-2.2 3V21H9.4Z",
};

/** Какой логотип предложить первым для вида содержимого. */
export const LOGO_FOR: Partial<Record<ContentType, string>> = {
  url: "globe",
  phone: "phone",
  sms: "chat",
  email: "mail",
  wifi: "wifi",
  location: "googlemaps",
  event: "calendar",
  contact: "user",
  whatsapp: "whatsapp",
  telegram: "telegram",
  viber: "viber",
  instagram: "instagram",
  facebook: "facebook",
  tiktok: "tiktok",
  youtube: "youtube",
  linkedin: "linkedin",
  x: "x",
};
/** Сразу видны в шаге 2 (до загрузки полного списка — простые значки). */
export const QUICK_LOGOS = ["instagram", "whatsapp", "telegram", "tiktok", "facebook", "youtube", "globe", "phone", "googlemaps", "viber"];

function light(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.6;
}

/** Значок-плитка в SVG: px — сторона. Instagram — его градиентом. */
export function logoSvg(l: BrandLogo, px: number): string {
  const ink = light(l.hex) ? "#111111" : "#ffffff";
  const insta = l.id === "instagram";
  const bg = insta ? "url(#g)" : l.hex;
  const defs = insta
    ? `<defs><linearGradient id="g" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#feda75"/><stop offset=".3" stop-color="#fa7e1e"/><stop offset=".6" stop-color="#d62976"/><stop offset=".85" stop-color="#962fbf"/><stop offset="1" stop-color="#4f5bd5"/></linearGradient></defs>`
    : "";
  const glyph = l.stroke
    ? `<path d="${l.d}" fill="none" stroke="${ink}" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/>`
    : `<path d="${l.d}" fill="${ink}"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${px}" height="${px}" viewBox="0 0 24 24">${defs}<rect width="24" height="24" rx="5.4" fill="${bg}"/><g transform="translate(4.6 4.6) scale(.6167)">${glyph}</g></svg>`;
}

/** Номер в центре кода (владелец 08.10.2026): только цифры до 9 999 999 на табличке цвета кода. */
export function numberSvg(n: string, plate: string, ink: string): string {
  const digits = n.replace(/\D/g, "").slice(0, 7);
  // Ширина цифры в жирном шрифте ≈ 0,66 высоты; оставляем поля.
  const size = Math.min(170, Math.floor(234 / (Math.max(digits.length, 2) * 0.63)));
  return `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256"><rect width="256" height="256" rx="44" fill="${plate}"/><text x="128" y="${128 + size * 0.36}" font-family="Arial Black, Arial, Helvetica, sans-serif" font-weight="900" font-size="${size}" letter-spacing="-4" text-anchor="middle" fill="${ink}">${digits}</text></svg>`;
}
