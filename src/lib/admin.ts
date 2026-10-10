// Кабинет администратора (владелец 10.10.2026: «своя админка — смотреть юзеров, менять всякое в маркете»):
// разделы, что приходит с сервера, и запросы браузера. Каждый маршрут /api/admin/* сам проверяет, что это администратор.
import type { Kind, Visibility } from "./codes";
import type { L10n } from "./i18n";
import type { SavedStyle } from "./qr/style";

export const ADMIN_TABS = ["overview", "users", "codes", "market", "purchases"] as const;
export type AdminTab = (typeof ADMIN_TABS)[number];

export type Provider = "google" | "apple" | "demo" | "review";
/** Люди: все / настоящие (Google, Apple, проверка магазинов) / демо / заблокированные. */
export const USER_FILTERS = ["all", "real", "demo", "blocked"] as const;
export type UserFilter = (typeof USER_FILTERS)[number];
/** Коды: все / заблокированные / с открытыми жалобами. */
export const CODE_FILTERS = ["all", "blocked", "reported"] as const;
export type CodeFilter = (typeof CODE_FILTERS)[number];
/** Причина блокировки кода из кабинета — те же, что у жалоб (подписи reason.*); account — вместе с аккаунтом хозяина. */
export const BLOCK_REASONS = ["phishing", "spam", "offensive", "other"] as const;
export type BlockReason = (typeof BLOCK_REASONS)[number];

export type Who = { id: string; name: string };

export type AdminUserRow = {
  id: string;
  name: string;
  /** Почта — только у входящих через Google и Apple (у демо и аккаунта проверки — пусто, как везде на сайте). */
  email: string;
  provider: Provider;
  createdAt: string;
  admin: boolean;
  designer: boolean;
  blocked: { at: string; note: string } | null;
  codes: number;
  scans: number;
  /** Платных покупок и сколько потрачено (без проверочных покупок магазинов). */
  buys: number;
  spent: number;
  /** Занято места под всеми его кодами, байт. */
  storage: number;
};
export type AdminUsers = { total: number; rows: AdminUserRow[] };

export type AdminCodeRow = {
  id: string;
  short: string;
  title: string;
  kind: Kind;
  owner: Who;
  createdAt: string;
  scans: number;
  blocked: { at: string; reason: string } | null;
  /** Открытых жалоб. */
  reports: number;
  visibility: Visibility;
  edition: { design: string; no: number; of: number | null } | null;
  /** Куда ведёт (сайт, звонок…) — как в жалобах, чтобы видеть подделку; у Wi‑Fi, текста, памяти — нет. */
  target: string | null;
  storage: number;
};
export type AdminCodes = { total: number; rows: AdminCodeRow[] };

export type AdminBuyKind = "code" | "free" | "fromPack" | "design" | "resale" | "pack" | "space" | "shop" | "brand";
export type AdminBuy = {
  kind: AdminBuyKind;
  person: Who;
  price: number;
  at: string;
  /** Оплачено в App Store / Google Play; нет — на сайте (пока демо-деньги). */
  store: "apple" | "google" | null;
  /** Проверочная покупка магазина (TestFlight, тестировщики) — не выручка. */
  test: boolean;
  title: string | null;
  code: string | null;
};

export type AdminUserDetail = {
  user: AdminUserRow;
  codes: AdminCodeRow[];
  buys: AdminBuy[];
  packs: { id: string; codes: number; used: number; price: number; at: string; store: "apple" | "google" | null; test: boolean }[];
  lots: { id: string; title: string; status: "open" | "sold" | "expired" | "cancelled"; mode: "fixed" | "auction"; price: number; final: number | null; at: string }[];
};

export type AdminDesign = {
  id: string;
  name: L10n;
  about: L10n;
  price: number;
  /** Цена без правки администратора. */
  basePrice: number;
  edition: number | null;
  sold: number;
  drop: boolean;
  featured: boolean;
  hidden: boolean;
  /** Есть правка администратора (можно вернуть как было). */
  changed: boolean;
  /** Встроенный (из кода сайта); иначе — выложил дизайнер. */
  seed: boolean;
  by: Who | null;
  collab: string | null;
  style: SavedStyle;
};
export type AdminLot = {
  id: string;
  code: string;
  title: string;
  seller: Who;
  mode: "fixed" | "auction";
  price: number;
  top: number | null;
  bids: number;
  endsAt: string | null;
  status: "open" | "sold" | "expired" | "cancelled";
  removed: boolean;
  createdAt: string;
  style: SavedStyle | null;
  edition: { design: string; no: number; of: number | null } | null;
};
export type AdminMarket = { designs: AdminDesign[]; lots: AdminLot[] };

/** Правка дизайна: что прислали — то и меняем; reset — вернуть как было (убрать правку). */
export type DesignPatch = { hidden?: boolean; featured?: boolean; drop?: boolean; price?: number; name?: L10n; about?: L10n; reset?: true };

export type AdminPurchases = {
  totals: {
    /** Оборот: все оплаты без проверочных (на сайте пока демо). */
    revenue: number;
    site: number;
    apple: number;
    google: number;
    /** Сумма перепродаж и наша комиссия с них. */
    resale: number;
    fees: number;
    count: number;
    test: number;
    buyers: number;
  };
  rows: AdminBuy[];
};

async function call<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { cache: "no-store", ...init });
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json() as Promise<T>;
}
const send = (method: string, body: unknown): RequestInit => ({ method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
const qs = (p: Record<string, string>) => new URLSearchParams(p).toString();

export const adminApi = {
  users: (q: string, filter: UserFilter) => call<AdminUsers>(`/api/admin/users?${qs({ q, filter })}`),
  user: (id: string) => call<AdminUserDetail>(`/api/admin/users/${encodeURIComponent(id)}`),
  blockUser: (id: string, note: string, codes: boolean) => call<AdminUserDetail>(`/api/admin/users/${encodeURIComponent(id)}`, send("PATCH", { action: "block", note, codes })),
  unblockUser: (id: string) => call<AdminUserDetail>(`/api/admin/users/${encodeURIComponent(id)}`, send("PATCH", { action: "unblock" })),
  codes: (q: string, filter: CodeFilter) => call<AdminCodes>(`/api/admin/codes?${qs({ q, filter })}`),
  blockCode: (id: string, reason: BlockReason) => call<AdminCodeRow>(`/api/admin/codes/${encodeURIComponent(id)}`, send("PATCH", { action: "block", reason })),
  unblockCode: (id: string) => call<AdminCodeRow>(`/api/admin/codes/${encodeURIComponent(id)}`, send("PATCH", { action: "unblock" })),
  market: () => call<AdminMarket>("/api/admin/market"),
  design: (id: string, patch: DesignPatch) => call<AdminMarket>(`/api/admin/designs/${encodeURIComponent(id)}`, send("PATCH", patch)),
  removeLot: (id: string) => call<AdminMarket>(`/api/admin/listings/${encodeURIComponent(id)}`, send("PATCH", { action: "remove" })),
  purchases: () => call<AdminPurchases>("/api/admin/purchases"),
};
