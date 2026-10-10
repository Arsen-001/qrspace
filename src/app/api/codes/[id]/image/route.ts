import { createHash } from "node:crypto";
import type { NextRequest } from "next/server";
import { codeSvg, svgToPng } from "@/server/code-image";
import { accessOf, findCode, publicBase, purchasesOf } from "@/server/db";
import { currentPerson } from "@/server/session";

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

  // Оплачен: при оплате вид кода закрепляется (генератор — только по оплате, страница кода — code:<id>), или куплен в маркете.
  const paid = !!code.styleLocked || !!code.edition || (await purchasesOf(code.owner)).some((p) => p.key === `code:${code.id}` || p.code === code.id);
  const size = Math.min(paid ? 1024 : 256, Math.max(64, Number(req.nextUrl.searchParams.get("size")) || 512));
  const svg = await codeSvg(code, publicBase(req), size);

  // Метка версии: поменяли вид кода — другая метка, приложение не покажет старую картинку (If-None-Match → 304).
  const format = req.nextUrl.searchParams.get("format") === "png" ? "png" : "svg";
  const etag = `"${createHash("sha1").update(svg).update(format).digest("base64url")}"`;
  const headers = { "cache-control": "private, no-cache", etag, "x-content-type-options": "nosniff" };
  if (req.headers.get("if-none-match") === etag) return new Response(null, { status: 304, headers });
  if (req.nextUrl.searchParams.get("format") === "png") {
    // Нет sharp — отдаём SVG, приложение это видит по content-type.
    const png = await svgToPng(svg, size);
    if (png) return new Response(png, { headers: { ...headers, "content-type": "image/png" } });
  }
  return new Response(svg, { headers: { ...headers, "content-type": "image/svg+xml; charset=utf-8" } });
}
