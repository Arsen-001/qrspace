import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { accessOf, findCode } from "@/server/db";
import { currentPerson } from "@/server/session";
import { MAX_VIDEO_MB, VIDEO_TYPES, storageOf, uploadedName } from "@/lib/codes";

// Видео больше 4,5 МБ сервер на Vercel не принимает — браузер кладёт его прямо в хранилище, а мы только выдаём
// разрешение: на одно имя этого кода, только видео, без перезаписи и **ровно на размер этого файла, если он влезает в
// свободное место под кодом** (владелец 09.10.2026: «не было так, чтобы показывали 5 МБ, разрешали, а он сразу поменял и
// загрузил 1 ГБ»). Больше — хранилище само не примет; после загрузки /blocks ещё раз меряет настоящий файл. Без хранилища
// (этот компьютер) — direct: false, видео идёт обычной формой (и там сервер меряет файл сам).
const direct = () => !!process.env.BLOB_READ_WRITE_TOKEN;

export async function GET() {
  return Response.json({ direct: direct() });
}

export async function POST(req: Request, ctx: RouteContext<"/api/codes/[id]/upload">) {
  if (!direct()) return Response.json({ error: "direct" }, { status: 404 });
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => null)) as HandleUploadBody | null;
  if (!body) return Response.json({ error: "bad" }, { status: 400 });
  try {
    return Response.json(
      await handleUpload({
        body,
        request: req,
        onBeforeGenerateToken: async (pathname, clientPayload) => {
          const me = await currentPerson();
          const code = await findCode(id);
          const level = code && me ? accessOf(code, me) : "closed";
          if (level !== "owner" && level !== "edit") throw new Error("403");
          if (!uploadedName(id, pathname)) throw new Error("name");
          const size = Number((JSON.parse(clientPayload ?? "{}") as { size?: unknown }).size);
          const { used, quota } = storageOf(code!);
          if (!Number.isInteger(size) || size <= 0 || size > MAX_VIDEO_MB * 1024 * 1024 || used + size > quota) throw new Error("storage");
          return { allowedContentTypes: Object.keys(VIDEO_TYPES), maximumSizeInBytes: size, addRandomSuffix: false, allowOverwrite: false };
        },
      }),
    );
  } catch {
    return Response.json({ error: "denied" }, { status: 403 });
  }
}
