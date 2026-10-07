import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { accessOf, findCode } from "@/server/db";
import { currentPerson } from "@/server/session";
import { MAX_VIDEO_MB, VIDEO_TYPES, uploadedName } from "@/lib/codes";

// Видео больше 4,5 МБ сервер на Vercel не принимает — браузер кладёт его прямо в хранилище, а мы только выдаём
// разрешение: на одно имя этого кода, только видео, не больше MAX_VIDEO_MB, без перезаписи. Без хранилища
// (этот компьютер) — direct: false, видео идёт обычной формой.
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
        onBeforeGenerateToken: async (pathname) => {
          const me = await currentPerson();
          const code = await findCode(id);
          const level = code && me ? accessOf(code, me) : "closed";
          if (level !== "owner" && level !== "edit") throw new Error("403");
          if (!uploadedName(id, pathname)) throw new Error("name");
          return { allowedContentTypes: Object.keys(VIDEO_TYPES), maximumSizeInBytes: MAX_VIDEO_MB * 1024 * 1024, addRandomSuffix: false, allowOverwrite: false };
        },
      }),
    );
  } catch {
    return Response.json({ error: "denied" }, { status: 403 });
  }
}
