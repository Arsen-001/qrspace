// Код с памятью: общие типы для сервера и браузера и запросы браузера к нашему API.
import type { SavedStyle } from "./qr/style";

export type Visibility = "all" | "people" | "me";
export type Role = "view" | "edit";
/** Кем человек приходится коду: хозяин, может дописывать, может смотреть, закрыто. */
export type AccessLevel = "owner" | "edit" | "view" | "closed";

export type Grant = { personId: string; role: Role; until: string | null };
export type Block = { id: string; kind: "text" | "photo" | "video"; text: string; media: string | null; author: string; at: string };
export type Visit = { personId: string | null; at: string; allowed: boolean };

export type CodeRecord = {
  id: string;
  owner: string;
  title: string;
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
  owner: string;
  title: string;
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
};

export type CodeList = { base: string; mine: CodeView[]; shared: CodeView[] };

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

export type CodePatch = Partial<Pick<CodeRecord, "title" | "visibility" | "people" | "style">> & {
  approve?: string;
  decline?: string;
  newInvite?: boolean;
};

export const api = {
  me: () => call<{ me: string | null; base: string }>("/api/me"),
  login: (personId: string | null) => call<{ me: string | null }>("/api/me", json("POST", { personId })),
  list: () => call<CodeList>("/api/codes"),
  create: (title: string, style: SavedStyle) => call<CodeView>("/api/codes", json("POST", { title, style })),
  get: (id: string, opts: { visit?: boolean } = {}) => call<CodeView>(`/api/codes/${id}${opts.visit ? "?visit=1" : ""}`),
  patch: (id: string, patch: CodePatch) => call<CodeView>(`/api/codes/${id}`, json("PATCH", patch)),
  remove: (id: string) => call<{ ok: true }>(`/api/codes/${id}`, { method: "DELETE" }),
  addBlock: (id: string, form: FormData) => call<CodeView>(`/api/codes/${id}/blocks`, { method: "POST", body: form }),
  editBlock: (id: string, blockId: string, text: string) => call<CodeView>(`/api/codes/${id}/blocks/${blockId}`, json("PATCH", { text })),
  removeBlock: (id: string, blockId: string) => call<CodeView>(`/api/codes/${id}/blocks/${blockId}`, { method: "DELETE" }),
  request: (id: string) => call<CodeView>(`/api/codes/${id}/request`, { method: "POST" }),
  join: (id: string, invite: string) => call<CodeView>(`/api/codes/${id}/join`, json("POST", { invite })),
};
