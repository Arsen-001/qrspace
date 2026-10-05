// Заказ кода под бренд: заявка → переписка с дизайнером → дизайн → клиент создаёт коды в нём.
// Пакеты и цены — из модели продукта (примерные, владелец не утверждал).
import type { SavedStyle } from "./qr/style";

export const NEEDS = ["packaging", "clothes", "auth", "event", "other"] as const;
export type Need = (typeof NEEDS)[number];
export const PACKAGES = { start: 49, pro: 199 } as const;
export type Pkg = keyof typeof PACKAGES;
export const STATUSES = ["new", "work", "review", "done"] as const;
export type OrderStatus = (typeof STATUSES)[number];

export type OrderMessage = { id: string; from: string; text: string; at: string };
export type Order = {
  id: string;
  client: string;
  brand: string;
  contact: string;
  need: Need;
  qty: number;
  pkg: Pkg;
  deadline: string | null;
  notes: string;
  /** Логотип уменьшенным PNG/JPEG (data URL) — дизайнеру, чтобы собрать код. */
  logo: string | null;
  status: OrderStatus;
  thread: OrderMessage[];
  /** Готовый дизайн от дизайнера; клиент создаёт по нему коды. */
  design: { style: SavedStyle; note: string; at: string } | null;
  codes: number;
  createdAt: string;
};
