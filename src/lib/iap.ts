// Встроенная оплата в приложениях (владелец 09.10.2026: «встроенная оплата Apple Google»): товары App Store и Google Play
// и что каждый даёт. Цены задаёт владелец в App Store Connect и Play Console (ближайшие к ценам сайта); сервер по
// товару выдаёт то же, что и оплата на сайте. Место — «месяц места для одного кода» (у Apple — подписка без
// автопродления), его можно купить снова — для другого кода или продлить.
import type { PackPlan } from "./packs";

export type IapGrant = { kind: "code" } | { kind: "pack"; plan: PackPlan["id"] } | { kind: "space"; plan: "s10" | "s100" | "s1000" };

export const IAP_PRODUCTS: Record<string, IapGrant> = {
  "co.qrspace.code": { kind: "code" },
  "co.qrspace.pack5": { kind: "pack", plan: "p5" },
  "co.qrspace.pack10": { kind: "pack", plan: "p10" },
  "co.qrspace.pack50": { kind: "pack", plan: "p50" },
  "co.qrspace.pack100": { kind: "pack", plan: "p100" },
  "co.qrspace.space10.month": { kind: "space", plan: "s10" },
  "co.qrspace.space100.month": { kind: "space", plan: "s100" },
  "co.qrspace.space1000.month": { kind: "space", plan: "s1000" },
};

/** Что человек покупает в приложении: код (по ключу оплаты, как на сайте), пакет или месяц места для своего кода. */
export type IapIntent = { kind: "code"; key: string; tier: "simple" | "styled" } | { kind: "pack"; plan: string } | { kind: "space"; code: string; plan: string };

/** Подходит ли товар к тому, что человек покупает. */
export function matches(productId: string, intent: IapIntent): boolean {
  const g = IAP_PRODUCTS[productId];
  if (!g || g.kind !== intent.kind) return false;
  return g.kind === "code" || g.plan === (intent as { plan: string }).plan;
}

export const APP_BUNDLE = "co.qrspace.app";
