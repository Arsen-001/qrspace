import { mutate, packsOf } from "@/server/db";
import { grantPack } from "@/server/grants";
import { currentPerson } from "@/server/session";
import { CODE_PACKS, packsLeft } from "@/lib/packs";

/** Мои пакеты кодов: сколько кодов осталось. Без входа — пусто. */
export async function GET() {
  const me = await currentPerson();
  if (!me) return Response.json({ left: 0, packs: [] });
  const packs = await packsOf(me);
  return Response.json({ left: packsLeft(packs), packs });
}

/** Купить пакет (демо — деньги не списываются). */
export async function POST(req: Request) {
  const me = await currentPerson();
  if (!me) return Response.json({ error: "login" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { plan?: unknown };
  const plan = CODE_PACKS.find((p) => p.id === body.plan);
  if (!plan) return Response.json({ error: "bad" }, { status: 400 });
  const packs = await mutate((db) => {
    grantPack(db, me, plan.id, { price: plan.price });
    return db.packs.filter((p) => p.person === me);
  });
  return Response.json({ left: packsLeft(packs), packs });
}
