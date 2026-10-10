import type { NextRequest } from "next/server";
import type { L10n } from "@/lib/i18n";
import { DESIGNS, marketList, type DesignOverride } from "@/lib/market";
import { mutate, notify } from "@/server/db";
import { adminId, adminMarket, bad, forbidden } from "@/server/admin";

/** Название или описание на трёх языках; пустой армянский или английский — как русский. undefined — не присылали. */
function readL10n(v: unknown, max: number): L10n | null | undefined {
  if (v === undefined) return undefined;
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const s = (x: unknown) => (typeof x === "string" ? x.trim().slice(0, max) : "");
  const ru = s(o.ru);
  if (!ru) return null;
  return { hy: s(o.hy) || ru, ru, en: s(o.en) || ru };
}
const same = (a: L10n, b: L10n) => a.hy === b.hy && a.ru === b.ru && a.en === b.en;
/** В правке ничего, кроме «кто и когда», — хранить нечего. */
const bare = (o: DesignOverride) => !Object.keys(o).some((k) => k !== "at" && k !== "by");
const flag = (v: unknown) => (v === undefined || typeof v === "boolean" ? v : null);

/**
 * Правка дизайна администратором (встроенного или выложенного дизайнером) — сразу видна в маркете:
 * hidden — скрыть / показать (скрытый не купить), featured — в подборку «Выбор QR Space» (первым в сетке),
 * drop — сделать дропом дня (один на маркет) / снять, price — цена $1–10 000, name / about — название и описание
 * (ru обязательно, hy / en — по желанию), reset — вернуть как было. Совпало с исходным — правку не храним.
 */
export async function PATCH(req: NextRequest, ctx: RouteContext<"/api/admin/designs/[id]">) {
  const { id } = await ctx.params;
  const me = await adminId();
  if (!me) return forbidden();
  const b = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!b || typeof b !== "object") return bad();
  const hidden = flag(b.hidden);
  const featured = flag(b.featured);
  const drop = flag(b.drop);
  const name = readL10n(b.name, 40);
  const about = readL10n(b.about, 300);
  const price = b.price === undefined ? undefined : Number(b.price);
  const reset = b.reset === true;
  if (hidden === null || featured === null || drop === null || name === null || about === null || (b.reset !== undefined && !reset)) return bad();
  if (price !== undefined && !(Number.isInteger(price) && price >= 1 && price <= 10_000)) return bad();
  if (!reset && [hidden, featured, drop, name, about, price].every((x) => x === undefined)) return bad();

  const result = await mutate((db) => {
    const base = db.designs.find((x) => x.id === id) ?? DESIGNS.find((x) => x.id === id);
    if (!base) return 404;
    const wasHidden = !!db.marketOverrides[id]?.hidden;
    if (reset) {
      delete db.marketOverrides[id];
      return adminMarket(db);
    }
    const o: DesignOverride = { ...db.marketOverrides[id], at: new Date().toISOString(), by: me };
    if (hidden !== undefined) {
      if (hidden) o.hidden = true;
      else delete o.hidden;
    }
    if (featured !== undefined) {
      if (featured) o.featured = true;
      else delete o.featured;
    }
    if (drop === true) {
      // Дроп дня один: прежний выбор администратора снимаем, этот — главный.
      for (const [k, x] of Object.entries(db.marketOverrides)) {
        if (k === id || !x.drop) continue;
        delete x.drop;
        if (bare(x)) delete db.marketOverrides[k];
      }
      o.drop = true;
    } else if (drop === false) {
      // Дроп по умолчанию (встроенный или выложенный дизайнером как дроп) снимаем явно, выбранный администратором — просто убираем выбор.
      if (base.drop) o.drop = false;
      else delete o.drop;
    }
    if (price !== undefined) {
      if (price === base.price) delete o.price;
      else o.price = price;
    }
    if (name) {
      if (same(name, base.name)) delete o.name;
      else o.name = name;
    }
    if (about) {
      if (same(about, base.about)) delete o.about;
      else o.about = about;
    }
    // Правок не осталось (всё как в исходном) — и хранить нечего.
    if (bare(o)) delete db.marketOverrides[id];
    else db.marketOverrides[id] = o;
    // Скрыли выложенный дизайнером — ему уведомление (купленные коды у людей остаются).
    if (hidden && !wasHidden) {
      const title = marketList(db.designs, db.marketOverrides, true).find((d) => d.id === id)?.name.ru ?? base.name.ru;
      notify(db, base.by, me, "designHidden", { title }, `/market`);
    }
    return adminMarket(db);
  });
  return typeof result === "number" ? Response.json({ error: result }, { status: result }) : Response.json(result);
}
