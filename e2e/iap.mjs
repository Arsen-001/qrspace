// Встроенная оплата в приложениях (09.10.2026): покупка Apple (подпись) и Google (токен) → сервер проверяет, засчитывает
// один раз и выдаёт код / пакет / месяц места. Подделки, изменённые, чужие и повторные покупки — отказ.
// Apple здесь — покупки «из Xcode» (свой сертификат; принимаются только на этом компьютере с IAP_ALLOW_XCODE=1) и
// «поддельная цепочка» с выдуманным корнем (должна быть отклонена). Google — подставной сервер (3732).
import { execSync } from "node:child_process";
import { createPrivateKey, randomBytes, sign } from "node:crypto";
import { mkdtempSync, readFileSync } from "node:fs";
import http from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import { request } from "playwright";
const B = "http://localhost:3720";
const errors = [];
const ok = (c, m) => { console.log(c ? "  ✓" : "  ✗", m); if (!c) errors.push(m); };

// Сертификаты: «Xcode» (самоподписанный) и поддельная цепочка корень → лист
const dir = mkdtempSync(path.join(tmpdir(), "iap-"));
const sh = (c) => execSync(c, { cwd: dir, stdio: "pipe" });
sh("openssl req -x509 -newkey ec -pkeyopt ec_paramgen_curve:P-256 -nodes -subj /CN=StoreKitTesting -days 2 -keyout xk.pem -out xc.pem");
sh("openssl req -x509 -newkey ec -pkeyopt ec_paramgen_curve:P-256 -nodes -subj /CN=FakeRoot -days 2 -keyout rk.pem -out rc.pem");
sh("openssl req -newkey ec -pkeyopt ec_paramgen_curve:P-256 -nodes -subj /CN=FakeLeaf -keyout lk.pem -out l.csr");
sh("openssl x509 -req -in l.csr -CA rc.pem -CAkey rk.pem -CAcreateserial -days 2 -out lc.pem");
const b64der = (f) => readFileSync(path.join(dir, f), "utf8").replace(/-----[^-]+-----|\s/g, "");
const key = (f) => createPrivateKey(readFileSync(path.join(dir, f)));
const jws = (payload, { k = "xk.pem", x5c = [b64der("xc.pem")] } = {}) => {
  const h = Buffer.from(JSON.stringify({ alg: "ES256", x5c })).toString("base64url");
  const p = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const s = sign("sha256", Buffer.from(`${h}.${p}`), { key: key(k), dsaEncoding: "ieee-p1363" }).toString("base64url");
  return `${h}.${p}.${s}`;
};
const tx = (productId, extra = {}) => ({ bundleId: "co.qrspace.app", productId, transactionId: String(randomBytes(6).readUIntBE(0, 6)), environment: "Xcode", signedDate: Date.now(), purchaseDate: Date.now(), type: "Consumable", ...extra });

// Подставной Google Play
const consumed = new Set();
const play = http.createServer((req, res) => {
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    res.setHeader("content-type", "application/json");
    if (req.url === "/token") return res.end(JSON.stringify({ access_token: "play-access" }));
    if (req.headers.authorization !== "Bearer play-access") return res.writeHead(401).end("{}");
    const m = /\/purchases\/products\/([^/]+)\/tokens\/([^/:]+)(:consume)?$/.exec(req.url);
    if (!m) return res.writeHead(404).end("{}");
    const [, , token, consume] = m;
    if (token.startsWith("fake")) return res.writeHead(404).end("{}");
    if (consume) return consumed.add(token), res.end("{}");
    res.end(JSON.stringify({ purchaseState: 0, consumptionState: consumed.has(token) ? 1 : 0, orderId: `GPA.${token}`, ...(token.startsWith("test") && { purchaseType: 0 }) }));
  });
}).listen(3732);

const demo = async (who) => { const r = await request.newContext({ baseURL: B }); await r.post("/api/me", { data: { personId: who } }); return r; };
const arman = await demo("arman");
const lilit = await demo("lilit");
const buy = (who, body) => who.post("/api/iap", { data: body });
const apple = (j, intent) => ({ platform: "ios", jws: j, intent });

