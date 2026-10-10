// Кабинет администратора на сервере: кто администратор, списки людей, кодов, покупок и маркета, блокировки.
// Маршруты /api/admin/* только проверяют вход и разбирают запрос — всё остальное здесь.
import { storageOf, type CodeRecord } from "@/lib/codes";
import { DESIGNS, marketList } from "@/lib/market";
import { PACKAGES } from "@/lib/orders";
import { actionHref } from "@/lib/qr/payload";
import type { AdminBuy, AdminCodeRow, AdminDesign, AdminLot, AdminMarket, AdminPurchases, AdminUserDetail, AdminUserRow, CodeFilter, UserFilter, Who } from "@/lib/admin";
import { FEE } from "@/lib/listings";
import { isAdminId, notify, type Db } from "./db";
import { currentPerson } from "./session";
import type { User } from "./users";

/** id администратора, если вошёл администратор; иначе null (маршрут отвечает 403). */
export async function adminId(): Promise<string | null> {
  const me = await currentPerson();
  return (await isAdminId(me)) ? me : null;
}
export const forbidden = () => Response.json({ error: "admin" }, { status: 403 });
export const bad = () => Response.json({ error: "bad" }, { status: 400 });

/** Строка поиска из адреса: не длиннее 100 знаков, без регистра. */
export const readQuery = (v: string | null) => (v ?? "").trim().toLowerCase().slice(0, 100);

const who = (db: Db, id: string): Who => ({ id, name: db.users.find((u) => u.id === id)?.name ?? "—" });
/** Почту демо-людей и аккаунта проверки не показываем нигде (она служебная). */
const emailOf = (u: User) => (u.provider === "demo" || u.provider === "review" ? "" : u.email);
const money = (n: number) => Math.round(n * 100) / 100;

/** Все оплаты сайта одним списком (новые первыми): коды, дизайны маркета, перепродажи, пакеты, место, товары, заказы брендов. */
export function buyRows(db: Db): AdminBuy[] {
  // Словари вместо поиска по спискам: оплат и кодов могут быть тысячи.
  const codes = new Map(db.codes.map((c) => [c.id, c]));
  const names = new Map(db.users.map((u) => [u.id, u.name]));
  const person = (id: string): Who => ({ id, name: names.get(id) ?? "—" });
  const resales = new Set(db.listings.filter((l) => l.status === "sold").map((l) => `${l.code}|${l.buyer}|${l.final}`));
  const rows: AdminBuy[] = [];
  for (const p of db.purchases) {
    const id = p.key.startsWith("code:") ? p.key.slice(5) : (p.code ?? null);
    const c = id ? codes.get(id) : undefined;
    const resale = !!id && resales.has(`${id}|${p.person}|${p.price}`);
    const kind = p.free ? "free" : p.pack ? "fromPack" : resale ? "resale" : c?.edition && p.key.startsWith("code:") ? "design" : "code";
    rows.push({ kind, person: person(p.person), price: p.price, at: p.at, store: p.store ?? null, test: !!p.test, title: c?.title ?? null, code: c ? c.id : null });
  }
  for (const p of db.packs) rows.push({ kind: "pack", person: person(p.person), price: p.price, at: p.at, store: p.store ?? null, test: !!p.test, title: `${p.codes} QR`, code: null });
  for (const s of db.spaces) {
    const c = codes.get(s.code);
    rows.push({ kind: "space", person: person(s.person), price: s.price, at: s.at, store: s.store ?? null, test: !!s.test, title: c?.title ?? null, code: c ? c.id : null });
  }
  for (const o of db.shop) rows.push({ kind: "shop", person: person(o.person), price: o.total, at: o.createdAt, store: null, test: false, title: `${o.product} · ${o.variant} × ${o.qty}`, code: null });
  for (const o of db.orders) rows.push({ kind: "brand", person: person(o.client), price: PACKAGES[o.pkg] ?? 0, at: o.createdAt, store: null, test: false, title: o.brand, code: null });
  return rows.sort((a, b) => b.at.localeCompare(a.at));
}

/** Оборот (все оплаты без проверочных) — общий для «Обзора» и «Покупок». */
export const revenueOf = (rows: AdminBuy[]) => money(rows.reduce((n, r) => n + (r.test ? 0 : r.price), 0));

function codeStats(db: Db) {
  const by = new Map<string, { codes: number; scans: number; storage: number }>();
  for (const c of db.codes) {
    const x = by.get(c.owner) ?? { codes: 0, scans: 0, storage: 0 };
    x.codes += 1;
    x.scans += c.visits.length;
    x.storage += storageOf(c).used;
    by.set(c.owner, x);
  }
  return by;
}

