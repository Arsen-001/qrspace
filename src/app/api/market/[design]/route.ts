import type { NextRequest } from "next/server";
import { kindDefaults, mutate, newId, viewOf } from "@/server/db";
import { currentPerson } from "@/server/session";
import type { CodeRecord } from "@/lib/codes";
import { DESIGNS } from "@/lib/market";

/**
 * Купить дизайн (оплата — демо). Покупатель получает код с памятью в этом оформлении;
 * у тиражного — следующий номер. Тираж закончился — 409.
 */
export async function POST(_req: NextRequest, ctx: RouteContext<"/api/market/[design]">) {
  const { design } = await ctx.params;
  const me = await currentPerson();
  if (!me) return Response.json({ error: "login" }, { status: 401 });
  const result = await mutate((db) => {
    const d = db.designs.find((x) => x.id === design) ?? DESIGNS.find((x) => x.id === design);
    if (!d) return 404;
    const sold = db.sales[d.id] ?? 0;
    if (d.edition !== null && sold >= d.edition) return 409;
    db.sales[d.id] = sold + 1;
    const code: CodeRecord = {
      ...kindDefaults("memory"),
      id: newId(),
      owner: me,
      title: d.name.ru,
      people: [],
      requests: [],
      invite: newId(12),
      blocks: [],
      style: d.style,
      visits: [],
      createdAt: new Date().toISOString(),
      edition: { design: d.id, no: sold + 1, of: d.edition },
    };
    db.codes.push(code);
    // Купленный дизайн уже оплачен — скачивать его код можно без доплаты.
    db.purchases.push({ person: me, key: `code:${code.id}`, tier: "styled", price: d.price, free: false, at: code.createdAt });
    return viewOf(code, me);
  });
  return typeof result === "number" ? Response.json({ error: result }, { status: result }) : Response.json(result);
}

/** Снять с продажи — только дизайнер, который выложил. Купленные коды у людей остаются. */
export async function DELETE(_req: NextRequest, ctx: RouteContext<"/api/market/[design]">) {
  const { design } = await ctx.params;
  const me = await currentPerson();
  const ok = await mutate((db) => {
    const i = db.designs.findIndex((d) => d.id === design && d.by === me);
    if (i < 0) return false;
    db.designs.splice(i, 1);
    return true;
  });
  return ok ? Response.json({ ok: true }) : Response.json({ error: "forbidden" }, { status: 403 });
}