// Apple: код — оплата по ключу, затем код создаётся этим ключом
const t1 = jws(tx("co.qrspace.code"));
const r1 = await buy(arman, apple(t1, { kind: "code", key: "g:iapapple01", tier: "styled" }));
ok(r1.status() === 200, `Apple code purchase accepted (${r1.status()})`);
ok((await (await arman.get("/api/purchases?key=g:iapapple01&tier=styled")).json()).paid === true, "code is paid after the App Store purchase");
const made = await arman.post("/api/codes/quick", { data: { content: { type: "url", fields: { url: "https://example.com/iap" } }, key: "g:iapapple01" } });
ok(made.status() === 200, "code created with the store-paid key");
ok((await buy(arman, apple(t1, { kind: "code", key: "g:iapapple02", tier: "styled" }))).status() === 409, "same Apple purchase can't be used twice");
// Xcode начинает номера покупок заново при каждом запуске: тот же номер, другое время — новая покупка
const again = jws(tx("co.qrspace.pack5", { transactionId: "1", purchaseDate: 1000 }));
const again2 = jws(tx("co.qrspace.pack5", { transactionId: "1", purchaseDate: 2000 }));
ok((await buy(arman, apple(again, { kind: "pack", plan: "p5" }))).status() === 200 && (await buy(arman, apple(again2, { kind: "pack", plan: "p5" }))).status() === 200, "Xcode test purchases with a reused number but a new time both count");
// Подделки
const [h, p, s] = jws(tx("co.qrspace.code")).split(".");
const forged = `${h}.${Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(p, "base64url")), productId: "co.qrspace.pack100" })).toString("base64url")}.${s}`;
ok((await buy(arman, apple(forged, { kind: "pack", plan: "p100" }))).status() === 402, "edited purchase (pack100 instead of a code) refused");
const fakeProd = jws(tx("co.qrspace.pack100", { environment: "Production" }), { k: "lk.pem", x5c: [b64der("lc.pem"), b64der("rc.pem"), b64der("rc.pem")] });
ok((await buy(arman, apple(fakeProd, { kind: "pack", plan: "p100" }))).status() === 402, "made-up certificate chain (not Apple's root) refused");
ok((await buy(arman, apple(jws(tx("co.qrspace.code", { bundleId: "com.other.app" })), { kind: "code", key: "g:iapapple03", tier: "simple" }))).status() === 402, "other app's purchase refused");
ok((await buy(arman, apple(jws(tx("co.qrspace.code", { revocationDate: Date.now() })), { kind: "code", key: "g:iapapple04", tier: "simple" }))).status() === 402, "refunded (revoked) purchase refused");
ok((await buy(arman, apple(jws(tx("co.qrspace.code")), { kind: "pack", plan: "p5" }))).status() === 422, "product doesn't match what was bought → 422");
// Пакет
const before = (await (await arman.get("/api/packs")).json()).left;
ok((await buy(arman, apple(jws(tx("co.qrspace.pack5")), { kind: "pack", plan: "p5" }))).status() === 200, "Apple pack purchase accepted");
ok((await (await arman.get("/api/packs")).json()).left === before + 5, "5 codes added to packs");
// Место для своего кода — да; для чужого — отказ ещё до магазина
const mine = await (await arman.post("/api/codes", { data: { title: "IAP место", kind: "memory" } })).json();
ok((await buy(arman, apple(jws(tx("co.qrspace.space10.month", { type: "Non-Renewing Subscription" })), { kind: "space", code: mine.id, plan: "s10" }))).status() === 200, "Apple space month for own code accepted");
ok((await (await arman.get(`/api/codes/${mine.id}`)).json()).storage.quota === 10 * 1024 * 1024, "code got 10 MB");
ok((await buy(lilit, apple(jws(tx("co.qrspace.space10.month")), { kind: "space", code: mine.id, plan: "s10" }))).status() === 403, "space for someone else's code refused before charging");

// Google: товар и токен → проверка у Google → «погасили» → засчитано один раз
const g = (productId, purchaseToken, intent) => ({ platform: "android", productId, purchaseToken, intent });
ok((await buy(lilit, g("co.qrspace.pack10", "tok-0001-aaaa", { kind: "pack", plan: "p10" }))).status() === 200, "Google pack purchase verified");
ok(consumed.has("tok-0001-aaaa"), "server consumed the Google purchase");
ok((await buy(lilit, g("co.qrspace.pack10", "tok-0001-aaaa", { kind: "pack", plan: "p10" }))).status() === 402, "consumed Google purchase can't be used again");
ok((await buy(lilit, g("co.qrspace.code", "fake-token-123", { kind: "code", key: "g:iapgoog01", tier: "simple" }))).status() === 402, "unknown Google token refused");
ok((await buy(lilit, g("co.qrspace.code", "test-0002-bbbb", { kind: "code", key: "g:iapgoog02", tier: "simple" }))).status() === 200, "Google test purchase accepted");
const prof = await (await lilit.get("/api/profile")).json();
const tp = prof.purchases.find((x) => x.key === "g:iapgoog02");
ok(tp?.store === "google" && tp.price === 0 && tp.test === true, "tester purchase recorded without revenue");
ok((await (await request.newContext({ baseURL: B })).post("/api/iap", { data: apple(jws(tx("co.qrspace.code")), { kind: "code", key: "g:x", tier: "simple" }) })).status() === 401, "guest can't redeem purchases");

play.close();
if (errors.length) { console.log("errors:", errors); process.exit(1); }
console.log("iap: ok");
process.exit(0);
