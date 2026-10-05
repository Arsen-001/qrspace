// Цены (демо, владелец не утверждал): бесплатно — только 1 простой код на человека; следующий простой — $1;
// красивый (фото, текстура, объём, особые формы, значок в углах) — $5. Смотреть и настраивать — бесплатно,
// платят при скачивании; уже оплаченный код скачивается снова бесплатно.
import type { StyleState } from "@/components/StylePanel";
import type { SavedStyle } from "./qr/style";

export type Tier = "simple" | "styled";
export const PRICES: Record<Tier, number> = { simple: 1, styled: 5 };
export type Purchase = { person: string; key: string; tier: Tier; price: number; free: boolean; at: string };
export type Quote = { paid: boolean; price: number; free: boolean };

const SIMPLE_DOTS = ["square", "rounded", "dots"];
const SIMPLE_EYES = ["square", "rounded", "circle"];
const SIMPLE_BALLS = ["auto", "square", "rounded", "circle"];

/** Цвета, градиент, поворот и логотип — простые; всё остальное — красивое. */
export function tierOf(s: StyleState | SavedStyle): Tier {
  const styled =
    !SIMPLE_DOTS.includes(s.dot) ||
    !SIMPLE_EYES.includes(s.eye) ||
    !SIMPLE_BALLS.includes(s.eyeBall) ||
    !!s.texture ||
    s.effect !== "none" ||
    !!s.picture ||
    !!s.eyeIcon;
  return styled ? "styled" : "simple";
}

/** Сколько стоит скачать этот код этому человеку. Апгрейд простого до красивого — доплата разницы. */
export function quote(mine: Purchase[], key: string, tier: Tier): Quote {
  const own = mine.filter((p) => p.key === key);
  if (own.some((p) => p.tier === "styled" || p.tier === tier)) return { paid: true, price: 0, free: false };
  if (tier === "simple" && !mine.some((p) => p.free)) return { paid: false, price: 0, free: true };
  const before = own.reduce((sum, p) => sum + p.price, 0);
  return { paid: false, price: Math.max(0, PRICES[tier] - before), free: false };
}

/** Ключ кода для оплаты: что в нём и как выглядит (короткий хеш, работает и без https). */
export function codeKey(payload: string, style: unknown): string {
  const str = payload + "\u0000" + JSON.stringify(style);
  let h1 = 0x811c9dc5,
    h2 = 0x01000193;
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 16777619);
    h2 = Math.imul(h2 ^ c, 2246822519);
  }
  return `g:${(h1 >>> 0).toString(36)}${(h2 >>> 0).toString(36)}`;
}
