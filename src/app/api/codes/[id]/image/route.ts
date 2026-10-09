import { createHash } from "node:crypto";
import type { NextRequest } from "next/server";
import { accessOf, findCode, publicBase, purchasesOf } from "@/server/db";
import { media } from "@/server/media";
import { currentPerson } from "@/server/session";
import { linkOf } from "@/lib/codes";
import { buildDrawing, toSvg } from "@/lib/qr/render";
import { DEFAULT_STYLE, fromSaved, toQrStyle } from "@/lib/qr/style";

/**
 * Рисунок кода для приложений (iOS, Android): тот же, что на сайте, — SVG или PNG (?format=png&size=512).
 * Картинки оформления (логотип, фото) — прямо внутри файла, чтобы рисунок открывался без сети и без входа.
 * Текстуру фона рисует браузер (canvas) — на сервере её нет, вместо неё ровный цвет фона. Видят те, кому открыт код.
 * Неоплаченный код — только маленькая картинка для списка (до 256 px): чистый файл для печати — после оплаты.
 */
export async function GET(req: NextRequest, ctx: RouteContext<"/api/codes/[id]/image">) {
  const { id } = await ctx.params;
  const me = await currentPerson();
  const code = await findCode(id);
  if (!code) return Response.json({ error: "not-found" }, { status: 404 });
  if (accessOf(code, me) === "closed") return Response.json({ error: "closed" }, { status: 403 });

  const style = code.style ? fromSaved({ ...code.style, texture: null }) : DEFAULT_STYLE;
  // Оплачен: код из генератора (создаётся только по оплате), купленный в маркете, или скачан со страницы кода (code:<id>).
  const paid = (code.compact && code.kind === "link") || !!code.edition || (await purchasesOf(code.owner)).some((p) => p.key === `code:${code.id}` || p.code === code.id);
  const size = Math.min(paid ? 1024 : 256, Math.max(64, Number(req.nextUrl.searchParams.get("size")) || 512));
  let svg = toSvg(buildDrawing(linkOf(publicBase(req), code), toQrStyle(style)), size);

  // /api/asset/<отпечаток> → data:… (картинки оформления неизменны: по отпечатку содержимого).
  const assets = [...new Set(svg.match(/\/api\/asset\/[0-9a-f]{32}\.(?:png|jpg|webp)/g) ?? [])];
  for (const path of assets) {
    const name = path.slice("/api/asset/".length);
    const f = await media.open(`asset_${name}`);
    if (!f) continue;
    const bytes = Buffer.from(await new Response(f.body).arrayBuffer());
    const type = name.endsWith(".png") ? "image/png" : name.endsWith(".webp") ? "image/webp" : "image/jpeg";
    svg = svg.split(`"${path}"`).join(`"data:${type};base64,${bytes.toString("base64")}"`);
  }

  // Метка версии: поменяли вид кода — другая метка, приложение не покажет старую картинку (If-None-Match → 304).
  const format = req.nextUrl.searchParams.get("format") === "png" ? "png" : "svg";
  const etag = `"${createHash("sha1").update(svg).update(format).digest("base64url")}"`;
  const headers = { "cache-control": "private, no-cache", etag, "x-content-type-options": "nosniff" };
  if (req.headers.get("if-none-match") === etag) return new Response(null, { status: 304, headers });
  if (req.nextUrl.searchParams.get("format") === "png") {
    // sharp ставится вместе с Next (картинки сайта); нет его — отдаём SVG, приложение это видит по content-type.
    const sharp = (await import("sharp").catch(() => null))?.default;
    if (sharp) {
      const png = await sharp(Buffer.from(svg), { density: 144 }).resize(size, size, { fit: "contain", background: "#ffffff00" }).png().toBuffer();
      return new Response(new Uint8Array(png), { headers: { ...headers, "content-type": "image/png" } });
    }
  }
  return new Response(svg, { headers: { ...headers, "content-type": "image/svg+xml; charset=utf-8" } });
}
