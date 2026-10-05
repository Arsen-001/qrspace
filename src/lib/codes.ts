// Код с памятью: общие типы для сервера и браузера и запросы браузера к нашему API.
import type { Design } from "./market";
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
  /** Купленный в маркете дизайн: № в тираже (of = null — без тиража). */
  edition?: { design: string; no: number; of: number | null };
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
  market: () => call<MarketState>("/api/market"),
  publish: (d: { name: string; about: string; price: number; edition: number | null; drop: boolean; style: SavedStyle }) =>
    call<Design>("/api/market", json("POST", d)),
  unpublish: (design: string) => call<{ ok: true }>(`/api/market/${design}`, { method: "DELETE" }),
  buy: (design: string) => call<CodeView>(`/api/market/${design}`, { method: "POST" }),
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
