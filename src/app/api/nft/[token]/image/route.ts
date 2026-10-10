import type { NextRequest } from "next/server";
import { codeSvg, svgToPng } from "@/server/code-image";
import { publicBase } from "@/server/db";
import { codeOfToken } from "@/server/nft-token";

/** Картинка токена — сам коллекционный код (PNG 1024). Рисунок кода не тайна: он напечатан; что под ним — по «кто видит». */
export async function GET(req: NextRequest, ctx: RouteContext<"/api/nft/[token]/image">) {
  const { token } = await ctx.params;
  const code = await codeOfToken(token);
  if (!code?.edition) return Response.json({ error: "not-found" }, { status: 404 });
  const svg = await codeSvg(code, publicBase(req), 1024);
  const png = await svgToPng(svg, 1024);
  const headers = { "cache-control": "public, max-age=3600", "x-content-type-options": "nosniff" };
  return png ? new Response(png, { headers: { ...headers, "content-type": "image/png" } }) : new Response(svg, { headers: { ...headers, "content-type": "image/svg+xml; charset=utf-8" } });
}
