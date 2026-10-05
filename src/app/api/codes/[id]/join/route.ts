import type { NextRequest } from "next/server";
import { accessOf, mutate, viewOf } from "@/server/db";
import { currentPerson } from "@/server/session";

/** Открыли по ссылке-приглашению: человек попадает в список с правом «смотреть». */
export async function POST(req: NextRequest, ctx: RouteContext<"/api/codes/[id]/join">) {
  const { id } = await ctx.params;
  const me = await currentPerson();
  if (!me) return Response.json({ error: "login" }, { status: 401 });
  const { invite } = (await req.json().catch(() => ({}))) as { invite?: unknown };
  const result = await mutate((db) => {
    const c = db.codes.find((x) => x.id === id);
    if (!c) return 404;
    if (typeof invite !== "string" || invite !== c.invite) return 403;
    if (accessOf(c, me) === "closed") {
      c.people = c.people.filter((g) => g.personId !== me);
      c.people.push({ personId: me, role: "view", until: null });
      c.requests = c.requests.filter((r) => r.personId !== me);
      if (c.visibility === "me") c.visibility = "people";
    }
    return viewOf(c, me);
  });
  return typeof result === "number" ? Response.json({ error: result }, { status: result }) : Response.json(result);
}
