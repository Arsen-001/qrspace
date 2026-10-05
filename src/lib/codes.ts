// Код с памятью: общие типы для сервера и браузера и запросы браузера к нашему API.
import type { Design } from "./market";
import type { Listing } from "./listings";
import type { Need, Order, OrderStatus, Pkg } from "./orders";
import type { ProductId, ShopOrder } from "./shop";
import type { Quote, Tier } from "./pricing";
import type { SavedStyle } from "./qr/style";

export type Visibility = "all" | "people" | "me";
export type Role = "view" | "edit";
/** Кем человек приходится коду: хозяин, может дописывать, может смотреть, закрыто. */
export type AccessLevel = "owner" | "edit" | "view" | "closed";

/** Шаблон кода: память; машина (номер по выключателю); ключи и вещи; питомец. */
export const KINDS = ["memory", "car", "lost", "pet"] as const;
export type Kind = (typeof KINDS)[number];

/** Готовые сообщения после скана — по шаблону. */
export const PRESETS: Record<Kind, string[]> = {
  memory: [],
  car: ["blocking", "lights", "window", "tow", "hit"],
  lost: ["found"],
  pet: ["foundPet"],
};

export type Grant = { personId: string; role: Role; until: string | null };
export type Message = { id: string; from: string | null; preset: string | null; text: string; reply: string; at: string; read: boolean };
/** Напоминание: что сделать и когда; every — повтор (после «Сделано» срок переносится). */
export const REPEATS = ["none", "week", "month", "quarter", "year"] as const;
export type Repeat = (typeof REPEATS)[number];
export type Task = { id: string; text: string; due: string; every: Repeat; done: { by: string; at: string }[] };

export type Contact = { enabled: boolean; phone: string; showPhone: boolean };
export type Block = { id: string; kind: "text" | "photo" | "video"; text: string; media: string | null; author: string; at: string };
export type Visit = { personId: string | null; at: string; allowed: boolean };

export type CodeRecord = {
  id: string;
  owner: string;
  kind: Kind;
  title: string;
  /** Видно ли после скана, чей это код. */
  showOwner: boolean;
  /** «Связь через нас»: сообщения владельцу без его номера; номер — только по выключателю. */
  contact: Contact;
  /** Режим «Потеряно» и вознаграждение. */
  lost: boolean;
  reward: string;
  messages: Message[];
  tasks: Task[];
  /** Купленный в маркете дизайн: № в тираже (of = null — без тиража). */
  edition?: { design: string; no: number; of: number | null };
  /** История владельцев коллекционного кода (кто, когда, за сколько). */
  owners?: { person: string; at: string; price: number | null }[];
  visibility: Visibility;
  people: Grant[];
  requests: { personId: string; at: string }[];
  invite: string;
  blocks: Block[];
  style: SavedStyle | null;
  visits: Visit[];
  createdAt: string;
};

/** Что видит конкретный человек: память — только с доступом, настройки — только хозяин. */
export type CodeView = {
  id: string;
  kind: Kind;
  /** null — хозяин скрыт. */
  owner: string | null;
  /** null — название видит только хозяин (у ключей название может выдать адрес). */
  title: string | null;
  showOwner: boolean;
  contact: { enabled: boolean; showPhone: boolean; phone: string | null };
  lost: boolean;
  reward: string;
  /** Напоминания — тем, кому открыт код. */
  tasks: Task[] | null;
  owners: { person: string; at: string; price: number | null }[] | null;
  edition: { design: string; no: number; of: number | null } | null;
  access: AccessLevel;
  visibility: Visibility;
  blocks: Block[] | null;
  requested: boolean;
  style: SavedStyle | null;
  /** Только хозяину. */
  people?: Grant[];
  requests?: { personId: string; at: string }[];
  invite?: string;
  visits?: Visit[];
  messages?: Message[];
};

export type CodeList = { base: string; mine: CodeView[]; shared: CodeView[] };
export type MarketState = { sold: Record<string, number>; designs: Design[] };
/** Лот с тем, что нужно показать: код (вид, номер, название) и продавец. */
export type Lot = Listing & { view: Pick<CodeView, "title" | "style" | "edition" | "owners"> };

export const MAX_PHOTO_PX = 1600;
export const MAX_VIDEO_MB = 50;

export const codeLink = (base: string, id: string) => `${base}/c/${id}`;
export const mediaUrl = (name: string) => `/api/media/${name}`;

