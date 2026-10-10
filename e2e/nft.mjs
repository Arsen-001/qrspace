// NFT коллекционного кода (владелец 10.10.2026: «делай NFT, 1 пример только»). Пример — «Туманность № 3» Давида:
// на сертификате «Выпустить NFT» → токен #1 в блокчейне (учебная сеть, e2e/chain.mjs), описание токена и картинка —
// с сайта, на странице скана — значок NFT. Чужой код и код не из маркета — нельзя; второй раз — тот же токен.
// Нужны NFT_* в .env.local и запущенная сеть — run.mjs делает это сам (npm run e2e -- nft).
import { readFileSync } from "node:fs";
import path from "node:path";
import { chromium, request } from "playwright";
import { createPublicClient, http } from "viem";
import { hardhat } from "viem/chains";
import { CHAIN_RPC } from "./chain.mjs";
const out = new URL("./out/", import.meta.url).pathname;
const B = "http://localhost:3720";
const errors = [];
const ok = (c, m) => { console.log(c ? "  ✓" : "  ✗", m); if (!c) errors.push(m); };
const env = Object.fromEntries(readFileSync(path.resolve(import.meta.dirname, "../.env.local"), "utf8").split("\n").filter((l) => l.startsWith("NFT_")).map((l) => l.split("=")));
const abi = JSON.parse(readFileSync(path.resolve(import.meta.dirname, "../src/server/nft-contract.json"), "utf8")).abi;
const chain = createPublicClient({ chain: hardhat, transport: http(CHAIN_RPC) });
const read = (functionName, args) => chain.readContract({ address: env.NFT_CONTRACT, abi, functionName, args });

const as = async (who) => {
  const r = await request.newContext({ baseURL: B });
  if (who) await r.post("/api/me", { data: { personId: who } });
  return r;
};
const david = await as("david");
const ani = await as("ani");
const guest = await as(null);
const nebula = (await (await david.get("/api/codes")).json()).mine.find((c) => c.title === "Туманность");
const parchment = (await (await ani.get("/api/codes")).json()).mine.find((c) => c.title === "Пергамент");
const plain = (await (await (await as("arman")).get("/api/codes")).json()).mine.find((c) => !c.edition);
ok(!!nebula && !!parchment && !!plain, "demo codes found (Туманность, Пергамент, a plain code)");

// Права: гость, чужой, не коллекционный
ok((await guest.post(`/api/codes/${nebula.id}/nft`)).status() === 401, "guest can't mint");
ok((await ani.post(`/api/codes/${nebula.id}/nft`)).status() === 403, "someone else's code — 403");
ok((await (await as("arman")).post(`/api/codes/${plain.id}/nft`)).status() === 400, "not a collectible code — 400");

// Сертификат: хозяин выпускает NFT
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: "ru-RU", isMobile: true, hasTouch: true });
await ctx.request.post(B + "/api/me", { data: { personId: "david" } });
const p = await ctx.newPage();
p.on("pageerror", (e) => errors.push(e.message));
await p.goto(`${B}/cert/${nebula.id}`, { waitUntil: "networkidle" });
ok(await p.getByRole("heading", { name: "Сделать NFT" }).isVisible(), "owner sees «Сделать NFT» on the certificate");
await p.screenshot({ path: out + "nft-before.png", fullPage: true });
await p.getByRole("button", { name: /Выпустить NFT/ }).click();
await p.getByText("Токен #1").waitFor({ timeout: 60000 }).then(() => ok(true, "minted: «Токен #1» on the certificate"), () => ok(false, "minted: «Токен #1» on the certificate"));
ok(await p.getByText("Hardhat").first().isVisible(), "network shown");
ok(await p.getByText("QR Space хранит за владельца").isVisible(), "says QR Space holds it for the owner");
ok(!(await p.getByRole("button", { name: /Выпустить NFT/ }).count()), "no second mint button");
await p.screenshot({ path: out + "nft-cert.png", fullPage: true });

// Блокчейн: токен есть, у кошелька QR Space, описание — на сайте
const minter = (await (await david.post(`/api/codes/${nebula.id}/nft`)).json()).nft;
ok(minter?.token === 1, "second request — the same token #1, not a new one");
ok((await read("ownerOf", [1n])).toLowerCase() === minter.holder.toLowerCase(), "on chain: token #1 belongs to the QR Space wallet");
ok((await read("balanceOf", [minter.holder])) === 1n, "on chain: exactly one token minted");
ok((await read("tokenURI", [1n])) === `${B}/api/nft/1`, "on chain: tokenURI points to our site");
const meta = await (await guest.get("/api/nft/1")).json();
ok(/#3$/.test(meta.name) && meta.external_url.endsWith(`/cert/${nebula.id}`) && meta.attributes.some((a) => a.trait_type === "Number" && a.value === 3), `metadata: ${meta.name}`);
const img = await guest.get("/api/nft/1/image");
ok(img.status() === 200 && img.headers()["content-type"] === "image/png" && (await img.body()).subarray(1, 4).toString() === "PNG", "token picture — PNG of the code");
ok((await guest.get("/api/nft/99")).status() === 404, "unknown token — 404");

// Страница скана — значок NFT для всех
const g = await (await browser.newContext({ viewport: { width: 390, height: 844 }, locale: "ru-RU" })).newPage();
await g.goto(`${B}/c/${nebula.id}`, { waitUntil: "networkidle" });
ok((await g.getByRole("link", { name: /NFT #1/ }).isVisible()) && (await g.getByText("Hardhat · тестовая сеть").isVisible()), "scan page shows «NFT #1» to everyone");
await g.screenshot({ path: out + "nft-scan.png", fullPage: true });

// Другой хозяин — следующий номер; чужой сертификат — без кнопки
const second = (await (await ani.post(`/api/codes/${parchment.id}/nft`)).json()).nft;
ok(second?.token === 2, "next collectible code — token #2");
await p.goto(`${B}/cert/${parchment.id}`, { waitUntil: "networkidle" });
ok(!(await p.getByRole("button", { name: /Выпустить NFT/ }).count()) && (await p.getByText("Токен #2").isVisible()), "someone else's certificate: token shown, no mint button");

await browser.close();
if (errors.length) { console.log("errors:", errors); process.exit(1); }
console.log("nft: ok");
process.exit(0);
