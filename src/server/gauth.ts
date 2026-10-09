// Доступ к API Google от имени сервисного аккаунта (Firebase — уведомления, Google Play — проверка покупок):
// подписанный JWT меняем на токен доступа на час, держим 50 минут.
import { createPrivateKey, sign } from "node:crypto";

type Account = { client_email: string; private_key: string; project_id: string; token_uri?: string };
const cache = new Map<string, { value: string; at: number }>();
const b64url = (v: string | Buffer) => Buffer.from(v).toString("base64url");

export function readAccount(json: string): Account | null {
  try {
    const a = JSON.parse(json) as Account;
    return a.client_email && a.private_key ? a : null;
  } catch {
    return null;
  }
}

/** tokenUrl — для проверок на этом компьютере (подставной Google); иначе — из сервисного аккаунта. */
export async function googleToken(sa: Account, scope: string, tokenUrl?: string): Promise<string | null> {
  const key = `${sa.client_email} ${scope}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < 50 * 60_000) return hit.value;
  const now = Math.floor(Date.now() / 1000);
  const aud = tokenUrl || sa.token_uri || "https://oauth2.googleapis.com/token";
  const head = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = b64url(JSON.stringify({ iss: sa.client_email, scope, aud, iat: now, exp: now + 3600 }));
  const sig = sign("sha256", Buffer.from(`${head}.${claims}`), createPrivateKey(sa.private_key.replace(/\\n/g, "\n")));
  const r = await fetch(aud, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${head}.${claims}.${b64url(sig)}` }),
  }).catch(() => null);
  const j = r?.ok ? ((await r.json()) as { access_token?: string }) : null;
  if (!j?.access_token) return null;
  cache.set(key, { value: j.access_token, at: Date.now() });
  return j.access_token;
}
