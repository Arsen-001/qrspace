import type { NextRequest } from "next/server";
import { mutate, read } from "@/server/db";
import { adminId, bad, blockCode, forbidden, removeLot, unblockCode, userDetail } from "@/server/admin";
import { readShort } from "../../../codes/validate";

/** Человек целиком: цифры, коды, покупки, пакеты, лоты. */
export async function GET(_req: NextRequest, ctx: RouteContext<"/api/admin/users/[id]">) {
  const { id } = await ctx.params;
  if (!(await adminId())) return forbidden();
  const detail = userDetail(await read(), id);
  return detail ? Response.json(detail) : Response.json({ error: "not-found" }, { status: 404 });
}

/**
 * block — заблокировать человека: войти больше не сможет, открытые входы (сайт, приложение) перестают работать, а без входа
 * не создать код и ничего не купить; note — за что (видно только администраторам); codes — заодно заблокировать все его
 * коды (скан покажет «заблокирован») и снять его лоты. unblock — снять блокировку (и с кодов, заблокированных вместе с ним).
 * Себя и других администраторов (ADMIN_EMAILS) заблокировать нельзя — 409.
 */
export async function PATCH(req: NextRequest, ctx: RouteContext<"/api/admin/users/[id]">) {
  const { id } = await ctx.params;
  const me = await adminId();
  if (!me) return forbidden();
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const action = body.action;
  if (action !== "block" && action !== "unblock") return bad();
  if (body.codes !== undefined && typeof body.codes !== "boolean") return bad();
  if (body.note !== undefined && typeof body.note !== "string") return bad();
  const note = readShort(body.note, 300);
  const result = await mutate((db) => {
    const u = db.users.find((x) => x.id === id);
    if (!u) return 404;
    if (action === "block") {
      if (u.id === me || u.admin) return 409;
      const at = new Date().toISOString();
      u.blocked = { at, by: me, note };
      // Одноразовые коды входа в приложение — тоже недействительны.
      db.appTokens = db.appTokens.filter((t) => t.person !== u.id);
      if (body.codes === true) {
        // Хозяин всё равно не войдёт — уведомление ему не шлём.
        for (const c of db.codes) if (c.owner === u.id && !c.blocked) blockCode(db, c, me, "account", null);
        for (const l of db.listings) if (l.seller === u.id && l.status === "open") removeLot(db, l.id, me);
      }
    } else {
      delete u.blocked;
      for (const c of db.codes) if (c.owner === u.id && c.blocked?.reason === "account") unblockCode(db, c);
    }
    return userDetail(db, u.id)!;
  });
  return typeof result === "number" ? Response.json({ error: result }, { status: result }) : Response.json(result);
}
