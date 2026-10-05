import type { NextRequest } from "next/server";
import { mutate, newId } from "@/server/db";
import { currentPerson } from "@/server/session";
import { isDesigner } from "@/lib/people";
import { readText } from "../../../codes/validate";

/** Переписка по заказу: клиент и дизайнер. */
export async function POST(req: NextRequest, ctx: RouteContext<"/api/orders/[id]/messages">) {
  const { id } = await ctx.params;
  const me = await currentPerson();
  const { text } = (await req.json().catch(() => ({}))) as { text?: unknown };
  const t = readText(text).slice(0, 2000);
  if (!t) return Response.json({ error: "empty" }, { status: 400 });
  const result = await mutate((db) => {
    const o = db.orders.find((x) => x.id === id);
    if (!o || !me || !(isDesigner(me) || o.client === me)) return 404;
    o.thread.push({ id: newId(), from: me, text: t, at: new Date().toISOString() });
    // Дизайнер ответил на новый заказ — значит, взял его в работу.
    if (isDesigner(me) && o.status === "new") o.status = "work";
    return o;
  });
  return typeof result === "number" ? Response.json({ error: result }, { status: result }) : Response.json(result);
}
