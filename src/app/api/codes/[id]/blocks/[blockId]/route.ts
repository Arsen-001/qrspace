import type { NextRequest } from "next/server";
import { accessOf, mutate, viewOf } from "@/server/db";
import { media } from "@/server/media";
import { currentPerson } from "@/server/session";
import { readText } from "../../../validate";

type Ctx = RouteContext<"/api/codes/[id]/blocks/[blockId]">;

/**
 * Поменять подпись (text) или удалить запись (text = null). Может хозяин кода или автор записи,
 * пока ему можно дописывать.
 */
async function change(ctx: Ctx, text: string | null) {
  const { id, blockId } = await ctx.params;
  const me = await currentPerson();
  return mutate((db) => {
    const c = db.codes.find((x) => x.id === id);
    const i = c ? c.blocks.findIndex((b) => b.id === blockId) : -1;
    if (!c || i < 0) return 404;
    const level = accessOf(c, me);
    if (level !== "owner" && !(level === "edit" && c.blocks[i].author === me)) return 403;
    if (text === null) {
      const [gone] = c.blocks.splice(i, 1);
      return { view: viewOf(c, me), media: gone.media };
    }
    if (!text && c.blocks[i].kind === "text") return 400;
    c.blocks[i].text = text;
    return { view: viewOf(c, me), media: null };
  });
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const body = (await req.json().catch(() => ({}))) as { text?: unknown };
  const r = await change(ctx, readText(body.text));
  return typeof r === "number" ? Response.json({ error: r }, { status: r }) : Response.json(r.view);
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const r = await change(ctx, null);
  if (typeof r === "number") return Response.json({ error: r }, { status: r });
  if (r.media) await media.remove(r.media);
  return Response.json(r.view);
}
