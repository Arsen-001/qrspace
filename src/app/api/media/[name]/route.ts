import { createReadStream, promises as fs } from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import type { NextRequest } from "next/server";
import { accessOf, findCode, MEDIA_DIR } from "@/server/db";
import { currentPerson } from "@/server/session";

const MIME: Record<string, string> = { jpg: "image/jpeg", png: "image/png", webp: "image/webp", mp4: "video/mp4", mov: "video/quicktime", webm: "video/webm" };

/** Фото и видео отдаём только тем, кому открыт код. Видео — по кусочкам (Range), иначе iPhone его не играет. */
export async function GET(req: NextRequest, ctx: RouteContext<"/api/media/[name]">) {
  const { name } = await ctx.params;
  const m = /^([A-Za-z0-9]+)_[A-Za-z0-9]+\.([a-z0-9]+)$/.exec(name);
  const type = m && MIME[m[2]];
  if (!m || !type) return new Response(null, { status: 404 });
  const code = await findCode(m[1]);
  if (!code || accessOf(code, await currentPerson()) === "closed" || !code.blocks.some((b) => b.media === name)) {
    return new Response(null, { status: 404 });
  }
  const file = path.join(MEDIA_DIR, name);
  const size = (await fs.stat(file).catch(() => null))?.size;
  if (size === undefined) return new Response(null, { status: 404 });

  // nosniff — браузер не попробует «угадать», что внутри файла (загруженное — только как картинка или видео).
  const headers = { "content-type": type, "accept-ranges": "bytes", "cache-control": "private, max-age=3600", "x-content-type-options": "nosniff" };
  const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.get("range") ?? "");
  if (range && (range[1] || range[2])) {
    const start = range[1] ? Number(range[1]) : Math.max(0, size - Number(range[2]));
    const end = range[1] && range[2] ? Math.min(Number(range[2]), size - 1) : size - 1;
    if (start > end || start >= size) return new Response(null, { status: 416, headers: { "content-range": `bytes */${size}` } });
    const body = Readable.toWeb(createReadStream(file, { start, end })) as ReadableStream;
    return new Response(body, { status: 206, headers: { ...headers, "content-range": `bytes ${start}-${end}/${size}`, "content-length": String(end - start + 1) } });
  }
  const body = Readable.toWeb(createReadStream(file)) as ReadableStream;
  return new Response(body, { headers: { ...headers, "content-length": String(size) } });
}
