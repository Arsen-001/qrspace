// Демо-хранилище: один JSON-файл и папка с фото и видео в `.data/` (не в git).
// Нужен, чтобы телефон в той же сети открывал те же коды, что и компьютер. Потом заменим на настоящую базу.
import { randomBytes } from "node:crypto";
import { promises as fs } from "node:fs";
import { networkInterfaces } from "node:os";
import path from "node:path";
import type { AccessLevel, CodeRecord, CodeView } from "@/lib/codes";
import { PEOPLE } from "@/lib/people";
import { DEFAULT_STYLE, type SavedStyle } from "@/lib/qr/style";

const DIR = path.join(process.cwd(), ".data");
const DB = path.join(DIR, "db.json");
export const MEDIA_DIR = path.join(DIR, "media");

type Db = { codes: CodeRecord[] };

const ALPHABET = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** Случайный id без порядка: по коду нельзя угадать соседние (важно для ключей и вещей). Только буквы и цифры. */
export const newId = (len = 8) => Array.from(randomBytes(len), (b) => ALPHABET[b % ALPHABET.length]).join("");

const style = (p: Partial<SavedStyle>): SavedStyle => ({ ...DEFAULT_STYLE, eyeIcon: null, picture: null, ...p });

function seed(): Db {
  const now = Date.now();
  const at = (minAgo: number) => new Date(now - minAgo * 60_000).toISOString();
  const text = (t: string, author: string, minAgo: number) => ({ id: newId(), kind: "text" as const, text: t, media: null, author, at: at(minAgo) });
  const base = { requests: [], visits: [] };
  return {
    codes: [
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
        style: style({ texture: "paper", fg: "#2b2620", bg: "#f3efe6", eyeColor: "#14532d", eyeBallColor: "#14532d", dot: "leaf", eye: "leaf" }),
        createdAt: at(1500),
      },
    ],
  };
}

// Общее на весь процесс (разные страницы API — разные копии модуля): очередь записей и первое заполнение.
const g = globalThis as { __qrDbChain?: Promise<unknown>; __qrDbSeed?: Promise<Db> };

async function read(): Promise<Db> {
  try {
    return JSON.parse(await fs.readFile(DB, "utf8")) as Db;
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
  return {
    id: code.id,
    owner: code.owner,
    title: code.title,
    access,
    visibility: code.visibility,
    blocks: access === "closed" ? null : code.blocks,
    requested: !!me && code.requests.some((r) => r.personId === me),
    style: owner || access !== "closed" ? code.style : null,
    ...(owner && { people: code.people, requests: code.requests, invite: code.invite, visits: code.visits.slice(-50).reverse() }),
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
