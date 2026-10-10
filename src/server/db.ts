// Данные сайта: коды, люди, маркет, заказы… Где они лежат (файл или Postgres) — в ./store.ts, фото и видео — в ./media.ts.
// Здесь — что в данных, демо-заполнение и правила: кто что видит и может.
import { randomBytes } from "node:crypto";
import { networkInterfaces } from "node:os";
import { media as mediaStore } from "./media";
import { store } from "./store";
import { inSchedule, SAMPLE_SHORT, ymd, type Report, type AccessLevel, type CodeRecord, type CodeView, type Kind, type Notice, storageOf } from "@/lib/codes";
import { DESIGNS, marketList, SEED_SALES, type Design, type DesignOverride, type MarketDesign } from "@/lib/market";
import type { Listing } from "@/lib/listings";
import type { Order } from "@/lib/orders";
import type { Purchase } from "@/lib/pricing";
import type { Pack } from "@/lib/packs";
import type { ShopOrder } from "@/lib/shop";
import { after } from "next/server";
import { DICTS, fill } from "@/lib/i18n";
import { nftView } from "./nft";
import { deliver, pushOn, type PushMessage } from "./push";
import { active, demoUsers, publicPerson, usable, type User } from "./users";
import { DEFAULT_STYLE, type SavedStyle } from "@/lib/qr/style";


/** Одноразовый код входа в приложение: браузер внутри приложения вошёл → приложение меняет код на свою сессию (5 минут). */
export type AppToken = { token: string; person: string; until: string };
/** Оплата места под кодом (месяц): чтобы она была в «Покупках», в «Потрачено» и в выручке. */
export type SpacePay = { person: string; code: string; plan: string; bytes: number; price: number; at: string; store?: "apple" | "google"; test?: boolean };
/** Покупка в App Store / Google Play, уже засчитанная (по номеру покупки) — второй раз не засчитываем. */
/** Неверный код входа проверяющих: с какого адреса (хеш) и когда — 5 ошибок за 15 минут, дальше ждать. */
export type ReviewTry = { ip: string; at: string };

export type IapUse = { id: string; store: "apple" | "google"; product: string; person: string; at: string; test?: boolean };

export type Db = { codes: CodeRecord[]; sales: Record<string, number>; designs: Design[]; purchases: Purchase[]; packs: Pack[]; orders: Order[]; listings: Listing[]; shop: ShopOrder[]; users: User[]; notifications: Notice[]; reports: Report[]; appTokens: AppToken[]; spaces: SpacePay[]; iap: IapUse[]; reviewTries: ReviewTry[]; marketOverrides: Record<string, DesignOverride> };

const ALPHABET = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
// Без похожих (0/O, 1/I) — короткий номер иногда вводят руками.
const SHORT = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
/** Секрет под стираемым слоем бирки: 8 знаков без похожих букв. */
export const newSecret = () => Array.from(randomBytes(8), (b) => SHORT[b % SHORT.length]).join("");
/**
 * Предел новых кодов на человека за сутки (свои коды, генератор, наборы меток): все данные — один документ, и скрипт,
 * создающий коды без конца, замедлил бы сайт всем. Купленные коды и номера не считаются.
 */
export const DAILY_NEW_CODES = 500;
export const overDailyLimit = (db: Db, me: string, adding: number) => {
  const since = Date.now() - 86_400_000;
  return db.codes.filter((c) => c.owner === me && Date.parse(c.createdAt) > since).length + adding > DAILY_NEW_CODES;
};
export const takenShorts = (db: Db) => new Set(db.codes.map((c) => c.short).filter((x): x is string => !!x));
export const newShort = (taken: Set<string>) => {
  for (;;) {
    const s = Array.from(randomBytes(6), (b) => SHORT[b % SHORT.length]).join("");
    if (!taken.has(s) && s !== SAMPLE_SHORT) return s;
  }
};

/** Случайный id без порядка: по коду нельзя угадать соседние (важно для ключей и вещей). Только буквы и цифры. */
export const newId = (len = 8) => Array.from(randomBytes(len), (b) => ALPHABET[b % ALPHABET.length]).join("");

