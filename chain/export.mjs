// Готовый контракт для сайта: ABI и байткод из сборки → src/server/nft-contract.json (в git; solc сайту не нужен).
import { readFileSync, writeFileSync } from "node:fs";
const a = JSON.parse(readFileSync(new URL("./artifacts/contracts/QrSpaceCodes.sol/QrSpaceCodes.json", import.meta.url)));
writeFileSync(new URL("../src/server/nft-contract.json", import.meta.url), JSON.stringify({ abi: a.abi, bytecode: a.bytecode }) + "\n");
console.log("ok", a.abi.length, "abi items,", (a.bytecode.length - 2) / 2, "bytes");
