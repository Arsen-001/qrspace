// Пакеты кодов в маркете (владелец 08.10.2026): сразу несколько кодов и сколько места под каждым.
// Код из пакета скачивается без оплаты — любой вид, и простой, и красивый; под ним — место пакета.
// Чем больше пакет, тем дешевле код ($1 → $0.59). Цены демо, владелец не утверждал.
export const CODE_PACKS = [
  { id: "p5", codes: 5, mb: 10, price: 5 },
  { id: "p10", codes: 10, mb: 100, price: 9 },
  { id: "p50", codes: 50, mb: 100, price: 35 },
  { id: "p100", codes: 100, mb: 1024, price: 59 },
] as const;
export type PackPlan = (typeof CODE_PACKS)[number];
export type Pack = { id: string; person: string; plan: string; codes: number; used: number; bytes: number; price: number; at: string };

export const packBytes = (p: PackPlan) => p.mb * 1024 * 1024;

/** Пакет, из которого брать следующий код: где осталось и больше места. */
export const openPack = (mine: Pack[]) => mine.filter((p) => p.used < p.codes).sort((a, b) => b.bytes - a.bytes)[0] ?? null;
/** Сколько кодов осталось во всех пакетах человека. */
export const packsLeft = (mine: Pack[]) => mine.reduce((s, p) => s + Math.max(0, p.codes - p.used), 0);
