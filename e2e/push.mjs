// Уведомления на телефон (09.10.2026): просьба доступа и т. п. уходит в приложение — iPhone через Apple (APNs, HTTP/2),
// Android через Firebase (FCM v1). Здесь — подставные Apple (3730) и Firebase (3731); ключи — тестовые (run.mjs, .env.local).
import http from "node:http";
import http2 from "node:http2";
import { request } from "playwright";
const B = "http://localhost:3720";
const errors = [];
const ok = (c, m) => { console.log(c ? "  ✓" : "  ✗", m); if (!c) errors.push(m); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const apns = [];
const apple = http2.createServer();
apple.on("stream", (stream, h) => {
  let body = "";
  stream.on("data", (c) => (body += c));
  stream.on("end", () => {
    apns.push({ path: h[":path"], auth: h.authorization, topic: h["apns-topic"], body: JSON.parse(body) });
    stream.respond({ ":status": h[":path"].includes("/dead") ? 410 : 200 });
    stream.end(h[":path"].includes("/dead") ? JSON.stringify({ reason: "Unregistered" }) : "");
  });
});
apple.listen(3730);

const fcm = [];
let fcmTokens = 0;
const firebase = http.createServer((req, res) => {
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    if (req.url === "/token") {
      fcmTokens++;
      ok(new URLSearchParams(body).get("assertion")?.split(".").length === 3, "Firebase gets a signed service-account JWT");
      res.writeHead(200, { "content-type": "application/json" });
      return res.end(JSON.stringify({ access_token: "fake-access", expires_in: 3600 }));
    }
    fcm.push({ url: req.url, auth: req.headers.authorization, body: JSON.parse(body) });
    res.writeHead(200, { "content-type": "application/json" });
    res.end("{}");
  });
});
firebase.listen(3731);

const demo = async (who) => { const r = await request.newContext({ baseURL: B }); await r.post("/api/me", { data: { personId: who } }); return r; };
const until = async (cond, what) => { for (let i = 0; i < 50 && !cond(); i++) await sleep(200); ok(cond(), what); };

const arman = await demo("arman");
const lilit = await demo("lilit");
const iphone = "a".repeat(64);
await arman.post("/api/devices", { data: { token: iphone, platform: "ios", lang: "ru" } });
await arman.post("/api/devices", { data: { token: "dead" + "0".repeat(60), platform: "ios", lang: "ru" } });
const pixel = "pixel-token-" + "b".repeat(40);
await lilit.post("/api/devices", { data: { token: pixel, platform: "android", lang: "en" } });

// Лилит просит доступ к закрытому коду Армана → iPhone Армана, по-русски
const keys = (await (await arman.get("/api/codes")).json()).mine.find((c) => c.title === "Ключи от дома");
await lilit.post(`/api/codes/${keys.id}/request`);
await until(() => apns.some((x) => x.path === `/3/device/${iphone}`), "iPhone notified through Apple");
const a = apns.find((x) => x.path === `/3/device/${iphone}`);
ok(a && /просит доступ/.test(a.body.aps.alert.body) && a.body.aps.alert.body.includes("Ключи от дома") && a.body.link === `/codes/${keys.id}`, `text in the phone's language with a link (${a?.body.aps.alert.body})`);
ok(a && a.topic === "co.qrspace.app" && /^bearer [\w-]+\.[\w-]+\.[\w-]+$/.test(a.auth), "Apple request signed (ES256 JWT) for our app");
// Приложение удалили (Apple: 410) — телефон убран
await until(() => apns.some((x) => x.path.includes("/dead")), "dead iPhone tried");
let devs = [];
for (let i = 0; i < 25; i++) { devs = (await (await arman.get("/api/devices")).json()).devices; if (devs.length === 1) break; await sleep(200); }
ok(devs.length === 1 && devs[0].end === iphone.slice(-6), "deleted app's phone removed, live one kept");

// Арман просит доступ к закрытому коду Лилит → Android Лилит, по-английски
const mine = await (await lilit.post("/api/codes", { data: { title: "Lilit diary", kind: "memory" } })).json();
await arman.post(`/api/codes/${mine.id}/request`);
await until(() => fcm.some((x) => x.body.message.token === pixel), "Android notified through Firebase");
const f = fcm.find((x) => x.body.message.token === pixel);
ok(f && f.url === "/v1/projects/qrspace-test/messages:send" && f.auth === "Bearer fake-access" && /asks for access/.test(f.body.message.notification.body), `FCM v1 message (${f?.body.message.notification.body})`);
ok(fcmTokens === 1, "Firebase access token reused");

// Нет телефона — ничего не отправляем; свой же поступок — не уведомляем
const before = apns.length + fcm.length;
await arman.post(`/api/codes/${keys.id}/request`);
await sleep(800);
ok(apns.length + fcm.length === before, "no push for your own action");

apple.close();
firebase.close();
if (errors.length) { console.log("errors:", errors); process.exit(1); }
console.log("push: ok");
process.exit(0);
