// Код с памятью: общие типы для сервера и браузера и запросы браузера к нашему API.
import type { Design } from "./market";
import type { Listing } from "./listings";
import type { Person } from "./people";
import type { Pack } from "./packs";
import type { Quote, Tier } from "./pricing";
import type { Content } from "./qr/payload";
import type { SavedStyle } from "./qr/style";

export type Visibility = "all" | "contacts" | "people" | "me";
export type Role = "view" | "edit";
/** Кем человек приходится коду: хозяин, может дописывать, может смотреть, закрыто. */
export type AccessLevel = "owner" | "edit" | "view" | "closed";

/** Шаблон кода: память; машина (номер по выключателю); ключи и вещи; питомец. */
export const KINDS = ["memory", "link", "car", "lost", "pet", "item"] as const;
export type Kind = (typeof KINDS)[number];

/** Готовые сообщения после скана — по шаблону. */
export const PRESETS: Record<Kind, string[]> = {
  memory: [],
  car: ["blocking", "lights", "window", "tow", "hit"],
  lost: ["found"],
  pet: ["foundPet"],
  item: [],
  link: [],
};

export type Grant = { personId: string; role: Role; until: string | null };
/** place — где был нашедший, если сам согласился отправить. */
export type Message = { id: string; from: string | null; preset: string | null; text: string; reply: string; at: string; read: boolean; place?: { lat: number; lon: number } };
/** Напоминание: что сделать и когда; every — повтор (после «Сделано» срок переносится). */
export const REPEATS = ["none", "week", "month", "quarter", "year"] as const;
export type Repeat = (typeof REPEATS)[number];
export type Task = { id: string; text: string; due: string; every: Repeat; done: { by: string; at: string }[] };

/** Расписание номера: виден только с from до to (по времени хозяина, tz); через полночь — тоже можно (22:00–07:00). */
export type Schedule = { on: boolean; from: string; to: string; tz: string };
export type Contact = { enabled: boolean; phone: string; showPhone: boolean; schedule?: Schedule };
/** size — сколько байт занимает запись (файл и текст): из этого складывается место под кодом. */
export type Block = { id: string; kind: "text" | "photo" | "video"; text: string; media: string | null; author: string; at: string; size?: number };
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
  /** Заблокирован администратором по жалобе: скан ничего не показывает и никуда не ведёт. */
  blocked?: { at: string; reason: string };
  /** Код-ссылка: прежний адрес (до 08.10.2026). Теперь — content; страница скана показывает адрес кнопкой «Открыть». */
  target?: string;
  /** Что в коде из генератора (сайт, телефон, Wi-Fi…): скан открывает нашу страницу с этим и кнопками. */
  content?: Content;
  /** Оформление закреплено: код уже скачан (или куплен) — вид больше не меняется (владелец 08.10.2026). */
  styleLocked?: boolean;
  /** Место под кодом, байт (владелец 08.10.2026: 1 МБ бесплатно, больше — платно); нет — 1 МБ. */
  storage?: number;
  /** До когда оплачено место (помесячно, владелец 09.10.2026); прошло — снова 1 МБ. Нет даты — навсегда (старые данные). */
  storageUntil?: string;
  /** Вещь бренда (защита от подделок): секрет под стираемым слоем, кто зарегистрировал. */
  auth?: AuthRecord;
  /** Все, кто видит и вошёл, могут добавлять записи (свадьба, праздник). */
  publicAdd?: boolean;
  /** Короткий номер для маленьких кодов (заглавные буквы и цифры) и включён ли «маленький код». */
  short?: string;
  compact?: boolean;
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
  contact: { enabled: boolean; showPhone: boolean; phone: string | null; schedule: Schedule | null };
  lost: boolean;
  reward: string;
  /** Напоминания — тем, кому открыт код. */
  tasks: Task[] | null;
  owners: { person: string; at: string; price: number | null }[] | null;
  short: string;
  compact: boolean;
  auth: AuthView | null;
  publicAdd: boolean;
  /** Только хозяину. */
  target?: string | null;
  /** Содержимое (сайт, телефон, Wi-Fi…) — тем, кому код открыт. */
  content: Content | null;
  /** Вид закреплён — менять нельзя (скачан, куплен в маркете, вещь бренда). */
  styleLocked: boolean;
  /** Оплачен (скачан со страницы кода, из генератора — только по оплате, или куплен в маркете): чистый файл для печати. */
  paid: boolean;
  /** Место под кодом: занято и всего, байт (хозяину и тем, кто дописывает). */
  storage?: { used: number; quota: number; plan: string | null; until: string | null };
  stats?: ScanStats;
  /** Заблокирован администратором (видят все: гостю — «заблокирован», хозяину — почему). */
  blocked: boolean;
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

