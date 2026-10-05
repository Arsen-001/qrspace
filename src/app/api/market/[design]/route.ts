import type { NextRequest } from "next/server";
import { kindDefaults, mutate, newId, viewOf } from "@/server/db";
import { currentPerson } from "@/server/session";
import type { CodeRecord } from "@/lib/codes";
import { designById } from "@/lib/market";

/**
 * Купить дизайн (оплата — демо). Покупатель получает код с памятью в этом оформлении;
 * у тиражного — следующий номер. Тираж закончился — 409.
 */
export async function POST(_req: NextRequest, ctx: RouteContext<"/api/market/[design]">) {
  const { design } = await ctx.params;
  const me = await currentPerson();
  if (!me) return Response.json({ error: "login" }, { status: 401 });
  const d = designById(design);
  if (!d) return Response.json({ error: "not-found" }, { status: 404 });
  const result = await mutate((db) => {
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
    return viewOf(code, me);
  });
  return typeof result === "number" ? Response.json({ error: result }, { status: result }) : Response.json(result);
}
