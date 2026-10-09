// Пользователи: вход только через Google или Apple (+ демо-люди для проверки, отключаются DEMO_LOGIN=off).
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import type { Lang } from "@/lib/i18n";
import { colorFor, PEOPLE, type Person } from "@/lib/people";
import type { Db } from "./db";

export type User = {
  id: string;
  provider: "google" | "apple" | "demo";
  /** Номер человека у Google/Apple (sub) — по нему узнаём при следующем входе. */
  sub: string;
  email: string;
  name: string;
  designer: boolean;
  /** Администратор сайта: жалобы, блокировка кодов, общие цифры. Почты — ADMIN_EMAILS. */
  admin?: boolean;
  /** «Мои контакты»: кого человек добавил (по почте). Код с «Мои контакты» видят только они. */
  contacts?: string[];
  createdAt: string;
  /** Порядок «Моих кодов» (перетаскивание): id кодов; новых тут ещё нет — они идут первыми. */
  codeOrder?: string[];
  /** Последние цвета (точки и фон) — после скачивания; первыми в «Тонкой настройке». */
  recentColors?: { fg: string; bg: string }[];
  /** Телефоны с нашим приложением — куда слать уведомления (APNs / FCM, когда будут ключи). */
  devices?: { token: string; platform: "ios" | "android"; at: string; lang?: Lang }[];
};

export const demoEnabled = () => process.env.DEMO_LOGIN !== "off";

/** Дизайнеры: демо-Наре и почты из DESIGNER_EMAILS (через запятую). */
const adminEmails = () => (process.env.ADMIN_EMAILS ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
const designerEmails = () => (process.env.DESIGNER_EMAILS ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);

export const demoUsers = (): User[] =>
  PEOPLE.map((p) => ({ id: p.id, provider: "demo", sub: p.id, email: `${p.id}@demo.local`, name: p.name.ru, designer: !!p.designer, admin: !!p.admin, createdAt: new Date(0).toISOString() }));

/** Что видно о человеке другим: только имя и цвет (почта — никогда). */
export function publicPerson(u: User): Person {
  const demo = PEOPLE.find((p) => p.id === u.id && u.provider === "demo");
  if (demo) return demo;
  return { id: u.id, name: { hy: u.name, ru: u.name, en: u.name }, color: colorFor(u.id), demo: { hy: "", ru: "", en: "" }, designer: u.designer };
}

export function usable(db: Db): User[] {
  return db.users.filter((u) => u.provider !== "demo" || demoEnabled());
}

/** Нашли по Google/Apple — обновили имя и почту; нет — создали. */
export function upsertUser(db: Db, provider: "google" | "apple", sub: string, email: string, name: string, newId: () => string): User {
  let u = db.users.find((x) => x.provider === provider && x.sub === sub);
  const designer = !!email && designerEmails().includes(email.toLowerCase());
  if (u) {
    if (email) u.email = email;
    if (name) u.name = name;
    u.designer = u.designer || designer;
    u.admin = !!email && adminEmails().includes(email.toLowerCase());
    return u;
  }
  u = { id: newId(), provider, sub, email, name: name || email.split("@")[0] || "QR", designer, admin: !!email && adminEmails().includes(email.toLowerCase()), createdAt: new Date().toISOString() };
  db.users.push(u);
  return u;
}

// Подпись cookie входа: без секрета подделать «я — такой-то» нельзя.
// AUTH_SECRET задаётся при выкладке; на этом компьютере — свой случайный, в .data/secret.
let secret: Buffer | null = null;
async function authSecret(): Promise<Buffer> {
  if (secret) return secret;
  if (process.env.AUTH_SECRET) return (secret = Buffer.from(process.env.AUTH_SECRET));
  // На настоящем сайте секрет обязателен: файлы там не сохраняются, а случайный секрет «разлогинит» всех.
  if (process.env.NODE_ENV === "production" && process.env.DATABASE_URL) throw new Error("AUTH_SECRET is required");
  const file = path.join(process.cwd(), ".data", "secret");
  try {
    secret = await fs.readFile(file);
  } catch {
    secret = randomBytes(32);
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, secret);
  }
  return secret;
}

export async function sign(value: string): Promise<string> {
  const mac = createHmac("sha256", await authSecret()).update(value).digest("base64url");
  return `${value}.${mac}`;
}

export async function unsign(signed: string | undefined): Promise<string | null> {
  if (!signed) return null;
  const i = signed.lastIndexOf(".");
  if (i < 1) return null;
  const value = signed.slice(0, i);
  const expected = Buffer.from((await sign(value)).slice(i + 1));
  const got = Buffer.from(signed.slice(i + 1));
  return expected.length === got.length && timingSafeEqual(expected, got) ? value : null;
}
