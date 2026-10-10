import type { NextRequest } from "next/server";
import { mutate } from "@/server/db";
import { mintToken, nftConfig, nftView, tokenHolder } from "@/server/nft";
import { currentPerson } from "@/server/session";

/**
 * Выпустить NFT коллекционного кода (10.10.2026, пока пример): только хозяин и только код с номером из маркета.
 * Номер токена — следующий в контракте; токен хранит QR Space за владельца кода. Уже выпущен — тот же.
 */
export async function POST(_req: NextRequest, ctx: RouteContext<"/api/codes/[id]/nft">) {
  const c = nftConfig();
  if (!c) return Response.json({ error: "off" }, { status: 404 });
  const me = await currentPerson();
  if (!me) return Response.json({ error: "login" }, { status: 401 });
  const { id } = await ctx.params;
  // Номер берём сразу под замком данных (двое одновременно не получат один), а выпускаем снаружи: блокчейн отвечает секунды.
  const r = await mutate((db) => {
    const code = db.codes.find((x) => x.id === id);
    if (!code) return { error: 404 };
    if (code.owner !== me) return { error: 403 };
    if (!code.edition) return { error: 400 };
    if (code.nft) return code.nft.tx ? { done: nftView(code.nft) } : { error: 409 };
    const same = (x: typeof code) => x.nft && x.nft.chain === c.chainId && x.nft.contract.toLowerCase() === c.contract.toLowerCase();
    const token = Math.max(0, ...db.codes.filter(same).map((x) => x.nft!.token)) + 1;
    code.nft = { chain: c.chainId, contract: c.contract, token, at: new Date().toISOString() };
    return { token };
  });
  if ("done" in r) return Response.json({ nft: r.done });
  if ("error" in r) return Response.json({ error: r.error === 409 ? "minting" : "no" }, { status: r.error });
  const save = (patch: { tx: string; holder: string } | null) =>
    mutate((db) => {
      const code = db.codes.find((x) => x.id === id);
      if (!code?.nft || code.nft.token !== r.token || code.nft.tx) return code?.nft;
      if (patch) Object.assign(code.nft, patch);
      else delete code.nft;
      return code.nft;
    });
  try {
    const { tx, holder } = await mintToken(c, r.token);
    return Response.json({ nft: nftView(await save({ tx, holder })) });
  } catch (e) {
    // Ответа не дождались, а токен уже в блокчейне — считаем выпущенным; нет — номер освобождаем, можно ещё раз.
    const holder = await tokenHolder(c, r.token);
    console.error("nft mint failed", holder ? "(token exists)" : "", e instanceof Error ? e.message.split("\n")[0] : e);
    if (holder) return Response.json({ nft: nftView(await save({ tx: "unknown", holder })) });
    await save(null);
    return Response.json({ error: "chain" }, { status: 502 });
  }
}
