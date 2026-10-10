import type { NextRequest } from "next/server";
import { mutate } from "@/server/db";
import { adminId, bad, blockCode, forbidden, unblockCode } from "@/server/admin";

/**
 * Решение по жалобе: block — заблокировать код (скан покажет «заблокирован», ссылка никуда не ведёт; хозяину —
 * уведомление), dismiss — отклонить, unblock — разблокировать. Остальные открытые жалобы на тот же код — тем же решением.
 */
export async function PATCH(req: NextRequest, ctx: RouteContext<"/api/admin/reports/[id]">) {
  const { id } = await ctx.params;
  const me = await adminId();
  if (!me) return forbidden();
  const { action } = (await req.json().catch(() => ({}))) as { action?: unknown };
  if (action !== "block" && action !== "dismiss" && action !== "unblock") return bad();
  const result = await mutate((db) => {
    const r = db.reports.find((x) => x.id === id);
    const c = r && db.codes.find((x) => x.id === r.code);
    if (!r || !c) return 404;
    if (action === "block") blockCode(db, c, me, r.reason, "codeBlocked");
    if (action === "unblock") unblockCode(db, c);
    if (action === "dismiss") db.reports.forEach((x) => x.code === c.id && x.status === "open" && (x.status = "dismissed"));
    return { ok: true };
  });
  return typeof result === "number" ? Response.json({ error: result }, { status: result }) : Response.json(result);
}