/** С чего начинается код каждого шаблона. Машина и ключи — хозяин скрыт, память закрыта; питомец — анкета открыта. */
export function kindDefaults(kind: Kind): Pick<CodeRecord, "kind" | "visibility" | "showOwner" | "contact" | "lost" | "reward" | "messages" | "tasks"> {
  const contact = { enabled: kind !== "memory" && kind !== "item" && kind !== "link", phone: "", showPhone: false };
  // Вещь бренда: страница открыта всем (там «Оригинал» и регистрация), имя бренда — в самой вещи.
  return { kind, visibility: kind === "pet" || kind === "item" || kind === "link" ? "all" : "me", showOwner: kind === "memory", contact, lost: false, reward: "", messages: [], tasks: [] };
}

const style = (p: Partial<SavedStyle>): SavedStyle => ({ ...DEFAULT_STYLE, eyeIcon: null, picture: null, ...p });

function seed(): Db {
  const now = Date.now();
  const at = (minAgo: number) => new Date(now - minAgo * 60_000).toISOString();
  const dayOffset = (days: number) => ymd(new Date(now + days * 86_400_000));
  const text = (t: string, author: string, minAgo: number) => ({ id: newId(), kind: "text" as const, text: t, media: null, author, at: at(minAgo) });
  const base = { requests: [], visits: [], ...kindDefaults("memory") };
  const parchment = { ...base, id: newId(), owner: "ani", title: "Пергамент", people: [], invite: newId(12), blocks: [], createdAt: at(9000),
    style: DESIGNS.find((d) => d.id === "parchment")!.style, edition: { design: "parchment", no: 12, of: 100 }, owners: [{ person: "ani", at: at(9000), price: 12 }] };
  const nebula = { ...base, id: newId(), owner: "david", title: "Туманность", people: [], invite: newId(12), blocks: [], createdAt: at(7000),
    style: DESIGNS.find((d) => d.id === "nebula")!.style, edition: { design: "nebula", no: 3, of: 30 }, owners: [{ person: "david", at: at(7000), price: 15 }] };
  const listings: Listing[] = [
    { id: newId(), code: parchment.id, seller: "ani", mode: "fixed", price: 40, endsAt: null, bids: [], status: "open", buyer: null, final: null, createdAt: at(300) },
    {
      id: newId(), code: nebula.id, seller: "david", mode: "auction", price: 20, endsAt: new Date(now + 2 * 86_400_000).toISOString(),
      bids: [{ person: "lilit", amount: 20, at: at(200) }, { person: "ani", amount: 25, at: at(90) }], status: "open", buyer: null, final: null, createdAt: at(400),
    },
  ];
  return {
    listings,
    shop: [],
    users: demoUsers(),
    notifications: [],
    reports: [],
    sales: { ...SEED_SALES },
    designs: [],
    purchases: [],
    packs: [],
    appTokens: [],
    spaces: [],
    iap: [],
    reviewTries: [],
    orders: [],
    marketOverrides: {},
    codes: [
      parchment,
      nebula,
      {
        ...base,
        id: newId(),
        owner: "arman",
        title: "Котёл — как включить",
        visibility: "people",
        people: [
          { personId: "ani", role: "edit", until: null },
          { personId: "david", role: "view", until: null },
        ],
        requests: [{ personId: "lilit", at: at(30) }],
        invite: newId(12),
        blocks: [
          text("1. Открыть кран подачи газа (жёлтая ручка — вдоль трубы).\n2. Нажать и держать кнопку розжига 10 секунд.\n3. Давление на стрелке — от 1,2 до 1,8. Если меньше — подкачать синим краном снизу.", "arman", 4000),
          text("Осенью давление было 1,0 — подкачал до 1,5. Всё работает.", "ani", 900),
        ],
        tasks: [
          { id: newId(), text: "Проверить давление (1,2–1,8) и подкачать", due: dayOffset(-3), every: "year", done: [] },
          { id: newId(), text: "Почистить фильтр", due: dayOffset(12), every: "quarter", done: [{ by: "ani", at: at(60 * 24 * 80) }] },
        ],
        style: style({ fg: "#7a1f2b", bg: "#fff8f0", eyeColor: "#7a1f2b", eyeBallColor: "#7a1f2b", dot: "rounded", eye: "rounded", effect: "raised" }),
        createdAt: at(5000),
      },
      {
        ...base,
        id: newId(),
        owner: "arman",
        title: "Wi‑Fi для гостей",
        visibility: "all",
        people: [],
        invite: newId(12),
        blocks: [text("Сеть: Home-Guest\nПароль: welcome2026\nРоутер — в прихожей, если интернет пропал — выключить и включить.", "arman", 3000)],
        style: style({ fg: "#1b2a4a", bg: "#ffffff", eyeColor: "#1b2a4a", eyeBallColor: "#1b2a4a", dot: "liquid", eye: "leaf", gradient: { to: "#2e3fd6", angle: 45 } }),
        createdAt: at(3000),
      },
      {
        ...base,
        id: newId(),
        owner: "arman",
        title: "Семейный альбом",
        visibility: "me",
        people: [],
        invite: newId(12),
        blocks: [text("Сюда — фото и видео, которые хочу сохранить. Видно только мне.", "arman", 2000)],
        style: style({ fg: "#4c1d95", bg: "#f7f3ff", eyeColor: "#4c1d95", eyeBallColor: "#4c1d95", dot: "dots", eye: "circle" }),
        createdAt: at(2000),
      },
      {
        ...base,
        id: newId(),
        owner: "ani",
        title: "Цветы на балконе — полив",
        visibility: "people",
        people: [{ personId: "arman", role: "edit", until: null }],
        invite: newId(12),
        blocks: [text("Фикус — раз в неделю, стакан воды.\nОрхидея — раз в 10 дней, в миску на 15 минут.\nЛетом — чаще.", "ani", 1500)],
        tasks: [{ id: newId(), text: "Полить фикус", due: dayOffset(1), every: "week", done: [{ by: "arman", at: at(60 * 24 * 6) }] }],
        style: style({ texture: "paper", fg: "#2b2620", bg: "#f3efe6", eyeColor: "#14532d", eyeBallColor: "#14532d", dot: "leaf", eye: "leaf" }),
        createdAt: at(1500),
      },
      {
        ...base,
        ...kindDefaults("car"),
        id: newId(),
        owner: "arman",
        title: "Моя машина",
        contact: { enabled: true, phone: "+374 99 123456", showPhone: false },
        messages: [{ id: newId(), from: null, preset: "lights", text: "Стоит у дома 12, фары горят с утра.", reply: "", at: at(45), read: false }],
        people: [],
        invite: newId(12),
        blocks: [],
        style: style({ fg: "#111111", bg: "#ffffff", eyeColor: "#111111", eyeBallColor: "#c2410c", dot: "rounded", eye: "drop" }),
        createdAt: at(1000),
      },
      {
        ...base,
        ...kindDefaults("pet"),
        id: newId(),
        owner: "arman",
        title: "Бублик",
        people: [],
        invite: newId(12),
        blocks: [
          text("Бублик, 3 года, бигль. Добрый, любит людей и сосиски.\nЧипирован. Прививки — все, по графику.", "arman", 800),
          text("Если нашли — дайте воды и напишите нам кнопкой ниже. Спасибо!", "arman", 790),
        ],
        style: style({ fg: "#7c2d12", bg: "#fff7ed", eyeColor: "#7c2d12", eyeBallColor: "#7c2d12", dot: "heart", eye: "circle" }),
        createdAt: at(800),
      },
      {
        ...base,
        ...kindDefaults("lost"),
        id: newId(),
        owner: "arman",
        title: "Ключи от дома",
        reward: "5 000 ֏",
        people: [],
        invite: newId(12),
        blocks: [],
        style: style({ fg: "#1b2a4a", bg: "#ffffff", eyeColor: "#1b2a4a", eyeBallColor: "#1b2a4a", dot: "dots", eye: "rounded" }),
        createdAt: at(600),
      },
    ],
  };
}

