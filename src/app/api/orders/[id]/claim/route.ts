import type { NextRequest } from "next/server";
import { kindDefaults, mutate, newId, viewOf } from "@/server/db";
import { currentPerson } from "@/server/session";
import type { CodeRecord } from "@/lib/codes";

/** Клиент создаёт код с памятью в дизайне своего заказа (оплачено пакетом — скачивание без доплаты). */
export async function POST(_req: NextRequest, ctx: RouteContext<"/api/orders/[id]/claim">) {
  const { id } = await ctx.params;
  const me = await currentPerson();
  const result = await mutate((db) => {
    const o = db.orders.find((x) => x.id === id);
    if (!o || !me || o.client !== me) return 404;
    if (!o.design) return 409;
    o.codes += 1;
    const at = new Date().toISOString();
    const code: CodeRecord = {
      ...kindDefaults("memory"),
      id: newId(),
      owner: me,
      title: `${o.brand} ${o.codes}`,
      people: [],
      requests: [],
      invite: newId(12),
      blocks: [],
      style: o.design.style,
      visits: [],
      createdAt: at,
    };
    db.codes.push(code);
    db.purchases.push({ person: me, key: `code:${code.id}`, tier: "styled", price: 0, free: false, at });
    return viewOf(code, me);
  });
  return typeof result === "number" ? Response.json({ error: result }, { status: result }) : Response.json(result);
}
