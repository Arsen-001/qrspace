// Вход проверяющих App Store / Google Play (09.10.2026, как в BookTime; docs/store/REVIEW-LOGIN.md).
// Логин и код — из REVIEW_LOGIN / REVIEW_LOGIN_CODE (users.ts → reviewAccount). Проверяющий входит в свой аккаунт
// «App Review»: в нём сразу есть коды со сканами, чтобы кабинет не был пустым. Удалил аккаунт (Apple это проверяет) —
// следующий вход заведёт его заново.
import { createHash, timingSafeEqual } from "node:crypto";
import type { CodeRecord, Visit } from "@/lib/codes";
import { DEFAULT_STYLE, type SavedStyle } from "@/lib/qr/style";
import { kindDefaults, newId, newShort, takenShorts, type Db } from "./db";
import { reviewAccount, type User } from "./users";

const DAY = 86_400_000;
export const REVIEW_WINDOW = 15 * 60_000;
export const REVIEW_TRIES = 5;

const digest = (s: string) => createHash("sha256").update(s).digest();
const same = (a: string, b: string) => timingSafeEqual(digest(a), digest(b));

/** Логин (без учёта регистра) и код подходят — сравнение за одинаковое время. */
export function reviewMatches(login: string, code: string): boolean {
  const acc = reviewAccount();
  if (!acc) return false;
  const okLogin = same(login.trim().toLowerCase(), acc.login);
  const okCode = same(code.trim(), acc.code);
  return okLogin && okCode;
}

/** Адрес, с которого пришли, — только хеш: для счёта ошибок, сам адрес не храним. */
export function clientKey(req: Request): string {
  const ip = req.headers.get("x-real-ip") || req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  return createHash("sha256").update(`review:${ip}`).digest("base64url").slice(0, 16);
}

/** Аккаунт проверки: есть — он, нет — заводим. Кодов нет — кладём примеры. */
export function reviewUser(db: Db, now = Date.now()): User {
  let u = db.users.find((x) => x.provider === "review");
  if (!u) {
    u = { id: newId(), provider: "review", sub: "review", email: "app-review@review.local", name: "App Review", designer: false, createdAt: new Date(now).toISOString() };
    db.users.push(u);
  }
  const owner = u.id;
  if (!db.codes.some((c) => c.owner === owner)) db.codes.push(...samples(db, owner, now));
  return u;
}

const style = (p: Partial<SavedStyle>): SavedStyle => ({ ...DEFAULT_STYLE, eyeIcon: null, picture: null, ...p });

/** Сканы за 30 дней, чаще — в последние дни. */
const scans = (n: number, now: number): Visit[] =>
  Array.from({ length: n }, () => ({ personId: null, at: new Date(now - Math.random() ** 1.6 * 30 * DAY).toISOString(), allowed: true })).sort((a, b) => a.at.localeCompare(b.at));

/** Примеры на английском (проверяющие Apple и Google): сайт, Wi‑Fi и код с памятью. Все три оплачены. */
function samples(db: Db, owner: string, now: number): CodeRecord[] {
  const taken = takenShorts(db);
  const at = (days: number) => new Date(now - days * DAY).toISOString();
  const common = { owner, people: [], requests: [], blocks: [], styleLocked: true };
  const link = (title: string, content: CodeRecord["content"], look: SavedStyle, visits: number, days: number): CodeRecord => ({
    ...kindDefaults("link"),
    ...common,
    id: newId(),
    short: newShort(taken),
    compact: true,
    title,
    content,
    style: look,
    invite: newId(12),
    visits: scans(visits, now),
    createdAt: at(days),
  });
  const site = link("Website", { type: "url", fields: { url: "https://qrspace.co" } }, style({ fg: "#1b2a4a", bg: "#ffffff", eyeColor: "#1b2a4a", eyeBallColor: "#1b2a4a", dot: "liquid", eye: "leaf", gradient: { to: "#2e3fd6", angle: 45 } }), 140, 34);
  taken.add(site.short!);
  const wifi = link("Guest Wi‑Fi", { type: "wifi", fields: { ssid: "Guest", password: "welcome2026", security: "WPA" } }, style({ fg: "#14532d", bg: "#f3efe6", eyeColor: "#14532d", eyeBallColor: "#14532d", dot: "rounded", eye: "rounded" }), 56, 31);
  taken.add(wifi.short!);
  const memory: CodeRecord = {
    ...kindDefaults("memory"),
    ...common,
    id: newId(),
    short: newShort(taken),
    title: "Welcome note",
    visibility: "all",
    invite: newId(12),
    blocks: [
      {
        id: newId(),
        kind: "text",
        text: "This is a code with memory. Text, photos and video saved here open when someone scans the code.\nYou choose who can see it: everyone, selected people or only you.",
        media: null,
        author: owner,
        at: at(20),
      },
    ],
    style: style({ fg: "#4c1d95", bg: "#f7f3ff", eyeColor: "#4c1d95", eyeBallColor: "#4c1d95", dot: "dots", eye: "circle" }),
    visits: scans(18, now),
    createdAt: at(20),
  };
  return [site, wifi, memory];
}