// Общее на весь процесс (разные страницы API — разные копии модуля): очередь записей.
const g = globalThis as { __qrDbChain?: Promise<unknown> };

/** Старые данные — к нынешнему виду (новые поля, короткие номера). */
function normalize(db: Db): Db {
  // Коды, сохранённые до шаблонов, — это «память».
  db.codes = db.codes.map((c) => ({ ...kindDefaults(c.kind ?? "memory"), ...c }));
  // Короткий номер — у каждого кода (новые получают при первом чтении).
  const taken = new Set(db.codes.map((c) => c.short).filter((x): x is string => !!x));
  db.codes.forEach((c) => {
    if (!c.short) taken.add((c.short = newShort(taken)));
  });
  db.sales ??= { ...SEED_SALES };
  db.designs ??= [];
  db.purchases ??= [];
  db.packs ??= [];
  db.appTokens ??= [];
  db.spaces ??= [];
  db.iap ??= [];
  db.reviewTries ??= [];
  db.orders ??= [];
  db.listings ??= [];
  db.shop ??= [];
  db.users ??= demoUsers();
  db.notifications ??= [];
  db.reports ??= [];
  db.marketOverrides ??= {};
  // Новые демо-люди (например, «Администратор») появляются и в уже заполненных данных.
  for (const d of demoUsers()) if (!db.users.some((u) => u.id === d.id)) db.users.push(d);
  contactsOf = new Map(db.users.map((u) => [u.id, u.contacts ?? []]));
  return db;
}

