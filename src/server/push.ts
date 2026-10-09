// Уведомления на телефон (приложения iOS и Android): то же, что колокольчик на сайте, — сообщение по коду, просьба
// доступа, ставка, напоминание. iPhone — через Apple (APNs, ключ .p8), Android — через Firebase (FCM v1, сервисный
// аккаунт). Пока ключей нет (их заводит владелец) — ничего не отправляем и ничего лишнего не делаем.
import { createPrivateKey, sign } from "node:crypto";
import http2 from "node:http2";

const env = (k: string) => process.env[k]?.trim() || "";
const test = (k: string) => (process.env.NODE_ENV !== "production" ? env(k) : "");

export type PushMessage = { token: string; platform: "ios" | "android"; title: string; body: string; link: string };

export const pushOn = () => ({
  ios: !!(env("APNS_KEY_ID") && env("APNS_TEAM_ID") && env("APNS_PRIVATE_KEY")),
  android: !!env("FCM_SERVICE_ACCOUNT"),
});

const b64url = (v: string | Buffer) => Buffer.from(v).toString("base64url");
const pem = (k: string) => k.replace(/\\n/g, "\n");

// Apple: JWT (ES256) живёт до часа — обновляем раз в 50 минут.
let apnsJwt: { value: string; at: number } | null = null;
function apnsToken(): string {
  if (apnsJwt && Date.now() - apnsJwt.at < 50 * 60_000) return apnsJwt.value;
  const head = b64url(JSON.stringify({ alg: "ES256", kid: env("APNS_KEY_ID") }));
  const claims = b64url(JSON.stringify({ iss: env("APNS_TEAM_ID"), iat: Math.floor(Date.now() / 1000) }));
  const sig = sign("sha256", Buffer.from(`${head}.${claims}`), { key: createPrivateKey(pem(env("APNS_PRIVATE_KEY"))), dsaEncoding: "ieee-p1363" });
  apnsJwt = { value: `${head}.${claims}.${b64url(sig)}`, at: Date.now() };
  return apnsJwt.value;
}

/** true — доставлено или временная ошибка; false — токена больше нет (приложение удалили), его убираем. */
function sendApns(m: PushMessage): Promise<boolean> {
  const host = test("APNS_TEST_URL") || (env("APNS_SANDBOX") === "1" ? "https://api.sandbox.push.apple.com" : "https://api.push.apple.com");
  const payload = JSON.stringify({ aps: { alert: { title: m.title, body: m.body }, sound: "default" }, link: m.link });
  return new Promise((resolve) => {
    const client = http2.connect(host);
    client.on("error", () => resolve(true));
    const req = client.request({
      ":method": "POST",
      ":path": `/3/device/${m.token}`,
      authorization: `bearer ${apnsToken()}`,
      "apns-topic": env("APNS_BUNDLE_ID") || "co.qrspace.app",
      "apns-push-type": "alert",
      "content-type": "application/json",
    });
    let status = 0;
    req.on("response", (h) => (status = Number(h[":status"])));
    req.on("data", () => {});
    req.on("end", () => {
      client.close();
      resolve(!(status === 410 || status === 400));
    });
    req.on("error", () => {
      client.close();
      resolve(true);
    });
    req.end(payload);
  });
}

// Firebase: обмениваем подписанный JWT сервисного аккаунта на токен доступа (час), держим 50 минут.
let fcmAccess: { value: string; at: number; project: string } | null = null;
async function fcmToken(): Promise<{ value: string; project: string } | null> {
  if (fcmAccess && Date.now() - fcmAccess.at < 50 * 60_000) return fcmAccess;
  const sa = JSON.parse(env("FCM_SERVICE_ACCOUNT")) as { client_email: string; private_key: string; project_id: string; token_uri?: string };
  const now = Math.floor(Date.now() / 1000);
  const aud = test("FCM_TEST_TOKEN_URL") || sa.token_uri || "https://oauth2.googleapis.com/token";
  const head = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = b64url(JSON.stringify({ iss: sa.client_email, scope: "https://www.googleapis.com/auth/firebase.messaging", aud, iat: now, exp: now + 3600 }));
  const sig = sign("sha256", Buffer.from(`${head}.${claims}`), createPrivateKey(pem(sa.private_key)));
  const r = await fetch(aud, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${head}.${claims}.${b64url(sig)}` }),
  }).catch(() => null);
  const j = r?.ok ? ((await r.json()) as { access_token?: string }) : null;
  if (!j?.access_token) return null;
  fcmAccess = { value: j.access_token, at: Date.now(), project: sa.project_id };
  return fcmAccess;
}

async function sendFcm(m: PushMessage): Promise<boolean> {
  const t = await fcmToken();
  if (!t) return true;
  const base = test("FCM_TEST_URL") || "https://fcm.googleapis.com";
  const r = await fetch(`${base}/v1/projects/${t.project}/messages:send`, {
    method: "POST",
    headers: { authorization: `Bearer ${t.value}`, "content-type": "application/json" },
    body: JSON.stringify({ message: { token: m.token, notification: { title: m.title, body: m.body }, data: { link: m.link } } }),
  }).catch(() => null);
  if (!r) return true;
  // 404 UNREGISTERED / 400 INVALID_ARGUMENT по токену — приложения на телефоне больше нет.
  return !(r.status === 404 || (r.status === 400 && (await r.text()).includes("registration token")));
}

/** Отправить; вернуть токены, которых больше нет (их надо убрать у людей). */
export async function deliver(messages: PushMessage[]): Promise<string[]> {
  const on = pushOn();
  const dead: string[] = [];
  await Promise.all(
    messages.map(async (m) => {
      if (m.platform === "ios" ? !on.ios : !on.android) return;
      const alive = await (m.platform === "ios" ? sendApns(m) : sendFcm(m)).catch(() => true);
      if (!alive) dead.push(m.token);
    }),
  );
  return dead;
}
