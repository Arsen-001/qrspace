import { mutate } from "@/server/db";
import { currentPerson } from "@/server/session";

/** Новый порядок «Моих кодов» после перетаскивания: только свои коды, чужие и неизвестные id отбрасываем. */
export async function PATCH(req: Request) {
  const me = await currentPerson();
  if (!me) return Response.json({ error: "login" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { ids?: unknown };
  if (!Array.isArray(body.ids) || body.ids.length > 2000 || !body.ids.every((x) => typeof x === "string")) return Response.json({ error: "bad" }, { status: 400 });
  const ids = body.ids as string[];
  const ok = await mutate((db) => {
    const user = db.users.find((u) => u.id === me);
    if (!user) return false;
    const mine = new Set(db.codes.filter((c) => c.owner === me && c.kind !== "item").map((c) => c.id));
    user.codeOrder = [...new Set(ids)].filter((id) => mine.has(id));
    return true;
  });
  if (!ok) return Response.json({ error: "not found" }, { status: 404 });
  return Response.json({ ok: true });
}
