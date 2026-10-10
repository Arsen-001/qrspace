import type { NextRequest } from "next/server";
import { mutate, settle } from "@/server/db";
import { adminId, adminMarket, bad, forbidden, removeLot } from "@/server/admin";

/**
 * remove — снять лот перепродажи с продажи (и аукцион со ставками): из маркета пропадает, купить и ставить нельзя,
 * код остаётся у продавца; продавцу и тем, кто ставил, — уведомление. Уже закрытый (продан, истёк, снят) — 409.
 */
export async function PATCH(req: NextRequest, ctx: RouteContext<"/api/admin/listings/[id]">) {
  const { id } = await ctx.params;
  const me = await adminId();
  if (!me) return forbidden();
  const { action } = (await req.json().catch(() => ({}))) as { action?: unknown };
  if (action !== "remove") return bad();
  const result = await mutate(async (db) => {
    // Истёкший аукцион сначала закрываем как обычно (код — лучшей ставке), снимать уже нечего.
    await settle(db);
    if (!db.listings.some((l) => l.id === id)) return 404;
    return removeLot(db, id, me) ? adminMarket(db) : 409;
  });
  return typeof result === "number" ? Response.json({ error: result }, { status: result }) : Response.json(result);
}
