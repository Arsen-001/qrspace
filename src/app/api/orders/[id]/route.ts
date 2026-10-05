import type { NextRequest } from "next/server";
import { allOrders, mutate, isDesignerId } from "@/server/db";
import { currentPerson } from "@/server/session";
import { STATUSES, type OrderStatus } from "@/lib/orders";
import { readStyle, readText } from "../../codes/validate";

export async function GET(_req: NextRequest, ctx: RouteContext<"/api/orders/[id]">) {
  const { id } = await ctx.params;
  const me = await currentPerson();
  const o = (await allOrders()).find((x) => x.id === id);
  if (!o || !me || !((await isDesignerId(me)) || o.client === me)) return Response.json({ error: "not-found" }, { status: 404 });
  return Response.json(o);
}

/** Дизайнер: статус и готовый дизайн (тогда статус — «на проверке»). Клиент: «Всё нравится» → готово. */
export async function PATCH(req: NextRequest, ctx: RouteContext<"/api/orders/[id]">) {
  const { id } = await ctx.params;
  const me = await currentPerson();
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const designer = await isDesignerId(me);
  const result = await mutate((db) => {
    const o = db.orders.find((x) => x.id === id);
    if (!o || !me) return 404;
    if (designer) {
      if ((STATUSES as readonly unknown[]).includes(b.status)) o.status = b.status as OrderStatus;
      if ("design" in b) {
        const style = readStyle((b.design as Record<string, unknown> | null)?.style);
        if (!style) return 400;
        o.design = { style, note: readText((b.design as Record<string, unknown>).note).slice(0, 500), at: new Date().toISOString() };
        o.status = "review";
      }
      return o;
    }
    if (o.client !== me) return 403;
    if (b.accept === true && o.design) o.status = "done";
    return o;
  });
  return typeof result === "number" ? Response.json({ error: result }, { status: result }) : Response.json(result);
}
