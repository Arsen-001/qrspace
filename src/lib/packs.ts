// Пакеты кодов в маркете (владелец 08.10.2026): сразу несколько кодов и сколько места под каждым.
// Код из пакета скачивается без оплаты — любой вид, и простой, и красивый. Каждый код — $1 и 1 МБ под ним
// (владелец 09.10.2026); место больше — помесячно под самим кодом. Скидка за пакет (владелец 09.10.2026): 5 — 20%,
// 10 — 30%, 50 — 35%, 100 — 40% (предложили мы: тот же шаг, самый большой — самый выгодный). Цены демо.
export const CODE_PRICE = 1;
const pack = <I extends string>(id: I, codes: number, off: number) =>
  ({ id, codes, mb: 1, off, full: codes * CODE_PRICE, price: Math.round(codes * CODE_PRICE * (100 - off)) / 100 }) as const;
export const CODE_PACKS = [pack("p5", 5, 20), pack("p10", 10, 30), pack("p50", 50, 35), pack("p100", 100, 40)];
export type PackPlan = (typeof CODE_PACKS)[number];
export type Pack = { id: string; person: string; plan: string; codes: number; used: number; bytes: number; price: number; at: string };

export const packBytes = (p: PackPlan) => p.mb * 1024 * 1024;

/** Пакет, из которого брать следующий код: где осталось и больше места. */
export const openPack = (mine: Pack[]) => mine.filter((p) => p.used < p.codes).sort((a, b) => b.bytes - a.bytes)[0] ?? null;
/** Сколько кодов осталось во всех пакетах человека. */
export const packsLeft = (mine: Pack[]) => mine.reduce((s, p) => s + Math.max(0, p.codes - p.used), 0);
