// Демо-хранилище: один JSON-файл и папка с фото и видео в `.data/` (не в git).
// Нужен, чтобы телефон в той же сети открывал те же коды, что и компьютер. Потом заменим на настоящую базу.
import { randomBytes } from "node:crypto";
import { promises as fs } from "node:fs";
import { networkInterfaces } from "node:os";
import path from "node:path";
import { ymd, type AccessLevel, type CodeRecord, type CodeView, type Kind } from "@/lib/codes";
import { PEOPLE } from "@/lib/people";
import { DESIGNS, SEED_SALES, type Design } from "@/lib/market";
import type { Listing } from "@/lib/listings";
import type { Order } from "@/lib/orders";
import type { Purchase } from "@/lib/pricing";
import type { ShopOrder } from "@/lib/shop";
import { DEFAULT_STYLE, type SavedStyle } from "@/lib/qr/style";

const DIR = path.join(process.cwd(), ".data");
const DB = path.join(DIR, "db.json");
export const MEDIA_DIR = path.join(DIR, "media");

export type Db = { codes: CodeRecord[]; sales: Record<string, number>; designs: Design[]; purchases: Purchase[]; orders: Order[]; listings: Listing[]; shop: ShopOrder[] };

const ALPHABET = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** Случайный id без порядка: по коду нельзя угадать соседние (важно для ключей и вещей). Только буквы и цифры. */
export const newId = (len = 8) => Array.from(randomBytes(len), (b) => ALPHABET[b % ALPHABET.length]).join("");

