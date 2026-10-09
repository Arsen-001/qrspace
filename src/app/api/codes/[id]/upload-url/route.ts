import { randomBytes } from "node:crypto";
import { generateClientTokenFromReadWriteToken } from "@vercel/blob/client";
import { accessOf, findCode } from "@/server/db";
import { currentPerson } from "@/server/session";
import { MAX_VIDEO_MB, VIDEO_TYPES, storageOf } from "@/lib/codes";

const ABC = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/**
 * Большое видео из приложения (iOS, Android) — прямо в хранилище, без JS-библиотеки Vercel: даём адрес и заголовки для
 * одного PUT. Разрешение — на одно имя этого кода, этот тип и **ровно этот размер, если он влезает в свободное место**
 * (владелец 09.10.2026: «не было так, чтобы показывали 5 МБ, а загрузил 1 ГБ»); больше хранилище не примет, а после
 * загрузки /blocks (uploaded=имя) ещё раз меряет настоящий файл. Без хранилища (этот компьютер) — direct: false,
 * видео — обычной формой в /blocks.
 */
export async function POST(req: Request, ctx: RouteContext<"/api/codes/[id]/upload-url">) {
  const { id } = await ctx.params;
  const me = await currentPerson();
  if (!me) return Response.json({ error: "login" }, { status: 401 });
  const code = await findCode(id);
  const level = code ? accessOf(code, me) : "closed";
  if (!code) return Response.json({ error: "not-found" }, { status: 404 });
  if (level !== "owner" && level !== "edit") return Response.json({ error: "forbidden" }, { status: 403 });
  const body = (await req.json().catch(() => ({}))) as { size?: unknown; type?: unknown };
  const size = Number(body.size);
  const type = typeof body.type === "string" ? body.type : "";
  const ext = VIDEO_TYPES[type];
  if (!ext || !Number.isInteger(size) || size <= 0 || size > MAX_VIDEO_MB * 1024 * 1024) return Response.json({ error: "file" }, { status: 400 });
  const { used, quota } = storageOf(code);
  if (used + size > quota) return Response.json({ error: "storage", used, quota }, { status: 413 });
  if (!process.env.BLOB_READ_WRITE_TOKEN) return Response.json({ direct: false });

  const name = `${id}_${Array.from(randomBytes(12), (b) => ABC[b % ABC.length]).join("")}.${ext}`;
  const token = await generateClientTokenFromReadWriteToken({
    pathname: name,
    allowedContentTypes: [type],
    maximumSizeInBytes: size,
    addRandomSuffix: false,
    allowOverwrite: false,
    validUntil: Date.now() + 60 * 60_000,
  });
  const api = (process.env.VERCEL_BLOB_API_URL || "https://vercel.com/api/blob").replace(/\/$/, "");
  return Response.json({
    direct: true,
    name,
    url: `${api}/?pathname=${encodeURIComponent(name)}`,
    method: "PUT",
    headers: {
      authorization: `Bearer ${token}`,
      "x-api-version": "12",
      "x-vercel-blob-access": "private",
      "x-content-type": type,
      "x-add-random-suffix": "0",
      "x-allow-overwrite": "0",
      "x-content-length": String(size),
    },
  });
}
