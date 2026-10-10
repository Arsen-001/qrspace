// NFT кода (владелец 10.10.2026: «делай NFT, 1 пример только»; «покупают МБ под своим QR, как будто это свой маленький
// домен»). Токен — право на код в блокчейне; сам код (короткая ссылка) не меняется и читается любой камерой.
// Выпускает QR Space своим ключом и хранит токен за владельца кода (кошелёк человеку не нужен).
// Env: NFT_RPC_URL, NFT_CHAIN_ID, NFT_CONTRACT, NFT_MINTER_KEY (секрет), NFT_EXPLORER (необязательно). Нет — NFT выключен.
import { createPublicClient, createWalletClient, defineChain, http, type Abi, type Address, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import type { NftRecord } from "@/lib/codes";
import contract from "./nft-contract.json";

const abi = contract.abi as Abi;

/** Известные сети: имя, тестовая ли, обозреватель блоков. */
const NETWORKS: Record<number, { name: string; test: boolean; explorer: string | null }> = {
  8453: { name: "Base", test: false, explorer: "https://basescan.org" },
  84532: { name: "Base Sepolia", test: true, explorer: "https://sepolia.basescan.org" },
  137: { name: "Polygon", test: false, explorer: "https://polygonscan.com" },
  80002: { name: "Polygon Amoy", test: true, explorer: "https://amoy.polygonscan.com" },
  31337: { name: "Hardhat", test: true, explorer: null },
};

export type NftConfig = { rpc: string; chainId: number; contract: Address; key: Hex; network: string; test: boolean; explorer: string | null };

export function nftConfig(): NftConfig | null {
  const rpc = process.env.NFT_RPC_URL ?? "";
  const chainId = Number(process.env.NFT_CHAIN_ID);
  const address = process.env.NFT_CONTRACT ?? "";
  const key = process.env.NFT_MINTER_KEY ?? "";
  if (!/^https?:\/\//.test(rpc) || !Number.isInteger(chainId) || chainId <= 0 || !/^0x[0-9a-fA-F]{40}$/.test(address) || !/^0x[0-9a-fA-F]{64}$/.test(key)) return null;
  const n = NETWORKS[chainId] ?? { name: `Chain ${chainId}`, test: false, explorer: null };
  const explorer = /^https:\/\//.test(process.env.NFT_EXPLORER ?? "") ? process.env.NFT_EXPLORER!.replace(/\/$/, "") : n.explorer;
  return { rpc, chainId, contract: address as Address, key: key as Hex, network: n.name, test: n.test, explorer };
}

const clients = (c: NftConfig) => {
  const chain = defineChain({ id: c.chainId, name: c.network, nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 }, rpcUrls: { default: { http: [c.rpc] } } });
  const account = privateKeyToAccount(c.key);
  return {
    account,
    pub: createPublicClient({ chain, transport: http(c.rpc) }),
    wallet: createWalletClient({ account, chain, transport: http(c.rpc) }),
  };
};

/** Выпустить токен №token на хранение QR Space. Ждём, пока блокчейн его запишет. */
export async function mintToken(c: NftConfig, token: number): Promise<{ tx: Hex; holder: Address }> {
  const { account, pub, wallet } = clients(c);
  const tx = await wallet.writeContract({ address: c.contract, abi, functionName: "mint", args: [account.address, BigInt(token)] });
  const r = await pub.waitForTransactionReceipt({ hash: tx, timeout: 90_000 });
  if (r.status !== "success") throw new Error("mint reverted");
  return { tx, holder: account.address };
}

/** Чей токен по блокчейну (null — нет такого или сеть не отвечает). */
export async function tokenHolder(c: NftConfig, token: number): Promise<Address | null> {
  try {
    return (await clients(c).pub.readContract({ address: c.contract, abi, functionName: "ownerOf", args: [BigInt(token)] })) as Address;
  } catch {
    return null;
  }
}

/** Что показывать о токене: сеть, номер, ссылки в обозреватель блоков (по сети, в которой выпущен). */
export type NftView = { token: number; network: string; test: boolean; contract: string; holder: string; tx: string; url: string | null; txUrl: string | null };

export function nftView(n: NftRecord | undefined): NftView | null {
  if (!n?.tx) return null;
  const net = NETWORKS[n.chain] ?? { name: `Chain ${n.chain}`, test: false, explorer: null };
  const c = nftConfig();
  const explorer = c && c.chainId === n.chain ? c.explorer : net.explorer;
  return {
    token: n.token,
    network: net.name,
    test: net.test,
    contract: n.contract,
    holder: n.holder ?? "",
    tx: n.tx,
    url: explorer ? `${explorer}/nft/${n.contract}/${n.token}` : null,
    txUrl: explorer && /^0x[0-9a-fA-F]{64}$/.test(n.tx) ? `${explorer}/tx/${n.tx}` : null,
  };
}
