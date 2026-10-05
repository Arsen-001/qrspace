// Перепродажа коллекционных кодов (с номером тиража): фиксированная цена или аукцион, как Fragment.
// Новому владельцу код переходит чистым: память, люди, сообщения и напоминания продавца удаляются.
export const FEE = 0.1; // наша комиссия (демо)
export const DURATIONS = [1, 24, 72, 168] as const; // часы: 1 ч (для демо), сутки, 3 дня, неделя

export type Bid = { person: string; amount: number; at: string };
export type Listing = {
  id: string;
  code: string;
  seller: string;
  mode: "fixed" | "auction";
  /** Фиксированная цена или стартовая ставка. */
  price: number;
  endsAt: string | null;
  bids: Bid[];
  status: "open" | "sold" | "expired" | "cancelled";
  buyer: string | null;
  final: number | null;
  createdAt: string;
};

/** Минимальная следующая ставка: +5 %, но не меньше $1. */
export const minBid = (l: Listing) => (l.bids.length ? Math.ceil(Math.max(l.bids.at(-1)!.amount * 1.05, l.bids.at(-1)!.amount + 1)) : l.price);
export const topBid = (l: Listing) => l.bids.at(-1) ?? null;
export const sellerGets = (amount: number) => Math.floor(amount * (1 - FEE) * 100) / 100;
