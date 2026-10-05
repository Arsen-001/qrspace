import type { NextRequest } from "next/server";
import { accessOf, mutate, viewOf } from "@/server/db";
import { currentPerson } from "@/server/session";
import { nextDue } from "@/lib/codes";

type Ctx = RouteContext<"/api/codes/[id]/tasks/[taskId]">;

/**
 * «Сделано»: пишем, кто и когда; повторяющееся — переносим на следующий срок, разовое — убираем из списка.
 * Удалить — DELETE. И то и другое — хозяин и те, кому можно дописывать.
 */
async function change(ctx: Ctx, remove: boolean) {
  const { id, taskId } = await ctx.params;
  const me = await currentPerson();
  return mutate((db) => {
    const c = db.codes.find((x) => x.id === id);
    const task = c?.tasks.find((t) => t.id === taskId);
    if (!c || !task) return 404;
    const level = accessOf(c, me);
    if (level !== "owner" && level !== "edit") return 403;
    const next = remove ? null : nextDue(task.every);
    if (next) {
      task.done = [...task.done, { by: me!, at: new Date().toISOString() }].slice(-20);
      task.due = next;
    } else {
      c.tasks = c.tasks.filter((t) => t !== task);
    }
    return viewOf(c, me);
  });
}

export async function PATCH(_req: NextRequest, ctx: Ctx) {
  const r = await change(ctx, false);
  return typeof r === "number" ? Response.json({ error: r }, { status: r }) : Response.json(r);
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const r = await change(ctx, true);
  return typeof r === "number" ? Response.json({ error: r }, { status: r }) : Response.json(r);
}