/** Уведомление на сайте: что случилось (kind), подробности (params; who — id человека), куда перейти. */
export type Notice = { id: string; to: string; kind: string; params: Record<string, string>; link: string; at: string; read: boolean };
export type Notices = { items: Notice[]; unread: number; due: number };

export type AuthRecord = {
  batch: string;
  brand: string;
  product: string;
  serial: number;
  secret: string;
  holder: string | null;
  claimedAt: string | null;
  /** Владелец разрешил передать вещь: новый секрет уже у него, при регистрации вещь перейдёт. */
  transferable: boolean;
};
/** Что видно о вещи бренда после скана (без секрета). */
export type AuthView = { brand: string; product: string; serial: number; status: "free" | "mine" | "taken"; claimedAt: string | null; suspicious: boolean; transferable: boolean };
export type Batch = { batch: string; brand: string; product: string; count: number; claimed: number; createdAt: string };
export type BatchItem = { id: string; short: string; serial: number; secret: string; claimed: boolean };

/** items — вещи брендов, зарегистрированные на меня (оригиналы). */
/** Статистика сканов (только хозяину): по дням за 30 дней (от старых к сегодня, UTC), всего, за 7 дней, людей со входом. */
export type ScanStats = { days: number[]; total: number; week: number; people: number };

export const REPORT_REASONS = ["phishing", "spam", "offensive", "other"] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];
export type Report = { id: string; code: string; reason: ReportReason; text: string; from: string | null; at: string; status: "open" | "blocked" | "dismissed" };

export type CodeList = { base: string; mine: CodeView[]; shared: CodeView[]; items: CodeView[] };
export type MarketState = { sold: Record<string, number>; designs: Design[] };
/** Лот с тем, что нужно показать: код (вид, номер, название) и продавец. */
export type Lot = Listing & { view: Pick<CodeView, "title" | "style" | "edition" | "owners"> };

export const MAX_PHOTO_PX = 1600;
/** Один файл — не больше самого большого места под кодом (1 ГБ, владелец 09.10.2026); сверх оплаченного места — всё равно нельзя. */
export const MAX_VIDEO_MB = 1024;

/**
 * Место под каждым кодом (владелец 08.10.2026): 1 МБ бесплатно; больше — помесячно (владелец 09.10.2026: «1 QR — 1 доллар
 * и 1 МБ под ним, место можно поменять»). Сам код оплачивается один раз и работает всегда — помесячно только место.
 * Не продлили — снова 1 МБ: то, что уже лежит, остаётся, новое не добавить, пока не освободят или не продлят.
 * Цены демо, владелец не утверждал.
 */
export const FREE_STORAGE = 1024 * 1024;
export const STORAGE_PLANS = [
  { id: "s10", bytes: 10 * 1024 * 1024, price: 1 },
  { id: "s100", bytes: 100 * 1024 * 1024, price: 3 },
  { id: "s1000", bytes: 1024 * 1024 * 1024, price: 9 },
] as const;
export const STORAGE_MONTH_MS = 30 * 24 * 3600 * 1000;
/** Самое маленькое место, куда влезет столько байт; null — больше самого большого. */
export const planFor = (bytes: number) => (bytes <= FREE_STORAGE ? null : (STORAGE_PLANS.find((p) => p.bytes >= bytes) ?? null));
export const storageOf = (c: Pick<CodeRecord, "storage" | "storageUntil" | "blocks">, now = Date.now()) => {
  const active = !!c.storage && (!c.storageUntil || Date.parse(c.storageUntil) > now);
  const quota = active ? Math.max(FREE_STORAGE, c.storage!) : FREE_STORAGE;
  return {
    used: c.blocks.reduce((s, b) => s + (b.size ?? 0), 0),
    quota,
    plan: active ? (STORAGE_PLANS.find((p) => p.bytes === c.storage)?.id ?? null) : null,
    until: active ? (c.storageUntil ?? null) : null,
  };
};
/** «0,4 МБ», «120 КБ». */
export const fmtBytes = (n: number, lang: string) =>
  n >= 1024 * 1024 * 1024
    ? `${(n / 1024 ** 3).toLocaleString(lang, { maximumFractionDigits: 1 })} GB`
    : n >= 1024 * 1024
      ? `${(n / 1024 ** 2).toLocaleString(lang, { maximumFractionDigits: 1 })} MB`
      : `${Math.max(1, Math.round(n / 1024))} KB`;
