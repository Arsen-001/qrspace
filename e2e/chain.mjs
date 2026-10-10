// Учебный блокчейн для проверки NFT (e2e/nft.mjs): Hardhat на 8545 (папка chain/, только этот компьютер) + свежий
// контракт QrSpaceCodes. Ключ — первый из известных тестовых ключей Hardhat (денег нет нигде, кроме этой сети).
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { hardhat } from "viem/chains";

export const CHAIN_RPC = "http://127.0.0.1:8545";
export const CHAIN_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
const root = path.resolve(import.meta.dirname, "..");
const contract = JSON.parse(readFileSync(path.join(root, "src/server/nft-contract.json"), "utf8"));

const alive = async () => {
  try {
    const r = await fetch(CHAIN_RPC, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_chainId", params: [] }) });
    return r.ok;
  } catch {
    return false;
  }
};

/** Запустить сеть, выложить контракт; вернуть env для сайта и stop(). baseURI — адрес описаний токенов на сайте. */
export async function startChain(baseURI = "http://localhost:3720/api/nft/") {
  if (await alive()) throw new Error("port 8545 is busy — another chain is running");
  const node = spawn(path.join(root, "chain/node_modules/.bin/hardhat"), ["node", "--port", "8545"], { cwd: path.join(root, "chain"), stdio: "ignore" });
  for (let i = 0; i < 60 && !(await alive()); i++) await new Promise((r) => setTimeout(r, 500));
  if (!(await alive())) throw new Error("chain did not start");
  const account = privateKeyToAccount(CHAIN_KEY);
  const wallet = createWalletClient({ account, chain: hardhat, transport: http(CHAIN_RPC) });
  const pub = createPublicClient({ chain: hardhat, transport: http(CHAIN_RPC) });
  const hash = await wallet.deployContract({ abi: contract.abi, bytecode: contract.bytecode, args: [baseURI, account.address] });
  const { contractAddress } = await pub.waitForTransactionReceipt({ hash });
  return {
    address: contractAddress,
    env: `NFT_RPC_URL=${CHAIN_RPC}\nNFT_CHAIN_ID=31337\nNFT_CONTRACT=${contractAddress}\nNFT_MINTER_KEY=${CHAIN_KEY}\n`,
    stop: () => node.kill(),
  };
}
