// Пакеты кодов в маркете (владелец 08.10.2026): сразу несколько кодов и сколько места под каждым.
// Код из пакета скачивается без оплаты — любой вид, и простой, и красивый. Каждый код — $1 и 1 МБ под ним
// (владелец 09.10.2026); место больше — помесячно под самим кодом. Цены демо.
export const CODE_PACKS = [
  { id: "p5", codes: 5, mb: 1, price: 5 },
  { id: "p10", codes: 10, mb: 1, price: 10 },
  { id: "p50", codes: 50, mb: 1, price: 50 },
  { id: "p100", codes: 100, mb: 1, price: 100 },
] as const;
export type PackPlan = (typeof CODE_PACKS)[number];
export type Pack = { id: string; person: string; plan: string; codes: number; used: number; bytes: number; price: number; at: string };

export const packBytes = (p: PackPlan) => p.mb * 1024 * 1024;

/** Пакет, из которого брать следующий код: где осталось и больше места. */
export const openPack = (mine: Pack[]) => mine.filter((p) => p.used < p.codes).sort((a, b) => b.bytes - a.bytes)[0] ?? null;
/** Сколько кодов осталось во всех пакетах человека. */
export const packsLeft = (mine: Pack[]) => mine.reduce((s, p) => s + Math.max(0, p.codes - p.used), 0);