async function call<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { cache: "no-store", ...init });
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json() as Promise<T>;
}
const json = (method: string, body: unknown): RequestInit => ({ method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

export type CodePatch = Partial<Pick<CodeRecord, "title" | "visibility" | "people" | "style" | "showOwner" | "contact" | "lost" | "reward">> & {
  readMessages?: boolean;
  removeMessage?: string;
  approve?: string;
  decline?: string;
  newInvite?: boolean;
};

export const api = {
  me: () => call<{ me: string | null; base: string }>("/api/me"),
  login: (personId: string | null) => call<{ me: string | null }>("/api/me", json("POST", { personId })),
  list: () => call<CodeList>("/api/codes"),
  create: (title: string, kind: Kind, style: SavedStyle) => call<CodeView>("/api/codes", json("POST", { title, kind, style })),
  quote: (key: string, tier: Tier) => call<Quote>(`/api/purchases?key=${encodeURIComponent(key)}&tier=${tier}`),
  pay: (key: string, tier: Tier) => call<{ ok: true; price: number }>("/api/purchases", json("POST", { key, tier })),
  batch: (count: number, prefix: string, style: SavedStyle) => call<CodeView[]>("/api/codes/batch", json("POST", { count, prefix, kind: "memory", style })),
  orders: () => call<Order[]>("/api/orders"),
  order: (id: string) => call<Order>(`/api/orders/${id}`),
  createOrder: (o: { brand: string; contact: string; need: Need; qty: number; pkg: Pkg; deadline: string | null; notes: string; logo: string | null }) =>
    call<Order>("/api/orders", json("POST", o)),
  patchOrder: (id: string, p: { status?: OrderStatus; design?: { style: SavedStyle; note: string }; accept?: boolean }) => call<Order>(`/api/orders/${id}`, json("PATCH", p)),
  orderMessage: (id: string, text: string) => call<Order>(`/api/orders/${id}/messages`, json("POST", { text })),
  claim: (id: string) => call<CodeView>(`/api/orders/${id}/claim`, { method: "POST" }),
  lots: () => call<Lot[]>("/api/listings"),
  lot: (id: string) => call<Lot>(`/api/listings/${id}`),
  sell: (code: string, mode: "fixed" | "auction", price: number, hours: number) => call<Lot>("/api/listings", json("POST", { code, mode, price, hours })),
  lotAction: (id: string, action: "buy" | "bid" | "cancel" | "finish", amount?: number) => call<Lot>(`/api/listings/${id}`, json("POST", { action, amount })),
  shopOrders: () => call<ShopOrder[]>("/api/shop"),
  shopOrder: (o: { product: ProductId; variant: string; code: string; qty: number; address: ShopOrder["address"] }) => call<ShopOrder>("/api/shop", json("POST", o)),
  market: () => call<MarketState>("/api/market"),
  publish: (d: { name: string; about: string; price: number; edition: number | null; drop: boolean; style: SavedStyle }) =>
    call<Design>("/api/market", json("POST", d)),
  unpublish: (design: string) => call<{ ok: true }>(`/api/market/${design}`, { method: "DELETE" }),
  buy: (design: string) => call<CodeView>(`/api/market/${design}`, { method: "POST" }),
  addTask: (id: string, task: { text: string; due: string; every: Repeat }) => call<CodeView>(`/api/codes/${id}/tasks`, json("POST", task)),
  doneTask: (id: string, taskId: string) => call<CodeView>(`/api/codes/${id}/tasks/${taskId}`, json("PATCH", { done: true })),
  removeTask: (id: string, taskId: string) => call<CodeView>(`/api/codes/${id}/tasks/${taskId}`, { method: "DELETE" }),
  message: (id: string, m: { preset: string | null; text: string; reply: string }) => call<{ ok: true }>(`/api/codes/${id}/messages`, json("POST", m)),
  get: (id: string, opts: { visit?: boolean } = {}) => call<CodeView>(`/api/codes/${id}${opts.visit ? "?visit=1" : ""}`),
  patch: (id: string, patch: CodePatch) => call<CodeView>(`/api/codes/${id}`, json("PATCH", patch)),
  remove: (id: string) => call<{ ok: true }>(`/api/codes/${id}`, { method: "DELETE" }),
  addBlock: (id: string, form: FormData) => call<CodeView>(`/api/codes/${id}/blocks`, { method: "POST", body: form }),
  editBlock: (id: string, blockId: string, text: string) => call<CodeView>(`/api/codes/${id}/blocks/${blockId}`, json("PATCH", { text })),
  removeBlock: (id: string, blockId: string) => call<CodeView>(`/api/codes/${id}/blocks/${blockId}`, { method: "DELETE" }),
  request: (id: string) => call<CodeView>(`/api/codes/${id}/request`, { method: "POST" }),
  join: (id: string, invite: string) => call<CodeView>(`/api/codes/${id}/join`, json("POST", { invite })),
};

const pad = (n: number) => String(n).padStart(2, "0");
export const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const todayYmd = () => ymd(new Date());

/** Следующий срок после «Сделано»: от сегодняшнего дня (сделали позже — следующий раз тоже сдвигается). */
export function nextDue(every: Repeat, from = new Date()): string | null {
  if (every === "none") return null;
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  if (every === "week") d.setDate(d.getDate() + 7);
  if (every === "month") d.setMonth(d.getMonth() + 1);
  if (every === "quarter") d.setMonth(d.getMonth() + 3);
  if (every === "year") d.setFullYear(d.getFullYear() + 1);
  return ymd(d);
}

/** Сколько дней до срока (отрицательное — просрочено). */
export function daysLeft(due: string): number {
  const [y, m, d] = due.split("-").map(Number);
  const [ty, tm, td] = todayYmd().split("-").map(Number);
  return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(ty, tm - 1, td)) / 86_400_000);
}