/** С чего начинается код каждого шаблона. Машина и ключи — хозяин скрыт, память закрыта; питомец — анкета открыта. */
export function kindDefaults(kind: Kind): Pick<CodeRecord, "kind" | "visibility" | "showOwner" | "contact" | "lost" | "reward" | "messages" | "tasks"> {
  const contact = { enabled: kind !== "memory", phone: "", showPhone: false };
  return { kind, visibility: kind === "pet" ? "all" : "me", showOwner: kind === "memory", contact, lost: false, reward: "", messages: [], tasks: [] };
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
    sales: { ...SEED_SALES },
    designs: [],
    purchases: [],
    orders: [],
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

// Общее на весь процесс (разные страницы API — разные копии модуля): очередь записей и первое заполнение.
const g = globalThis as { __qrDbChain?: Promise<unknown>; __qrDbSeed?: Promise<Db> };

async function read(): Promise<Db> {
  try {
    const db = JSON.parse(await fs.readFile(DB, "utf8")) as Db;
    // Коды, сохранённые до шаблонов, — это «память».
    db.codes = db.codes.map((c) => ({ ...kindDefaults(c.kind ?? "memory"), ...c }));
    db.sales ??= { ...SEED_SALES };
    db.designs ??= [];
    db.purchases ??= [];
    db.orders ??= [];
    db.listings ??= [];
    db.shop ??= [];
    return db;
  } catch {
    // Файла нет — заполняем демо-данными один раз, даже если пришло несколько запросов сразу.
    g.__qrDbSeed ??= (async () => {
      const db = seed();
      await write(db);
      return db;
    })().finally(() => (g.__qrDbSeed = undefined));
    return g.__qrDbSeed;
  }
}

async function write(db: Db) {
  await fs.mkdir(MEDIA_DIR, { recursive: true });
  const tmp = `${DB}.${process.pid}.${newId()}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(db));
  await fs.rename(tmp, DB);
}

// Записи по очереди: два изменения подряд не затирают друг друга.
export function mutate<T>(fn: (db: Db) => T | Promise<T>): Promise<T> {
  const run = (g.__qrDbChain ?? Promise.resolve()).then(async () => {
    const db = await read();
    const result = await fn(db);
    await write(db);
    return result;
  });
  g.__qrDbChain = run.catch(() => {});
  return run;
}

export async function findCode(id: string): Promise<CodeRecord | null> {
  return (await read()).codes.find((c) => c.id === id) ?? null;
}

export async function allCodes(): Promise<CodeRecord[]> {
  return (await read()).codes;
}

/** Код переходит новому владельцу чистым: память и настройки продавца не уходят вместе с кодом. */
export async function transferCode(db: Db, codeId: string, buyer: string, price: number) {
  const c = db.codes.find((x) => x.id === codeId);
  if (!c) return;
  const media = c.blocks.map((b) => b.media).filter((m): m is string => !!m);
  const at = new Date().toISOString();
  c.owners = [...(c.owners ?? [{ person: c.owner, at: c.createdAt, price: null }]), { person: buyer, at, price }];
  Object.assign(c, { ...kindDefaults("memory"), owner: buyer, people: [], requests: [], blocks: [], visits: [], invite: newId(12) });
  db.purchases.push({ person: buyer, key: `code:${c.id}`, tier: "styled", price, free: false, at });
  await Promise.all(media.map((m) => fs.rm(path.join(MEDIA_DIR, m), { force: true })));
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
      await transferCode(db, l.code, top.person, top.amount);
    } else l.status = "expired";
  }
}

export async function allOrders(): Promise<Order[]> {
  return (await read()).orders;
}

export async function purchasesOf(person: string): Promise<Purchase[]> {
  return (await read()).purchases.filter((p) => p.person === person);
}

export async function market(): Promise<{ sold: Record<string, number>; designs: Design[] }> {
  const db = await read();
  return { sold: db.sales, designs: db.designs };
}

const today = () => new Date().toISOString().slice(0, 10);

/**
 * Кто что может: «только я» — только хозяин; «выбранные люди» — по списку (с датой «до»);
 * «все» — смотрят все, а из списка с правом «дописывать» — дописывают.
 */
export function accessOf(code: CodeRecord, me: string | null): AccessLevel {
  if (me && code.owner === me) return "owner";
  if (code.visibility === "me") return "closed";
  const grant = me ? code.people.find((p) => p.personId === me && (!p.until || p.until >= today())) : undefined;
  if (grant) return grant.role;
  return code.visibility === "all" ? "view" : "closed";
}

export function viewOf(code: CodeRecord, me: string | null): CodeView {
  const access = accessOf(code, me);
  const owner = access === "owner";
  const phone = owner || code.contact.showPhone ? code.contact.phone || null : null;
  return {
    id: code.id,
    kind: code.kind,
    owner: owner || code.showOwner ? code.owner : null,
    // У ключей и машины название может выдать адрес — видит только хозяин и те, кому открыто.
    title: owner || code.kind === "memory" || code.kind === "pet" || access !== "closed" ? code.title : null,
    showOwner: code.showOwner,
    contact: { enabled: code.contact.enabled, showPhone: code.contact.showPhone, phone },
    lost: code.lost,
    reward: code.lost || owner ? code.reward : "",
    edition: code.edition ?? null,
    owners: code.edition ? (code.owners ?? []) : null,
    tasks: access === "closed" ? null : [...code.tasks].sort((a, b) => a.due.localeCompare(b.due)),
    access,
    visibility: code.visibility,
    // Хозяин скрыт — его имя не должно проступить и в подписях к записям.
    blocks: access === "closed" ? null : owner || code.showOwner ? code.blocks : code.blocks.map((b) => (b.author === code.owner ? { ...b, author: "" } : b)),
    requested: !!me && code.requests.some((r) => r.personId === me),
    style: owner || access !== "closed" ? code.style : null,
    ...(owner && {
      people: code.people,
      requests: code.requests,
      invite: code.invite,
      visits: code.visits.slice(-50).reverse(),
      messages: [...code.messages].reverse(),
    }),
  };
}

export const isPerson = (id: unknown): id is string => typeof id === "string" && PEOPLE.some((p) => p.id === id);

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
