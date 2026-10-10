import type { NextRequest } from "next/server";
import { tr } from "@/lib/i18n";
import { DESIGNS } from "@/lib/market";
import { market, publicBase } from "@/server/db";
import { codeOfToken } from "@/server/nft-token";

/**
 * Описание токена по стандарту ERC-721 (tokenURI = <сайт>/api/nft/<номер>): так NFT видят кошельки и площадки.
 * Название — по-английски (площадки международные); картинка — сам код; ссылка — сертификат подлинности.
 */
export async function GET(req: NextRequest, ctx: RouteContext<"/api/nft/[token]">) {
  const { token } = await ctx.params;
  const code = await codeOfToken(token);
  if (!code?.edition || !code.nft) return Response.json({ error: "not-found" }, { status: 404 });
  const base = publicBase(req);
  const e = code.edition;
  const d = (await market()).designs.find((x) => x.id === e.design) ?? DESIGNS.find((x) => x.id === e.design);
  const name = d ? tr(d.name, "en") : e.design === "number" ? "Number code" : e.design;
  return Response.json(
    {
      name: `QR Space · ${name} #${e.no}`,
      description: `A collectible QR Space code: ${name}, No. ${e.no}${e.of ? ` of ${e.of}` : ""}. The code itself is a short link any phone camera reads; this token is the right to it. Certificate: ${base}/cert/${code.id}`,
      image: `${base}/api/nft/${code.nft.token}/image`,
      external_url: `${base}/cert/${code.id}`,
      attributes: [
        { trait_type: "Design", value: name },
        { trait_type: "Number", value: e.no, display_type: "number" },
        ...(e.of ? [{ trait_type: "Edition size", value: e.of, display_type: "number" }] : []),
        ...(d && "collab" in d && d.collab ? [{ trait_type: "Collab", value: d.collab }] : []),
      ],
    },
    { headers: { "cache-control": "public, max-age=300" } },
  );
}