/** Прочитать данные; пусто — заполнить демо-данными (если два запроса сразу — сохранит один, второй перечитает). */
async function load(): Promise<{ db: Db; version: number }> {
  for (;;) {
    const { data, version } = await store.load();
    if (data) return { db: normalize(data as Db), version };
    const db = seed();
    if (await store.save(db, 0)) return { db: normalize(db), version: 1 };
  }
}

// Чтение без записи — из памяти, пока данные не поменялись (сверяем только номер версии).
// Такие данные только читаем; меняет их одна mutate — она всегда берёт свежую копию.
const cache = globalThis as { __qrRead?: { key: number; db: Db } };

/** Данные только для чтения (из памяти, пока не поменялись) — менять их можно только в mutate. */
export async function read(): Promise<Db> {
  const key = await store.version();
  if (key && cache.__qrRead?.key === key) return cache.__qrRead.db;
  const { db } = await load();
  cache.__qrRead = { key: await store.version(), db };
  return db;
}

// Записи по очереди: два изменения подряд не затирают друг друга.
export function mutate<T>(fn: (db: Db) => T | Promise<T>): Promise<T> {
  const run = (g.__qrDbChain ?? Promise.resolve()).then(async () => {
    // Другой сервер (на хостинге их несколько) мог успеть поменять данные — тогда перечитываем и повторяем.
    for (let attempt = 0; attempt < 8; attempt++) {
      const { db, version } = await load();
      const result = await fn(db);
      if (await store.save(db, version)) {
        cache.__qrRead = undefined;
        const notices = outbox.get(db);
        if (notices) sendPush(pushMessages(db, notices));
        return result;
      }
    }
    throw new Error("store: too many conflicts");
  });
  g.__qrDbChain = run.catch(() => {});
  return run;
}

export async function findCode(id: string): Promise<CodeRecord | null> {
  return (await read()).codes.find((c) => c.id === id) ?? null;
}

export async function findByShort(short: string): Promise<CodeRecord | null> {
  const s = short.toUpperCase();
  return (await read()).codes.find((c) => c.short === s) ?? null;
}

export async function allCodes(): Promise<CodeRecord[]> {
  return (await read()).codes;
}

/** Код переходит новому владельцу чистым: память и настройки продавца не уходят вместе с кодом. */
export async function transferCode(db: Db, codeId: string, buyer: string, price: number) {
  const c = db.codes.find((x) => x.id === codeId);
  if (!c) return;
  const files = c.blocks.map((b) => b.media).filter((m): m is string => !!m);
  const at = new Date().toISOString();
  c.owners = [...(c.owners ?? [{ person: c.owner, at: c.createdAt, price: null }]), { person: buyer, at, price }];
  Object.assign(c, { ...kindDefaults("memory"), owner: buyer, people: [], requests: [], blocks: [], visits: [], invite: newId(12) });
  db.purchases.push({ person: buyer, key: `code:${c.id}`, tier: "styled", price, free: false, at });
  await Promise.all(files.map((m) => mediaStore.remove(m)));
}

/** Аукцион с истёкшим сроком закрываем при первом обращении: есть ставки — код победителю. */
export async function settle(db: Db, now = Date.now()) {
  for (const l of db.listings) {
    if (l.status !== "open" || l.mode !== "auction" || !l.endsAt || Date.parse(l.endsAt) > now) continue;
    const top = l.bids.at(-1);
    if (top) {
      l.status = "sold";
      l.buyer = top.person;
      l.final = top.amount;
      const title = db.codes.find((c) => c.id === l.code)?.title ?? "";
      notify(db, top.person, null, "won", { title, amount: String(top.amount) }, `/market/lot/${l.id}`);
      notify(db, l.seller, null, "sold", { who: top.person, title, amount: String(top.amount) }, `/market/lot/${l.id}`);
      await transferCode(db, l.code, top.person, top.amount);
    } else l.status = "expired";
  }
}

