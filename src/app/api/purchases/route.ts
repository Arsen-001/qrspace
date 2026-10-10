import type { NextRequest } from "next/server";
import { mutate, quoteFor, spentIn } from "@/server/db";
import { currentPerson } from "@/server/session";
import { quote, type Purchase, type Quote, type Tier } from "@/lib/pricing";
import { openPack, packsLeft, type Pack } from "@/lib/packs";

const readKey = (v: unknown) => (typeof v === "string" && /^(g|code):[\w-]{1,40}$/.test(v) ? v : null);
const readTier = (v: unknown): Tier | null => (v === "simple" || v === "styled" ? v : null);

/** Цена с учётом пакетов: первый простой — бесплатно, как и был; дальше, если есть пакет, — код из пакета. */
function withPack(q: Quote, packs: Pack[]): Quote {
  if (q.paid || q.free) return q;
  const p = openPack(packs);
  return p ? { paid: false, price: 0, free: false, pack: { left: packsLeft(packs), bytes: p.bytes } } : q;
}

/** Сколько стоит скачать код: ?key=…&tier=… */
export async function GET(req: NextRequest) {
  const me = await currentPerson();
  if (!me) return Response.json({ error: "login" }, { status: 401 });
  const key = readKey(req.nextUrl.searchParams.get("key"));
  const tier = readTier(req.nextUrl.searchParams.get("tier"));
  if (!key || !tier) return Response.json({ error: "bad" }, { status: 400 });
  const { mine, spent, packs } = await quoteFor(me);
  return Response.json(withPack(quote(mine, key, tier, spent), packs));
}

/** Оплатить (демо — деньги не списываются) и получить право скачивать этот код. */
export async function POST(req: Request) {
  const me = await currentPerson();
  if (!me) return Response.json({ error: "login" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const key = readKey(body.key);
  const tier = readTier(body.tier);
  if (!key || !tier) return Response.json({ error: "bad" }, { status: 400 });
  const q = await mutate((db) => {
    const mine = db.packs.filter((p) => p.person === me);
    const q = withPack(quote(db.purchases.filter((p) => p.person === me), key, tier, spentIn(db)), mine);
    const pack = q.pack ? openPack(mine) : null;
    const buy: Purchase = { person: me, key, tier, price: q.price, free: q.free, at: new Date().toISOString() };
    if (pack) {
      pack.used += 1;
      Object.assign(buy, { pack: pack.id, bytes: pack.bytes });
    }
    if (!q.paid) db.purchases.push(buy);
    // Скачали свой код с памятью — его вид закрепляется.
    const code = key.startsWith("code:") ? db.codes.find((c) => c.id === key.slice(5) && c.owner === me) : null;
    if (code) code.styleLocked = true;
    return q;
  });
  return Response.json({ ok: true, price: q.price });
}
