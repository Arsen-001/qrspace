import type { NextRequest } from "next/server";
import { accessOf, mutate, newId, viewOf } from "@/server/db";
import { currentPerson } from "@/server/session";
import { REPEATS, type Repeat } from "@/lib/codes";
import { readShort } from "../../validate";

/** Добавить напоминание — хозяин и те, кому можно дописывать. */
export async function POST(req: NextRequest, ctx: RouteContext<"/api/codes/[id]/tasks">) {
  const { id } = await ctx.params;
  const me = await currentPerson();
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const text = readShort(body.text, 120);
  const due = typeof body.due === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.due) ? body.due : null;
  const every = (REPEATS as readonly unknown[]).includes(body.every) ? (body.every as Repeat) : null;
  if (!text || !due || !every) return Response.json({ error: "bad" }, { status: 400 });
  const result = await mutate((db) => {
    const c = db.codes.find((x) => x.id === id);
    if (!c) return 404;
    const level = accessOf(c, me);
    if (level !== "owner" && level !== "edit") return 403;
    c.tasks.push({ id: newId(), text, due, every, done: [] });
    return viewOf(c, me);
  });
  return typeof result === "number" ? Response.json({ error: result }, { status: result }) : Response.json(result);
}