export async function noticesFor(person: string) {
  return (await read()).notifications.filter((n) => n.to === person);
}

export async function allOrders(): Promise<Order[]> {
  return (await read()).orders;
}

export async function packsOf(person: string): Promise<Pack[]> {
  return (await read()).packs.filter((p) => p.person === person);
}

export async function purchasesOf(person: string): Promise<Purchase[]> {
  return (await read()).purchases.filter((p) => p.person === person);
}

/** Оплата уже создала код, и он ещё есть: одна оплата — один код (для quote). Код удалили — оплата снова свободна. */
export const spentIn = (db: Pick<Db, "codes">) => (p: Purchase) => !!p.code && db.codes.some((c) => c.id === p.code);

/** Цена для человека — как quote, но оплата, ушедшая на существующий код, уже не в счёт. */
export async function quoteFor(person: string): Promise<{ mine: Purchase[]; spent: (p: Purchase) => boolean; packs: Pack[] }> {
  const db = await read();
  return { mine: db.purchases.filter((p) => p.person === person), spent: spentIn(db), packs: db.packs.filter((p) => p.person === person) };
}

/** Маркет как его видят все: дизайны с правками администратора, без скрытых (withHidden — и скрытые), и сколько продано. */
export async function market(withHidden = false): Promise<{ sold: Record<string, number>; designs: MarketDesign[] }> {
  const db = await read();
  return { sold: db.sales, designs: marketList(db.designs, db.marketOverrides, withHidden) };
}

const today = () => new Date().toISOString().slice(0, 10);

/**
 * Кто что может: «только я» — только хозяин; «выбранные люди» — по списку (с датой «до»);
 * «все» — смотрят все, а из списка с правом «дописывать» — дописывают.
 */
// Контакты всех людей — обновляются при каждом чтении хранилища (нужны для «Мои контакты» в accessOf).
let contactsOf = new Map<string, string[]>();

export function accessOf(code: CodeRecord, me: string | null): AccessLevel {
  if (me && code.owner === me) return "owner";
  if (code.blocked) return "closed";
  if (code.visibility === "me") return "closed";
  const grant = me ? code.people.find((p) => p.personId === me && (!p.until || p.until >= today())) : undefined;
  if (grant) return grant.role;
  const sees = code.visibility === "contacts" ? !!me && !!contactsOf.get(code.owner)?.includes(me) : code.visibility === "all";
  if (!sees) return "closed";
  // «Гости добавляют свои фото» — вошедшие могут дописывать (менять — только своё).
  return code.publicAdd && me ? "edit" : "view";
}

/** Уведомить человека (себя за свои же действия — не уведомляем). */
export function notify(db: Db, to: string | null | undefined, actor: string | null, kind: string, params: Record<string, string>, link: string) {
  if (!to || to === actor) return;
  const n: Notice = { id: newId(), to, kind, params, link, at: new Date().toISOString(), read: false };
  db.notifications.push(n);
  db.notifications = db.notifications.slice(-2000);
  // На телефон — только когда запись сохранится (см. mutate) и есть ключи Apple / Firebase.
  const on = pushOn();
  if ((on.ios || on.android) && db.users.find((u) => u.id === to)?.devices?.length) outbox.set(db, [...(outbox.get(db) ?? []), n]);
}

/** Уведомления этой правки данных, которые надо отправить на телефоны (у каждой попытки mutate — свои). */
const outbox = new WeakMap<Db, Notice[]>();

/** Текст на языке телефона — тот же, что в колокольчике сайта. */
function pushMessages(db: Db, notices: Notice[]): PushMessage[] {
  return notices.flatMap((n) => {
    const u = db.users.find((x) => x.id === n.to);
    return (u?.devices ?? []).map((d) => {
      const t = DICTS[d.lang ?? "en"] as unknown as Record<string, string>;
      const who = n.params.who ? (db.users.find((x) => x.id === n.params.who)?.name ?? "") : "";
      const text = fill(t[`notice.${n.kind}`] ?? n.kind, { ...n.params, who });
      const extra = n.kind === "message" ? (n.params.preset ? t[`preset.${n.params.preset}`] : n.params.text) : "";
      return { token: d.token, platform: d.platform, title: "QR Space", body: extra ? `${text}: ${extra}` : text, link: n.link };
    });
  });
}

