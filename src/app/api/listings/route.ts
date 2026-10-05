import { mutate, newId, settle } from "@/server/db";
import { currentPerson } from "@/server/session";
import { DURATIONS, type Listing } from "@/lib/listings";
import { lotOf } from "./view";

/** Открытые лоты и недавно проданные (для истории цен). */
export async function GET() {
  const lots = await mutate(async (db) => {
    await settle(db);
    const recent = db.listings.filter((l) => l.status === "open" || l.status === "sold").slice(-60).reverse();
    return recent.map((l) => lotOf(db, l)).filter((x) => x !== null);
  });
  return Response.json(lots);
}

/** Выставить свой коллекционный код: фиксированная цена или аукцион (стартовая ставка и срок). */
export async function POST(req: Request) {
  const me = await currentPerson();
  if (!me) return Response.json({ error: "login" }, { status: 401 });
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const mode = b.mode === "fixed" || b.mode === "auction" ? b.mode : null;
  const price = Math.round(Number(b.price));
  const hours = Number(b.hours);
  if (!mode || !Number.isFinite(price) || price < 1 || price > 1_000_000) return Response.json({ error: "bad" }, { status: 400 });
  if (mode === "auction" && !(DURATIONS as readonly number[]).includes(hours)) return Response.json({ error: "bad" }, { status: 400 });
  const result = await mutate((db) => {
    const c = db.codes.find((x) => x.id === b.code && x.owner === me);
    if (!c?.edition) return 403;
    if (db.listings.some((l) => l.code === c.id && l.status === "open")) return 409;
    const at = new Date();
    const l: Listing = {
      id: newId(),
      code: c.id,
      seller: me,
      mode,
      price,
      endsAt: mode === "auction" ? new Date(at.getTime() + hours * 3_600_000).toISOString() : null,
      bids: [],
      status: "open",
      buyer: null,
      final: null,
      createdAt: at.toISOString(),
    };
    db.listings.push(l);
    return lotOf(db, l)!;
  });
  return typeof result === "number" ? Response.json({ error: result }, { status: result }) : Response.json(result);
}
