import { mutate, viewOf } from "@/server/db";
import { extendSpace } from "@/server/grants";
import { currentPerson } from "@/server/session";
import { FREE_STORAGE, STORAGE_PLANS, storageOf } from "@/lib/codes";

/**
 * Сменить место под кодом (демо — деньги не списываются). Только хозяин. Пакет — на месяц: тот же ещё раз — продлить
 * на месяц, другой — с сегодняшнего дня. «free» — обратно 1 МБ. Меньше, чем уже занято, — нельзя (409 «storage»).
 */
export async function POST(req: Request, ctx: RouteContext<"/api/codes/[id]/storage">) {
  const { id } = await ctx.params;
  const me = await currentPerson();
  if (!me) return Response.json({ error: "login" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { plan?: unknown };
  const plan = body.plan === "free" ? null : STORAGE_PLANS.find((p) => p.id === body.plan);
  if (plan === undefined) return Response.json({ error: "bad" }, { status: 400 });
  const result = await mutate((db) => {
    const c = db.codes.find((x) => x.id === id);
    if (!c) return 404;
    if (c.owner !== me) return 403;
    const now = Date.now();
    const st = storageOf(c, now);
    if (st.used > (plan?.bytes ?? FREE_STORAGE)) return 409;
    if (!plan) {
      delete c.storage;
      delete c.storageUntil;
    } else {
      const err = extendSpace(db, me, c.id, plan.id, { price: plan.price });
      if (err) return err;
    }
    return viewOf(c, me);
  });
  if (result === 409) return Response.json({ error: "storage" }, { status: 409 });
  if (typeof result === "number") return Response.json({ error: result }, { status: result });
  return Response.json(result);
}