/** Отправить после ответа сайта; токены удалённых приложений убрать. */
function sendPush(messages: PushMessage[]) {
  if (!messages.length) return;
  const job = async () => {
    const dead = await deliver(messages);
    if (dead.length) await mutate((db) => db.users.forEach((u) => u.devices && (u.devices = u.devices.filter((d) => !dead.includes(d.token)))));
  };
  try {
    after(job);
  } catch {
    void job().catch(() => {});
  }
}

export const designerIdsIn = (db: Db) => db.users.filter((u) => u.designer).map((u) => u.id);

/** «Оригинал»: чья вещь (я / другой / никто) и не скопирован ли код — его сканируют подозрительно часто. */
/** NFT кода на странице после скана: № токена и сеть (подробно — в сертификате). */
const nftChip = (n: CodeRecord["nft"]) => {
  const v = nftView(n);
  return v ? { token: v.token, network: v.network, test: v.test, url: v.url } : null;
};

function authView(code: CodeRecord, me: string | null) {
  const a = code.auth!;
  const month = Date.now() - 30 * 86_400_000;
  const others = code.visits.filter((v) => Date.parse(v.at) > month && (!v.personId || v.personId !== a.holder)).length;
  return {
    brand: a.brand,
    product: a.product,
    serial: a.serial,
    status: !a.holder ? ("free" as const) : a.holder === me ? ("mine" as const) : ("taken" as const),
    claimedAt: a.claimedAt,
    suspicious: others >= 20,
    transferable: a.transferable,
  };
}

/** Сканы по дням за 30 дней (UTC), всего, за неделю и сколько разных людей со входом. */
export function statsOf(visits: CodeRecord["visits"]) {
  const DAY = 86_400_000;
  const today = Math.floor(Date.now() / DAY);
  const days = Array.from({ length: 30 }, () => 0);
  for (const v of visits) {
    const ago = today - Math.floor(Date.parse(v.at) / DAY);
    if (ago >= 0 && ago < 30) days[29 - ago] += 1;
  }
  return { days, total: visits.length, week: days.slice(-7).reduce((a, b) => a + b, 0), people: new Set(visits.map((v) => v.personId).filter(Boolean)).size };
}

/** Записать скан (хозяина не считаем). Храним последние 3000. */
export async function recordVisit(id: string, me: string | null, allowed: boolean) {
  await mutate((db) => {
    const c = db.codes.find((x) => x.id === id);
    if (!c || c.owner === me) return;
    c.visits.push({ personId: me, at: new Date().toISOString(), allowed });
    c.visits = c.visits.slice(-3000);
  });
}

export function viewOf(code: CodeRecord, me: string | null): CodeView {
  const access = accessOf(code, me);
  const owner = access === "owner";
  // Номер уходит с сервера, только если хозяин включил его и (если задано расписание) сейчас время показа.
  const sched = code.contact.schedule?.on ? code.contact.schedule : null;
  const phoneOn = code.contact.showPhone && (!sched || inSchedule(sched));
  const phone = owner || phoneOn ? code.contact.phone || null : null;
  return {
    id: code.id,
    kind: code.kind,
    owner: owner || code.showOwner ? code.owner : null,
    // У ключей и машины название может выдать адрес — видит только хозяин и те, кому открыто.
    title: owner || code.kind === "memory" || code.kind === "pet" || access !== "closed" ? code.title : null,
    showOwner: code.showOwner,
    contact: { enabled: code.contact.enabled, showPhone: owner ? code.contact.showPhone : phoneOn, phone, schedule: owner ? (code.contact.schedule ?? null) : null },
    lost: code.lost,
    reward: code.lost || owner ? code.reward : "",
    publicAdd: !!code.publicAdd,
    short: code.short ?? "",
    compact: !!code.compact,
    blocked: !!code.blocked,
    edition: code.edition ?? null,
    nft: nftChip(code.nft),
    auth: code.auth ? authView(code, me) : null,
    owners: code.edition ? (code.owners ?? []) : null,
    tasks: access === "closed" ? null : [...code.tasks].sort((a, b) => a.due.localeCompare(b.due)),
    access,
    visibility: code.visibility,
    // Хозяин скрыт — его имя не должно проступить и в подписях к записям.
    blocks: access === "closed" ? null : owner || code.showOwner ? code.blocks : code.blocks.map((b) => (b.author === code.owner ? { ...b, author: "" } : b)),
    requested: !!me && code.requests.some((r) => r.personId === me),
    style: owner || access !== "closed" ? code.style : null,
    styleLocked: !!(code.styleLocked || code.edition || code.auth),
    paid: !!code.styleLocked || !!code.edition,
    ...((owner || access === "edit") && { storage: storageOf(code) }),
    // Прежний код-ссылка без содержимого — его адрес как «сайт».
    // Заблокированный по жалобе — содержимое (куда ведёт) только хозяину.
    content: access === "closed" || (code.blocked && !owner) ? null : (code.content ?? (code.target ? { type: "url", fields: { url: code.target } } : null)),
    ...(owner && {
      people: code.people,
      requests: code.requests,
      invite: code.invite,
      visits: code.visits.slice(-50).reverse(),
      target: code.target ?? null,
      stats: statsOf(code.visits),
      messages: [...code.messages].reverse(),
    }),
  };
}

