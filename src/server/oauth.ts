// Вход через Google и Apple (OpenID Connect, «код + обмен на сервере»). Ключи — в переменных окружения
// (см. .env.example); пока их нет — кнопка ведёт обратно со словами «ещё не подключено».
// id_token получаем напрямую от Google/Apple по HTTPS — по правилам OpenID этого достаточно без проверки подписи.
import { createHash, createPrivateKey, randomBytes, sign as cryptoSign } from "node:crypto";
import { cookies } from "next/headers";
import { sign, unsign } from "./users";

export type Provider = "google" | "apple";

const env = (k: string) => process.env[k]?.trim() || "";
export const providers = () => ({
  google: !!(env("GOOGLE_CLIENT_ID") && env("GOOGLE_CLIENT_SECRET")),
  apple: !!(env("APPLE_CLIENT_ID") && env("APPLE_TEAM_ID") && env("APPLE_KEY_ID") && env("APPLE_PRIVATE_KEY")),
});

/** Адрес сайта для обратной ссылки: APP_URL при выкладке, иначе — тот, с которого пришли. */
export const appUrl = (req: Request) => env("APP_URL").replace(/\/$/, "") || new URL(req.url).origin;
export const callbackUrl = (req: Request, p: Provider) => `${appUrl(req)}/api/auth/${p}/callback`;

/** Куда вернуть после входа — только страницы нашего сайта. */
export const safeNext = (v: unknown) => (typeof v === "string" && v.startsWith("/") && !v.startsWith("//") && !v.startsWith("/login") ? v : "/account");

const b64url = (b: Buffer) => b.toString("base64url");
const OAUTH_COOKIE = "qr-oauth";
type Pending = { p: Provider; state: string; verifier: string; nonce: string; next: string };

/** Запоминаем state/nonce/PKCE на 10 минут (подписанная cookie). Apple возвращается POST-ом с чужого сайта — SameSite=None. */
export async function begin(p: Provider, next: string): Promise<Pending> {
  const pending: Pending = { p, state: b64url(randomBytes(16)), verifier: b64url(randomBytes(32)), nonce: b64url(randomBytes(16)), next: safeNext(next) };
  const apple = p === "apple";
  (await cookies()).set(OAUTH_COOKIE, await sign(Buffer.from(JSON.stringify(pending)).toString("base64url")), {
    path: "/api/auth",
    httpOnly: true,
    maxAge: 600,
    sameSite: apple ? "none" : "lax",
    secure: apple || process.env.NODE_ENV === "production",
  });
  return pending;
}

export async function finish(p: Provider, state: string | null): Promise<Pending | null> {
  const jar = await cookies();
  const raw = await unsign(jar.get(OAUTH_COOKIE)?.value);
  jar.delete(OAUTH_COOKIE);
  if (!raw) return null;
  const pending = JSON.parse(Buffer.from(raw, "base64url").toString()) as Pending;
  return pending.p === p && state && pending.state === state ? pending : null;
}

export function googleAuthUrl(req: Request, pk: Pending): string {
  const u = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  u.search = new URLSearchParams({
    client_id: env("GOOGLE_CLIENT_ID"),
    redirect_uri: callbackUrl(req, "google"),
    response_type: "code",
    scope: "openid email profile",
    state: pk.state,
    nonce: pk.nonce,
    code_challenge: b64url(createHash("sha256").update(pk.verifier).digest()),
    code_challenge_method: "S256",
    prompt: "select_account",
  }).toString();
  return u.toString();
}

export function appleAuthUrl(req: Request, pk: Pending): string {
  const u = new URL("https://appleid.apple.com/auth/authorize");
  u.search = new URLSearchParams({
    client_id: env("APPLE_CLIENT_ID"),
    redirect_uri: callbackUrl(req, "apple"),
    response_type: "code",
    response_mode: "form_post",
    scope: "name email",
    state: pk.state,
    nonce: pk.nonce,
  }).toString();
  return u.toString();
}

type Claims = { iss: string; aud: string; sub: string; exp: number; nonce?: string; email?: string; email_verified?: boolean | string; name?: string };
const claimsOf = (idToken: string) => JSON.parse(Buffer.from(idToken.split(".")[1] ?? "", "base64url").toString()) as Claims;

function check(c: Claims, iss: string[], aud: string, nonce: string) {
  if (!iss.includes(c.iss) || c.aud !== aud || c.exp * 1000 < Date.now() || c.nonce !== nonce || !c.sub) throw new Error("id_token");
}

/** Только для проверки на этом компьютере: подставной сервер вместо Google/Apple (в production не действует). */
const tokenUrl = (real: string) => (process.env.NODE_ENV !== "production" && env("OAUTH_TEST_TOKEN_URL")) || real;

async function exchange(url: string, body: Record<string, string>): Promise<Claims> {
  const res = await fetch(tokenUrl(url), { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(body) });
  const json = (await res.json()) as { id_token?: string };
  if (!res.ok || !json.id_token) throw new Error("token");
  return claimsOf(json.id_token);
}

export async function googleUser(req: Request, code: string, pk: Pending) {
  const c = await exchange("https://oauth2.googleapis.com/token", {
    code,
    client_id: env("GOOGLE_CLIENT_ID"),
    client_secret: env("GOOGLE_CLIENT_SECRET"),
    redirect_uri: callbackUrl(req, "google"),
    grant_type: "authorization_code",
    code_verifier: pk.verifier,
  });
  check(c, ["https://accounts.google.com", "accounts.google.com"], env("GOOGLE_CLIENT_ID"), pk.nonce);
  const verified = c.email_verified === true || c.email_verified === "true";
  return { sub: c.sub, email: verified ? (c.email ?? "") : "", name: c.name ?? "" };
}

/** Секрет для Apple — короткий JWT, подписанный ключом .p8 (ES256). */
function appleClientSecret(): string {
  const now = Math.floor(Date.now() / 1000);
  const head = b64url(Buffer.from(JSON.stringify({ alg: "ES256", kid: env("APPLE_KEY_ID") })));
  const body = b64url(Buffer.from(JSON.stringify({ iss: env("APPLE_TEAM_ID"), iat: now, exp: now + 300, aud: "https://appleid.apple.com", sub: env("APPLE_CLIENT_ID") })));
  const key = createPrivateKey(env("APPLE_PRIVATE_KEY").replace(/\\n/g, "\n"));
  const sig = cryptoSign("sha256", Buffer.from(`${head}.${body}`), { key, dsaEncoding: "ieee-p1363" });
  return `${head}.${body}.${b64url(sig)}`;
}

/** Apple присылает имя только при первом входе (в поле user) — берём его оттуда. */
export async function appleUser(req: Request, code: string, pk: Pending, userJson: string | null) {
  const c = await exchange("https://appleid.apple.com/auth/token", {
    code,
    client_id: env("APPLE_CLIENT_ID"),
    client_secret: appleClientSecret(),
    redirect_uri: callbackUrl(req, "apple"),
    grant_type: "authorization_code",
  });
  check(c, ["https://appleid.apple.com"], env("APPLE_CLIENT_ID"), pk.nonce);
  let name = "";
  try {
    const n = (JSON.parse(userJson ?? "{}") as { name?: { firstName?: string; lastName?: string } }).name;
    name = [n?.firstName, n?.lastName].filter(Boolean).join(" ");
  } catch {}
  return { sub: c.sub, email: c.email ?? "", name };
}
