import type { NextRequest } from "next/server";
import { ASSET_MIME } from "@/server/assets";
import { media } from "@/server/media";

/** Картинка оформления по отпечатку содержимого: не меняется никогда — кэшируем надолго. */
export async function GET(_req: NextRequest, ctx: RouteContext<"/api/asset/[name]">) {
  const { name } = await ctx.params;
  const m = /^[0-9a-f]{32}\.(png|jpg|webp)$/.exec(name);
  const f = m && (await media.open(`asset_${name}`));
  if (!m || !f) return new Response(null, { status: 404 });
  return new Response(f.body, {
    headers: { "content-type": ASSET_MIME[m[1]], "content-length": String(f.size), "cache-control": "public, max-age=31536000, immutable", "x-content-type-options": "nosniff" },
  });
}