export async function findUser(id: string): Promise<User | null> {
  const u = (await read()).users.find((x) => x.id === id) ?? null;
  // Заблокированный администратором — как не вошедший: ни один вход и ни одно действие от его имени не проходит.
  return u && active(u) && !u.blocked ? u : null;
}

/** Имена всех, кто может войти, — для подписей в браузере (без почт). */
/**
 * Имена только тех, с кем у меня есть общее: мои коды и коды, открытые мне, контакты, заказы, уведомления,
 * а также публичное в маркете (дизайнеры, продавцы, ставки, история владельцев). Почты — никогда.
 */
export async function directory(me: string | null) {
  const db = await read();
  const ids = new Set<string>(me ? [me] : []);
  const add = (...xs: (string | null | undefined)[]) => xs.forEach((x) => x && ids.add(x));
  for (const d of db.designs) add(d.by);
  for (const l of db.listings) {
    add(l.seller, l.buyer, ...l.bids.map((b) => b.person));
    add(...(db.codes.find((c) => c.id === l.code)?.owners ?? []).map((o) => o.person));
  }
  if (me) {
    add(...(db.users.find((u) => u.id === me)?.contacts ?? []));
    for (const c of db.codes) {
      const level = accessOf(c, me);
      if (level === "closed") continue;
      if (level === "owner") {
        add(...c.people.map((g) => g.personId), ...c.requests.map((r) => r.personId), ...c.visits.map((v) => v.personId), ...c.messages.map((m) => m.from));
      } else if (c.showOwner) add(c.owner);
      add(...c.blocks.map((b) => (b.author === c.owner && level !== "owner" && !c.showOwner ? null : b.author)));
      add(...c.tasks.flatMap((t) => t.done.map((d) => (d.by === c.owner && level !== "owner" && !c.showOwner ? null : d.by))));
    }
    const designer = db.users.find((u) => u.id === me)?.designer;
    for (const o of db.orders) if (designer || o.client === me) add(o.client, ...o.thread.map((m) => m.from));
    for (const n of db.notifications) if (n.to === me) add(n.params.who);
  }
  return usable(db).filter((u) => ids.has(u.id) || u.provider === "demo").map(publicPerson);
}

export async function userByEmail(email: string): Promise<User | null> {
  const e = email.trim().toLowerCase();
  return usable(await read()).find((u) => u.email.toLowerCase() === e) ?? null;
}

export const isAdminId = async (id: string | null) => !!id && !!(await findUser(id))?.admin;

export const isDesignerId = async (id: string | null) => !!id && !!(await findUser(id))?.designer;

/** Адрес в самом коде: на выкладке — постоянный адрес сайта (APP_URL), даже если открыли через *.vercel.app. */
export function linkBase(req: Request): string {
  const app = process.env.APP_URL?.replace(/\/$/, "");
  return app && process.env.NODE_ENV === "production" ? app : publicBase(req);
}

/** Адрес для ссылки в коде: с localhost телефон не откроет — подставляем адрес компьютера в сети. */
export function publicBase(req: Request): string {
  const url = new URL(req.url);
  const host = req.headers.get("host") ?? url.host;
  const [name, port] = host.split(":");
  if (name !== "localhost" && name !== "127.0.0.1") return `${url.protocol}//${host}`;
  const lan = Object.values(networkInterfaces())
    .flat()
    .find((n) => n && n.family === "IPv4" && !n.internal);
  return `${url.protocol}//${lan?.address ?? name}${port ? `:${port}` : ""}`;
}
