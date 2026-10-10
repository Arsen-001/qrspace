import type { NextRequest } from "next/server";
import { BLOCK_REASONS } from "@/lib/admin";
import { mutate } from "@/server/db";
import { adminId, bad, blockCode, codeRow, forbidden, unblockCode } from "@/server/admin";

/**
 * Код из кабинета (без жалобы): block — заблокировать с причиной (те же, что у жалоб; хозяину — уведомление),
 * unblock — разблокировать. Та же блокировка, что по жалобе: скан покажет «заблокирован», ссылка никуда не ведёт.
 */
export async function PATCH(req: NextRequest, ctx: RouteContext<"/api/admin/codes/[id]">) {
  const { id } = await ctx.params;
  const me = await adminId();
  if (!me) return forbidden();
  const { action, reason } = (await req.json().catch(() => ({}))) as { action?: unknown; reason?: unknown };
  if (action !== "block" && action !== "unblock") return bad();
  if (action === "block" && !(BLOCK_REASONS as readonly unknown[]).includes(reason)) return bad();
  const result = await mutate((db) => {
    const c = db.codes.find((x) => x.id === id);
    if (!c) return 404;
    if (action === "block") blockCode(db, c, me, reason as string, "codeBlockedAdmin");
    else if (c.blocked) unblockCode(db, c);
    return codeRow(db, c);
  });
  return typeof result === "number" ? Response.json({ error: result }, { status: result }) : Response.json(result);
}
