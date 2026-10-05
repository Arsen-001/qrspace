import type { NextRequest } from "next/server";
import { mutate, notify, settle, transferCode } from "@/server/db";
import { currentPerson } from "@/server/session";
import { minBid } from "@/lib/listings";
import { lotOf } from "../view";

const lotTitle = (db: { codes: { id: string; title: string }[] }, code: string) => db.codes.find((c) => c.id === code)?.title ?? "";

export async function GET(_req: NextRequest, ctx: RouteContext<"/api/listings/[id]">) {
  const { id } = await ctx.params;
  const lot = await mutate(async (db) => {
    await settle(db);
    const l = db.listings.find((x) => x.id === id);
    return l ? lotOf(db, l) : null;
  });
  return lot ? Response.json(lot) : Response.json({ error: "not-found" }, { status: 404 });
}

/**
 * buy — купить по фиксированной цене; bid — ставка (не меньше минимальной; на своё нельзя);
 * cancel — продавец снимает лот (аукцион — только без ставок); finish — продавец завершает аукцион сейчас (демо).
 * Оплата — демо.
 */
export async function POST(req: NextRequest, ctx: RouteContext<"/api/listings/[id]">) {
  const { id } = await ctx.params;
  const me = await currentPerson();
  if (!me) return Response.json({ error: "login" }, { status: 401 });
  const { action, amount } = (await req.json().catch(() => ({}))) as { action?: string; amount?: unknown };
  const result = await mutate(async (db) => {
    await settle(db);
    const l = db.listings.find((x) => x.id === id);
    if (!l) return 404;
    if (l.status !== "open") return 409;
    const mine = l.seller === me;
    if (action === "buy") {
      if (mine || l.mode !== "fixed") return 400;
      l.status = "sold";
      l.buyer = me;
      l.final = l.price;
      notify(db, l.seller, me, "sold", { who: me, title: lotTitle(db, l.code), amount: String(l.price) }, `/market/lot/${l.id}`);
      await transferCode(db, l.code, me, l.price);
    } else if (action === "bid") {
      const n = Math.round(Number(amount));
      if (mine || l.mode !== "auction" || !Number.isFinite(n) || n < minBid(l) || l.bids.at(-1)?.person === me) return 400;
      const prev = l.bids.at(-1)?.person;
      l.bids.push({ person: me, amount: n, at: new Date().toISOString() });
      const title = lotTitle(db, l.code);
      notify(db, prev, me, "outbid", { title, amount: String(n) }, `/market/lot/${l.id}`);
      notify(db, l.seller, me, "bid", { who: me, title, amount: String(n) }, `/market/lot/${l.id}`);
    } else if (action === "cancel") {
      if (!mine || l.bids.length) return 403;
      l.status = "cancelled";
    } else if (action === "finish") {
      if (!mine || l.mode !== "auction") return 403;
      l.endsAt = new Date().toISOString();
      await settle(db, Date.now() + 1);
    } else return 400;
    return lotOf(db, l)!;
  });
  return typeof result === "number" ? Response.json({ error: result }, { status: result }) : Response.json(result);
}
