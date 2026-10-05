import type { NextRequest } from "next/server";
import { mutate, newSecret, notify, viewOf } from "@/server/db";
import { currentPerson } from "@/server/session";

/**
 * Зарегистрировать вещь на себя секретом из-под стираемого слоя. Свободную — сразу; чужую — только если прежний
 * владелец разрешил передачу (дал новый секрет). После регистрации секрет меняется: старая бирка больше не сработает.
 */
export async function POST(req: NextRequest, ctx: RouteContext<"/api/codes/[id]/claim">) {
  const { id } = await ctx.params;
  const me = await currentPerson();
  if (!me) return Response.json({ error: "login" }, { status: 401 });
  const { secret } = (await req.json().catch(() => ({}))) as { secret?: unknown };
  const s = typeof secret === "string" ? secret.trim().toUpperCase().replace(/\s|-/g, "") : "";
  const result = await mutate((db) => {
    const c = db.codes.find((x) => x.id === id);
    const a = c?.auth;
    if (!c || !a) return 404;
    if (a.holder === me) return viewOf(c, me);
    if (a.holder && !a.transferable) return 409;
    if (s !== a.secret) return 403;
    const prev = a.holder;
    a.holder = me;
    a.claimedAt = new Date().toISOString();
    a.transferable = false;
    a.secret = newSecret();
    notify(db, prev, me, "itemPassed", { title: c.title }, `/c/${c.id}`);
    return viewOf(c, me);
  });
  return typeof result === "number" ? Response.json({ error: result }, { status: result }) : Response.json(result);
}

/** Владелец вещи продаёт её: получает новый секрет, чтобы передать покупателю. */
export async function DELETE(_req: NextRequest, ctx: RouteContext<"/api/codes/[id]/claim">) {
  const { id } = await ctx.params;
  const me = await currentPerson();
  const result = await mutate((db) => {
    const c = db.codes.find((x) => x.id === id);
    if (!c?.auth || !me || c.auth.holder !== me) return 403;
    c.auth.secret = newSecret();
    c.auth.transferable = true;
    return { secret: c.auth.secret, view: viewOf(c, me) };
  });
  return typeof result === "number" ? Response.json({ error: result }, { status: result }) : Response.json(result);
}
