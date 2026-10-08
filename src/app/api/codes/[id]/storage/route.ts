import { mutate, viewOf } from "@/server/db";
import { currentPerson } from "@/server/session";
import { STORAGE_PLANS } from "@/lib/codes";

/** Купить место под кодом (демо — деньги не списываются): пакет больше нынешнего — место растёт. Только хозяин. */
export async function POST(req: Request, ctx: RouteContext<"/api/codes/[id]/storage">) {
  const { id } = await ctx.params;
  const me = await currentPerson();
  if (!me) return Response.json({ error: "login" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { plan?: unknown };
  const plan = STORAGE_PLANS.find((p) => p.id === body.plan);
  if (!plan) return Response.json({ error: "bad" }, { status: 400 });
  const result = await mutate((db) => {
    const c = db.codes.find((x) => x.id === id);
    if (!c) return 404;
    if (c.owner !== me) return 403;
    c.storage = Math.max(c.storage ?? 0, plan.bytes);
    return viewOf(c, me);
  });
  if (typeof result === "number") return Response.json({ error: result }, { status: result });
  return Response.json(result);
}