/** Платные покупки (без проверочных) по людям: сколько и на какую сумму. */
function moneyStats(buys: AdminBuy[]) {
  const by = new Map<string, { buys: number; spent: number }>();
  for (const b of buys) {
    if (b.test || b.price <= 0) continue;
    const x = by.get(b.person.id) ?? { buys: 0, spent: 0 };
    x.buys += 1;
    x.spent += b.price;
    by.set(b.person.id, x);
  }
  return by;
}

function userRow(u: User, stats: ReturnType<typeof codeStats>, paid: ReturnType<typeof moneyStats>): AdminUserRow {
  const s = stats.get(u.id) ?? { codes: 0, scans: 0, storage: 0 };
  const m = paid.get(u.id) ?? { buys: 0, spent: 0 };
  return {
    id: u.id,
    name: u.name,
    email: emailOf(u),
    provider: u.provider,
    createdAt: u.createdAt,
    admin: !!u.admin,
    designer: u.designer,
    blocked: u.blocked ? { at: u.blocked.at, note: u.blocked.note } : null,
    codes: s.codes,
    scans: s.scans,
    buys: m.buys,
    spent: money(m.spent),
    storage: s.storage,
  };
}

/** Люди: поиск по имени, почте и id; новые первыми; не больше 200 строк. */
export function userRows(db: Db, q: string, filter: UserFilter) {
  const stats = codeStats(db);
  const paid = moneyStats(buyRows(db));
  const found = db.users
    .filter((u) => (filter === "real" ? u.provider !== "demo" : filter === "demo" ? u.provider === "demo" : filter === "blocked" ? !!u.blocked : true))
    .filter((u) => !q || u.name.toLowerCase().includes(q) || emailOf(u).toLowerCase().includes(q) || u.id.toLowerCase() === q)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return { total: found.length, rows: found.slice(0, 200).map((u) => userRow(u, stats, paid)) };
}

export function codeRow(db: Db, c: CodeRecord): AdminCodeRow {
  return {
    id: c.id,
    short: c.short ?? "",
    title: c.title,
    kind: c.kind,
    owner: who(db, c.owner),
    createdAt: c.createdAt,
    scans: c.visits.length,
    blocked: c.blocked ? { at: c.blocked.at, reason: c.blocked.reason } : null,
    reports: db.reports.filter((r) => r.code === c.id && r.status === "open").length,
    visibility: c.visibility,
    edition: c.edition ?? null,
    target: (c.content ? actionHref(c.content) : null) ?? c.target ?? null,
    storage: storageOf(c).used,
  };
}

