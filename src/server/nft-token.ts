import { allCodes } from "./db";
import { nftConfig } from "./nft";

/** Код токена: в контракте, который сейчас настроен (нет настройки — любой выпущенный с этим номером). */
export async function codeOfToken(token: string) {
  const n = Number(token);
  if (!Number.isInteger(n) || n < 1) return null;
  const c = nftConfig();
  return (await allCodes()).find((x) => x.nft?.tx && x.nft.token === n && (!c || (x.nft.chain === c.chainId && x.nft.contract.toLowerCase() === c.contract.toLowerCase()))) ?? null;
}
