import { buildDrawing, toSvg } from "@/lib/qr/render";
import { sanitizeStyle } from "@/lib/qr/sanitize";
import { DEFAULT_STYLE, fromSaved, toQrStyle } from "@/lib/qr/style";

/**
 * Предпросмотр рисунка для приложений: оформление (как сохраняет сайт) → SVG или PNG ({ format: "png", size }).
 * В коде — образец нашей короткой ссылки той же длины, что и настоящая (как в генераторе сайта). Ничего не сохраняет.
 * Текстуру фона рисует браузер — здесь вместо неё ровный цвет фона.
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { style?: unknown; format?: unknown; size?: unknown } | null;
  if (!body || JSON.stringify(body).length > 1_500_000) return Response.json({ error: "bad" }, { status: 400 });
  const saved = body.style === undefined ? null : sanitizeStyle(body.style);
  if (body.style !== undefined && !saved) return Response.json({ error: "style" }, { status: 400 });
  const style = saved ? fromSaved({ ...saved, texture: null }) : DEFAULT_STYLE;
  const size = Math.min(1024, Math.max(64, Number(body.size) || 512));
  const base = (process.env.APP_URL || new URL(req.url).origin).replace(/\/$/, "");
  let svg: string;
  try {
    svg = toSvg(buildDrawing(`${base.toUpperCase()}/K/XXXXXX`, toQrStyle(style)), size);
  } catch {
    return Response.json({ error: "style" }, { status: 400 });
  }
  const headers = { "cache-control": "no-store", "x-content-type-options": "nosniff" };
  if (body.format === "png") {
    const sharp = (await import("sharp").catch(() => null))?.default;
    if (sharp) {
      const png = await sharp(Buffer.from(svg), { density: 144 }).resize(size, size, { fit: "contain", background: "#ffffff00" }).png().toBuffer();
      return new Response(new Uint8Array(png), { headers: { ...headers, "content-type": "image/png" } });
    }
  }
  return new Response(svg, { headers: { ...headers, "content-type": "image/svg+xml; charset=utf-8" } });
}
