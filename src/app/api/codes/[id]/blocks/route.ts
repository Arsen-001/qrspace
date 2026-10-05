import { promises as fs } from "node:fs";
import path from "node:path";
import type { NextRequest } from "next/server";
import { accessOf, MEDIA_DIR, mutate, newId, viewOf } from "@/server/db";
import { currentPerson } from "@/server/session";
import { MAX_VIDEO_MB, type Block } from "@/lib/codes";
import { readText } from "../../validate";

const TYPES: Record<string, { kind: "photo" | "video"; ext: string }> = {
  "image/jpeg": { kind: "photo", ext: "jpg" },
  "image/png": { kind: "photo", ext: "png" },
  "image/webp": { kind: "photo", ext: "webp" },
  "video/mp4": { kind: "video", ext: "mp4" },
  "video/quicktime": { kind: "video", ext: "mov" },
  "video/webm": { kind: "video", ext: "webm" },
};

/** Дописать в память: текст, фото или видео (с подписью). Может хозяин и те, кому дали «дописывать». */
export async function POST(req: NextRequest, ctx: RouteContext<"/api/codes/[id]/blocks">) {
  const { id } = await ctx.params;
  const me = await currentPerson();
  const form = await req.formData().catch(() => null);
  if (!me || !form) return Response.json({ error: "bad" }, { status: 400 });
  const text = readText(form.get("text"));
  const file = form.get("file");
  let media: { name: string; kind: "photo" | "video" } | null = null;
  if (file instanceof File && file.size > 0) {
    const t = TYPES[file.type];
    if (!t || file.size > MAX_VIDEO_MB * 1024 * 1024) return Response.json({ error: "file" }, { status: 400 });
    media = { name: `${id}_${newId(12)}.${t.ext}`, kind: t.kind };
  }
  if (!text && !media) return Response.json({ error: "empty" }, { status: 400 });

  const result = await mutate(async (db) => {
    const c = db.codes.find((x) => x.id === id);
    if (!c) return 404;
    const level = accessOf(c, me);
    if (level !== "owner" && level !== "edit") return 403;
    if (media && file instanceof File) {
      await fs.mkdir(MEDIA_DIR, { recursive: true });
      await fs.writeFile(path.join(MEDIA_DIR, media.name), Buffer.from(await file.arrayBuffer()));
    }
    const block: Block = { id: newId(), kind: media?.kind ?? "text", text, media: media?.name ?? null, author: me, at: new Date().toISOString() };
    c.blocks.push(block);
    return viewOf(c, me);
  });
  if (typeof result === "number") return Response.json({ error: result }, { status: result });
  return Response.json(result);
}
