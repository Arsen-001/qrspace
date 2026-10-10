import type { NextRequest } from "next/server";
import { findCode, market } from "@/server/db";
import { nftConfig, nftView } from "@/server/nft";
import { DESIGNS } from "@/lib/market";

/**
 * Сертификат подлинности коллекционного кода: дизайн, номер тиража, коллаборация, кто владеет и история владельцев.
 * Открыт по ссылке — её хозяин сам показывает (как сертификат у коллекционной вещи). Памяти здесь нет.
 */
export async function GET(_req: NextRequest, ctx: RouteContext<"/api/cert/[id]">) {
  const { id } = await ctx.params;
  const c = await findCode(id);
  if (!c?.edition) return Response.json({ error: "not-found" }, { status: 404 });
  const d = (await market()).designs.find((x) => x.id === c.edition!.design) ?? DESIGNS.find((x) => x.id === c.edition!.design);
  return Response.json({
    id: c.id,
    style: c.style,
    edition: c.edition,
    design: d ? { name: d.name, collab: d.collab ?? null, by: d.by ?? null } : null,
    owner: c.owner,
    owners: c.owners ?? [{ person: c.owner, at: c.createdAt, price: null }],
    // NFT (10.10.2026): выпущен — сеть, № токена, ссылки в блокчейн; можно выпустить — хозяину кнопка.
    nft: nftView(c.nft),
    nftReady: !!nftConfig() && !c.nft,
  });
}
