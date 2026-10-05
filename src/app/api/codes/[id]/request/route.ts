import type { NextRequest } from "next/server";
import { accessOf, mutate, viewOf } from "@/server/db";
import { currentPerson } from "@/server/session";

/** «Попросить доступ» к закрытому коду — хозяин увидит просьбу и решит. */
export async function POST(_req: NextRequest, ctx: RouteContext<"/api/codes/[id]/request">) {
  const { id } = await ctx.params;
  const me = await currentPerson();
  if (!me) return Response.json({ error: "login" }, { status: 401 });
  const result = await mutate((db) => {
    const c = db.codes.find((x) => x.id === id);
    if (!c) return 404;
    if (accessOf(c, me) === "closed" && !c.requests.some((r) => r.personId === me)) c.requests.push({ personId: me, at: new Date().toISOString() });
    return viewOf(c, me);
  });
  return typeof result === "number" ? Response.json({ error: result }, { status: result }) : Response.json(result);
}
