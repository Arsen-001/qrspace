import type { NextRequest } from "next/server";
import { isDesignerId, mutate, notify } from "@/server/db";
import { currentPerson } from "@/server/session";

const NEXT = ["paid", "printing", "shipped"] as const;

/** Сотрудник (дизайнер) меняет статус заказа товара: оплачен → печатаем → отправлен; покупателю — уведомление. */
export async function PATCH(req: NextRequest, ctx: RouteContext<"/api/shop/[id]">) {
  const { id } = await ctx.params;
  const me = await currentPerson();
  if (!(await isDesignerId(me))) return Response.json({ error: "staff" }, { status: 403 });
  const { status } = (await req.json().catch(() => ({}))) as { status?: unknown };
  if (!(NEXT as readonly unknown[]).includes(status)) return Response.json({ error: "bad" }, { status: 400 });
  const result = await mutate((db) => {
    const o = db.shop.find((x) => x.id === id);
    if (!o) return 404;
    o.status = status as (typeof NEXT)[number];
    notify(db, o.person, me, "shopStatus", { status: o.status, product: o.product }, "/shop");
    return o;
  });
  return typeof result === "number" ? Response.json({ error: result }, { status: result }) : Response.json(result);
}
