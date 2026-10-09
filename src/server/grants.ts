// Что даёт покупка — одинаково для оплаты на сайте и в приложениях (App Store, Google Play): пакет кодов, месяц места
// под кодом. Вызывается внутри mutate.
import { FREE_STORAGE, STORAGE_MONTH_MS, STORAGE_PLANS, storageOf } from "@/lib/codes";
import { CODE_PACKS, packBytes } from "@/lib/packs";
import { newId, type Db } from "./db";

export type Store = "apple" | "google";
type Paid = { price: number; store?: Store; test?: boolean };

export function grantPack(db: Db, me: string, planId: string, paid: Paid): boolean {
  const plan = CODE_PACKS.find((p) => p.id === planId);
  if (!plan) return false;
  db.packs.push({ id: newId(), person: me, plan: plan.id, codes: plan.codes, used: 0, bytes: packBytes(plan), price: paid.price, at: new Date().toISOString(), ...(paid.store && { store: paid.store }), ...(paid.test && { test: true }) });
  return true;
}

/**
 * Месяц места под кодом: тот же размер — продлить на месяц от конца оплаченного, другой — с сегодняшнего дня.
 * Только хозяин; меньше, чем уже занято, — нельзя. Число — ошибка (404, 403, 409, 400).
 */
export function extendSpace(db: Db, me: string, codeId: string, planId: string, paid: Paid): number | null {
  const plan = STORAGE_PLANS.find((p) => p.id === planId);
  if (!plan) return 400;
  const c = db.codes.find((x) => x.id === codeId);
  if (!c) return 404;
  if (c.owner !== me) return 403;
  const now = Date.now();
  const st = storageOf(c, now);
  if (st.used > Math.max(FREE_STORAGE, plan.bytes)) return 409;
  const from = st.plan === plan.id && st.until ? Date.parse(st.until) : now;
  c.storage = plan.bytes;
  c.storageUntil = new Date(from + STORAGE_MONTH_MS).toISOString();
  db.spaces.push({ person: me, code: c.id, plan: plan.id, bytes: plan.bytes, price: paid.price, at: new Date(now).toISOString(), ...(paid.store && { store: paid.store }), ...(paid.test && { test: true }) });
  return null;
}