/** Сменить место под кодом: пакет («s10»…) на месяц или «free» — обратно 1 МБ. */
export const buyStorage = (id: string, plan: string) => call<CodeView>(`/api/codes/${id}/storage`, json("POST", { plan }));
/** Пакеты кодов: мои (сколько осталось) и покупка. */
export const myPacks = () => call<{ left: number; packs: Pack[] }>("/api/packs");
export const buyPack = (plan: string) => call<{ left: number; packs: Pack[] }>("/api/packs", json("POST", { plan }));
export const VIDEO_TYPES: Record<string, string> = { "video/mp4": "mp4", "video/quicktime": "mov", "video/webm": "webm" };
/** Имя видео, которое браузер кладёт прямо в хранилище: «<код>_<12 букв/цифр>.<mp4|mov|webm>». */
export const uploadedName = (id: string, name: string) => name.startsWith(`${id}_`) && /^[A-Za-z0-9]+_[A-Za-z0-9]{12}\.(mp4|mov|webm)$/.test(name);

/** Куда может вести код-ссылка: сайт, звонок, почта, SMS, Viber. javascript: и прочее — нельзя. */
export const validTarget = (t: string) =>
  t.length <= 2000 && /^(https?:\/\/[^\s]+|tel:\+?\d{3,20}|mailto:[^\s@]+@[^\s]+|sms:\+?\d{3,20}(\?body=[^\s]*)?|viber:\/\/chat\?number=[^\s]+)$/i.test(t);

export const codeLink = (base: string, id: string) => `${base}/c/${id}`;

/**
 * Ссылка, которая зашита в код. «Маленький код»: всё заглавными (адрес сайта к регистру не чувствителен) — QR
 * кодирует такие символы компактнее, клеток меньше, каждая крупнее (для жетонов и брелоков 2–3 см).
 */
export const linkOf = (base: string, c: { id: string; short?: string; compact?: boolean }) =>
  c.compact && c.short ? `${base.toUpperCase()}/K/${c.short}` : codeLink(base, c.id);
export const mediaUrl = (name: string) => `/api/media/${name}`;

