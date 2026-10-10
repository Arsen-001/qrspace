// Выложить контракт NFT кодов в сеть (один раз на сеть): node scripts/nft-deploy.mjs <env-файл> [адрес сайта]
// env-файл — NFT_RPC_URL, NFT_CHAIN_ID, NFT_MINTER_KEY (тестовая сеть: ~/.qrspace/nft-testnet.env; вне git).
// Описания токенов — <сайт>/api/nft/<номер>. Адрес контракта дописывается в тот же файл (NFT_CONTRACT=…); дальше
// эти четыре значения — в Vercel (Production, Sensitive) и выкладка. Ключ в консоль не печатаем.
import { appendFileSync, readFileSync } from "node:fs";
import { createPublicClient, createWalletClient, defineChain, formatEther, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";

const [file, site = "https://qrspace.co"] = process.argv.slice(2);
if (!file) {
  console.log("node scripts/nft-deploy.mjs <env-файл> [адрес сайта]");
  process.exit(1);
}
const env = Object.fromEntries(readFileSync(file, "utf8").split("\n").filter((l) => /^NFT_\w+=/.test(l)).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]));
if (env.NFT_CONTRACT) {
  console.log(`Контракт уже есть: ${env.NFT_CONTRACT} (новый — уберите строку NFT_CONTRACT из файла)`);
  process.exit(0);
}
const chain = defineChain({ id: Number(env.NFT_CHAIN_ID), name: `chain-${env.NFT_CHAIN_ID}`, nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 }, rpcUrls: { default: { http: [env.NFT_RPC_URL] } } });
const account = privateKeyToAccount(env.NFT_MINTER_KEY);
const pub = createPublicClient({ chain, transport: http(env.NFT_RPC_URL) });
const balance = await pub.getBalance({ address: account.address });
console.log(`Кошелёк QR Space: ${account.address}, баланс ${formatEther(balance)} ETH`);
if (balance === 0n) {
  console.log("Монет нет — сначала пополните этот адрес (тестовая сеть: бесплатный кран).");
  process.exit(1);
}
const { abi, bytecode } = JSON.parse(readFileSync(new URL("../src/server/nft-contract.json", import.meta.url), "utf8"));
const wallet = createWalletClient({ account, chain, transport: http(env.NFT_RPC_URL) });
const hash = await wallet.deployContract({ abi, bytecode, args: [`${site.replace(/\/$/, "")}/api/nft/`, account.address] });
console.log(`Транзакция: ${hash} — ждём блок…`);
const { contractAddress, status } = await pub.waitForTransactionReceipt({ hash, timeout: 180_000 });
if (status !== "success" || !contractAddress) {
  console.log("Не вышло — транзакция отклонена.");
  process.exit(1);
}
appendFileSync(file, `NFT_CONTRACT=${contractAddress}\n`);
console.log(`Контракт: ${contractAddress} — дописан в ${file}`);
