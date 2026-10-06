import type { NextRequest } from "next/server";
import { isAdminId, mutate, notify } from "@/server/db";
import { currentPerson } from "@/server/session";

/**
 * Решение по жалобе: block — заблокировать код (скан покажет «заблокирован», ссылка никуда не ведёт; хозяину —
 * уведомление), dismiss — отклонить, unblock — разблокировать. Остальные открытые жалобы на тот же код — тем же решением.
 */
export async function PATCH(req: NextRequest, ctx: RouteContext<"/api/admin/reports/[id]">) {
  const { id } = await ctx.params;
  const me = await currentPerson();
  if (!(await isAdminId(me))) return Response.json({ error: "admin" }, { status: 403 });
  const { action } = (await req.json().catch(() => ({}))) as { action?: unknown };
  if (action !== "block" && action !== "dismiss" && action !== "unblock") return Response.json({ error: "bad" }, { status: 400 });
  const result = await mutate((db) => {
    const r = db.reports.find((x) => x.id === id);
    const c = r && db.codes.find((x) => x.id === r.code);
    if (!r || !c) return 404;
    if (action === "block") {
      c.blocked = { at: new Date().toISOString(), reason: r.reason };
      notify(db, c.owner, me, "codeBlocked", { title: c.title, reason: r.reason }, `/codes/${c.id}`);
    }
    if (action === "unblock") delete c.blocked;
    const status = action === "block" ? "blocked" : action === "dismiss" ? "dismissed" : "dismissed";
    db.reports.forEach((x) => x.code === c.id && (x.status === "open" || action === "unblock") && (x.status = status));
    return { ok: true };
  });
  return typeof result === "number" ? Response.json({ error: result }, { status: result }) : Response.json(result);
}
