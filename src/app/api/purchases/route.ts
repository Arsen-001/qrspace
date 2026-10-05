import type { NextRequest } from "next/server";
import { mutate, purchasesOf } from "@/server/db";
import { currentPerson } from "@/server/session";
import { quote, type Tier } from "@/lib/pricing";

const readKey = (v: unknown) => (typeof v === "string" && /^(g|code):[\w-]{1,40}$/.test(v) ? v : null);
const readTier = (v: unknown): Tier | null => (v === "simple" || v === "styled" ? v : null);

/** Сколько стоит скачать код: ?key=…&tier=… */
export async function GET(req: NextRequest) {
  const me = await currentPerson();
  if (!me) return Response.json({ error: "login" }, { status: 401 });
  const key = readKey(req.nextUrl.searchParams.get("key"));
  const tier = readTier(req.nextUrl.searchParams.get("tier"));
  if (!key || !tier) return Response.json({ error: "bad" }, { status: 400 });
  return Response.json(quote(await purchasesOf(me), key, tier));
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
    const q = quote(db.purchases.filter((p) => p.person === me), key, tier);
    if (!q.paid) db.purchases.push({ person: me, key, tier, price: q.price, free: q.free, at: new Date().toISOString() });
    return q;
  });
  return Response.json({ ok: true, price: q.price });
}