async function call<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { cache: "no-store", ...init });
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json() as Promise<T>;
}
const json = (method: string, body: unknown): RequestInit => ({ method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

export type CodePatch = Partial<Pick<CodeRecord, "title" | "visibility" | "people" | "style" | "showOwner" | "contact" | "lost" | "reward" | "compact" | "publicAdd" | "target" | "content">> & {
  readMessages?: boolean;
  removeMessage?: string;
  approve?: string;
  decline?: string;
  newInvite?: boolean;
};

export const api = {
  me: () => call<{ me: string | null; base: string; people: Person[]; demo: boolean; review?: boolean; providers: { google: boolean; apple: boolean }; admin: boolean; colors?: { fg: string; bg: string }[] }>("/api/me"),
  lookup: (email: string) => call<{ id: string }>(`/api/people/lookup?email=${encodeURIComponent(email)}`),
  login: (personId: string | null) => call<{ me: string | null }>("/api/me", json("POST", { personId })),
  /** Вход проверяющих магазинов: логин и код; ошибка — статус (401 неверно, 429 много попыток). */
  reviewLogin: (login: string, code: string) => call<{ me: string }>("/api/auth/review", json("POST", { login, code })),
  list: () => call<CodeList>("/api/codes"),
  create: (title: string, kind: Kind, style: SavedStyle, starter?: { id: string; lang: string }) => call<CodeView>("/api/codes", json("POST", { title, kind, style, starter })),
  quote: (key: string, tier: Tier) => call<Quote>(`/api/purchases?key=${encodeURIComponent(key)}&tier=${tier}`),
  pay: (key: string, tier: Tier) => call<{ ok: true; price: number }>("/api/purchases", json("POST", { key, tier })),
  batch: (count: number, prefix: string, style: SavedStyle) => call<CodeView[]>("/api/codes/batch", json("POST", { count, prefix, kind: "memory", style })),
  lots: () => call<Lot[]>("/api/listings"),
  lot: (id: string) => call<Lot>(`/api/listings/${id}`),
  sell: (code: string, mode: "fixed" | "auction", price: number, hours: number) => call<Lot>("/api/listings", json("POST", { code, mode, price, hours })),
  lotAction: (id: string, action: "buy" | "bid" | "cancel" | "finish", amount?: number) => call<Lot>(`/api/listings/${id}`, json("POST", { action, amount })),
  notices: () => call<Notices>("/api/notifications"),
  readNotices: () => call<{ ok: true }>("/api/notifications", { method: "POST" }),
  contacts: () => call<string[]>("/api/contacts"),
  addContact: (email: string) => call<string[]>("/api/contacts", json("POST", { email })),
  removeContact: (id: string) => call<string[]>(`/api/contacts?id=${encodeURIComponent(id)}`, { method: "DELETE" }),
  claimItem: (id: string, secret: string) => call<CodeView>(`/api/codes/${id}/claim`, json("POST", { secret })),
  releaseItem: (id: string) => call<{ secret: string; view: CodeView }>(`/api/codes/${id}/claim`, { method: "DELETE" }),
  report: (id: string, reason: ReportReason, text: string) => call<{ ok: true }>(`/api/codes/${id}/report`, json("POST", { reason, text })),
  market: () => call<MarketState>("/api/market"),
  publish: (d: { name: string; nameHy: string; nameEn: string; about: string; collab: string; price: number; edition: number | null; drop: boolean; firstOnAuction: boolean; style: SavedStyle }) =>
    call<Design>("/api/market", json("POST", d)),
  unpublish: (design: string) => call<{ ok: true }>(`/api/market/${design}`, { method: "DELETE" }),
  buy: (design: string) => call<CodeView>(`/api/market/${design}`, { method: "POST" }),
  addTask: (id: string, task: { text: string; due: string; every: Repeat }) => call<CodeView>(`/api/codes/${id}/tasks`, json("POST", task)),
  doneTask: (id: string, taskId: string) => call<CodeView>(`/api/codes/${id}/tasks/${taskId}`, json("PATCH", { done: true })),
  removeTask: (id: string, taskId: string) => call<CodeView>(`/api/codes/${id}/tasks/${taskId}`, { method: "DELETE" }),
  message: (id: string, m: { preset: string | null; text: string; reply: string; place?: { lat: number; lon: number } }) => call<{ ok: true }>(`/api/codes/${id}/messages`, json("POST", m)),
  get: (id: string, opts: { visit?: boolean } = {}) => call<CodeView>(`/api/codes/${id}${opts.visit ? "?visit=1" : ""}`),
  patch: (id: string, patch: CodePatch) => call<CodeView>(`/api/codes/${id}`, json("PATCH", patch)),
  remove: (id: string) => call<{ ok: true }>(`/api/codes/${id}`, { method: "DELETE" }),
  /** Код из генератора: адрес (код-ссылка) или текст → короткая ссылка для самого кода. */
  quick: (body: { content: Content; style: unknown; key: string }) => call<{ id: string; link: string }>("/api/codes/quick", json("POST", body)),
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

/** Сейчас внутри окна расписания? Время — в часовом поясе хозяина. */
export function inSchedule(s: Schedule, now = new Date()): boolean {
  const hm = new Intl.DateTimeFormat("en-GB", { timeZone: s.tz || "UTC", hour: "2-digit", minute: "2-digit", hour12: false }).format(now);
  return s.from <= s.to ? hm >= s.from && hm < s.to : hm >= s.from || hm < s.to;
}
