// Номерные коды (идея владельца № 10): числа от 1 до 1 000 000, у каждого номера один хозяин навсегда.
// Купил № 1 — можно продать или выставить на аукцион, как имена в Fragment. Цены примерные (владелец не утверждал).
export const NUMBERS_MAX = 1_000_000;
export const NUMBER_DESIGN = "number";

export type NumberTier = "legend" | "rare" | "special" | "nice" | "common";

/** «Красивый» номер: все цифры одинаковые (777), круглый (5000), зеркальный (12321), подряд (1234), год (2026). */
export function special(n: number): boolean {
  const s = String(n);
  if (s.length < 3) return false;
  if (/^(\d)\1+$/.test(s)) return true;
  if (/^[1-9]0+$/.test(s)) return true;
  if (s === [...s].reverse().join("")) return true;
  if ("1234567890".includes(s) || "9876543210".includes(s)) return true;
  return n >= 1990 && n <= 2030;
}

export function tierOf(n: number): NumberTier {
  if (n < 10) return "legend";
  if (n < 100) return "rare";
  if (special(n)) return "special";
  if (n < 1000) return "nice";
  return "common";
}

export const PRICE: Record<NumberTier, number> = { legend: 100, rare: 50, special: 30, nice: 15, common: 3 };
export const priceOfNumber = (n: number) => PRICE[tierOf(n)];

export const validNumber = (n: unknown): n is number => typeof n === "number" && Number.isInteger(n) && n >= 1 && n <= NUMBERS_MAX;

/** «1 000 000» — с пробелами, как пишут в Армении и России. */
export const fmtNumber = (n: number) => n.toLocaleString("ru-RU").replace(/ /g, " ");

/** Номера, которые покажем первыми (если свободны). */
export const SHOWCASE = [1, 7, 10, 77, 100, 777, 1000, 2026, 1111, 1234, 7777, 12321, 100000, 777777, 1000000];