/** Коды: поиск по названию, короткой ссылке, id, хозяину (имя, почта) и куда ведёт; новые первыми; не больше 100. */
export function codeRows(db: Db, q: string, filter: CodeFilter) {
  const open = new Set(db.reports.filter((r) => r.status === "open").map((r) => r.code));
  const owners = new Map(db.users.map((u) => [u.id, `${u.name} ${emailOf(u)}`.toLowerCase()]));
  const found = db.codes
    .filter((c) => (filter === "blocked" ? !!c.blocked : filter === "reported" ? open.has(c.id) : true))
    .filter((c) => {
      if (!q) return true;
      const target = ((c.content ? actionHref(c.content) : null) ?? c.target ?? "").toLowerCase();
      return c.title.toLowerCase().includes(q) || (c.short ?? "").toLowerCase() === q.replace(/^.*\/k\//, "") || c.id.toLowerCase() === q || (owners.get(c.owner) ?? "").includes(q) || target.includes(q);
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return { total: found.length, rows: found.slice(0, 100).map((c) => codeRow(db, c)) };
}

/** Человек целиком: цифры, коды, покупки, пакеты, лоты. */
export function userDetail(db: Db, id: string): AdminUserDetail | null {
  const u = db.users.find((x) => x.id === id);
  if (!u) return null;
  const buys = buyRows(db);
  return {
    user: userRow(u, codeStats(db), moneyStats(buys)),
    codes: db.codes.filter((c) => c.owner === id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map((c) => codeRow(db, c)),
    buys: buys.filter((b) => b.person.id === id),
    packs: db.packs.filter((p) => p.person === id).reverse().map((p) => ({ id: p.id, codes: p.codes, used: p.used, price: p.price, at: p.at, store: p.store ?? null, test: !!p.test })),
    lots: db.listings
      .filter((l) => l.seller === id)
      .reverse()
      .map((l) => ({ id: l.id, title: db.codes.find((c) => c.id === l.code)?.title ?? "—", status: l.status, mode: l.mode, price: l.price, final: l.final, at: l.createdAt })),
  };
}

/** Заблокировать код (по жалобе или из кабинета): скан ничего не показывает, хозяину — уведомление; открытые жалобы закрыты. */
export function blockCode(db: Db, c: CodeRecord, me: string, reason: string, notice: "codeBlocked" | "codeBlockedAdmin" | null) {
  c.blocked = { at: new Date().toISOString(), reason };
  if (notice) notify(db, c.owner, me, notice, { title: c.title, reason }, `/codes/${c.id}`);
  db.reports.forEach((r) => r.code === c.id && r.status === "open" && (r.status = "blocked"));
}

/** Разблокировать: код снова работает, жалобы на него — «отклонены» (решение принято). */
export function unblockCode(db: Db, c: CodeRecord) {
  delete c.blocked;
  db.reports.forEach((r) => r.code === c.id && (r.status = "dismissed"));
}

/** Снять лот с продажи (администратор): код остаётся у продавца; продавцу и тем, кто ставил, — уведомление. */
export function removeLot(db: Db, id: string, me: string): boolean {
  const l = db.listings.find((x) => x.id === id);
  if (!l || l.status !== "open") return false;
  l.status = "cancelled";
  l.removed = { at: new Date().toISOString(), by: me };
  const title = db.codes.find((c) => c.id === l.code)?.title ?? "";
  for (const p of new Set([l.seller, ...l.bids.map((b) => b.person)])) notify(db, p, me, "lotRemoved", { title }, `/market/lot/${l.id}`);
  return true;
}

/** Маркет для кабинета: все дизайны (и скрытые) с правками и продажами; открытые лоты, потом недавние закрытые. */
export function adminMarket(db: Db): AdminMarket {
  const designs: AdminDesign[] = marketList(db.designs, db.marketOverrides, true).map((d) => {
    const base = db.designs.find((x) => x.id === d.id) ?? DESIGNS.find((x) => x.id === d.id);
    return {
      id: d.id,
      name: d.name,
      about: d.about,
      price: d.price,
      basePrice: base?.price ?? d.price,
      edition: d.edition,
      sold: db.sales[d.id] ?? 0,
      drop: !!d.drop,
      featured: !!d.featured,
      hidden: !!d.hidden,
      changed: !!d.changed,
      seed: !d.by && DESIGNS.some((x) => x.id === d.id),
      by: d.by ? who(db, d.by) : null,
      collab: d.collab ?? null,
      style: d.style,
    };
  });
  const order = (s: string) => (s === "open" ? 0 : 1);
  const lots: AdminLot[] = [...db.listings]
    .reverse()
    .sort((a, b) => order(a.status) - order(b.status))
    .slice(0, 60)
    .map((l) => {
      const c = db.codes.find((x) => x.id === l.code);
      return {
        id: l.id,
        code: l.code,
        title: c?.title ?? "—",
        seller: who(db, l.seller),
        mode: l.mode,
        price: l.price,
        top: l.bids.at(-1)?.amount ?? null,
        bids: l.bids.length,
        endsAt: l.endsAt,
        status: l.status,
        removed: !!l.removed,
        createdAt: l.createdAt,
        style: c?.style ?? null,
        edition: c?.edition ?? null,
      };
    });
  return { designs, lots };
}

/** Покупки: итоги по источникам и последние 300 строк. */
export function purchases(db: Db): AdminPurchases {
  const rows = buyRows(db);
  const real = rows.filter((r) => !r.test);
  const sum = (xs: AdminBuy[]) => money(xs.reduce((n, r) => n + r.price, 0));
  const resale = sum(real.filter((r) => r.kind === "resale"));
  return {
    totals: {
      revenue: revenueOf(rows),
      site: sum(real.filter((r) => !r.store)),
      apple: sum(real.filter((r) => r.store === "apple")),
      google: sum(real.filter((r) => r.store === "google")),
      resale,
      fees: money(resale * FEE),
      count: real.filter((r) => r.price > 0).length,
      test: rows.filter((r) => r.test).length,
      buyers: new Set(real.filter((r) => r.price > 0).map((r) => r.person.id)).size,
    },
    rows: rows.slice(0, 300),
  };
}
