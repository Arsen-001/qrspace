// Уведомления на телефон (приложения iOS и Android): то же, что колокольчик на сайте, — сообщение по коду, просьба
// доступа, ставка, напоминание. iPhone — через Apple (APNs, ключ .p8), Android — через Firebase (FCM v1, сервисный
// аккаунт). Пока ключей нет (их заводит владелец) — ничего не отправляем и ничего лишнего не делаем.
import { createPrivateKey, sign } from "node:crypto";
import http2 from "node:http2";
import { googleToken, readAccount } from "./gauth";

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

// Firebase: токен доступа сервисного аккаунта (gauth — общий с проверкой покупок Google Play).
async function fcmToken(): Promise<{ value: string; project: string } | null> {
  const sa = readAccount(env("FCM_SERVICE_ACCOUNT"));
  const value = sa && (await googleToken(sa, "https://www.googleapis.com/auth/firebase.messaging", test("FCM_TEST_TOKEN_URL")));
  return sa && value ? { value, project: sa.project_id } : null;
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
