// Проверка покупок в приложениях (владелец 09.10.2026: «встроенная оплата Apple Google»). Покупке из приложения не
// верим — проверяем у самих Apple и Google; одна покупка засчитывается один раз (номер покупки — в db.iap).
import { createHash, X509Certificate, verify } from "node:crypto";
import { APP_BUNDLE } from "@/lib/iap";
import { googleToken, readAccount } from "./gauth";

const env = (k: string) => process.env[k]?.trim() || "";
const local = () => process.env.NODE_ENV !== "production";

export type Verified = { id: string; product: string; test: boolean };

// Apple Root CA - G3 (apple.com/certificateauthority): отпечаток SHA-256 его сертификата.
const APPLE_ROOT_G3 = "63343abfb89a6a03ebb57e9b3f5fa7be7c4f5c756f3017b3a8c488c3653e9179";
// Метки Apple в сертификатах: подпись покупок App Store (лист) и промежуточный центр Apple WWDR. Без них подпись мог бы
// поставить любой разработчик своим сертификатом Apple — цепочка к корню Apple у него тоже есть.
const OID_LEAF = Buffer.from("060a2a864886f763640b01", "hex"); // 1.2.840.113635.100.6.11.1
const OID_INTERMEDIATE = Buffer.from("060a2a864886f76364060201", "hex"); // 1.2.840.113635.100.6.2.1

const der = (b64: string) => new X509Certificate(Buffer.from(b64, "base64"));

/**
 * Apple (StoreKit 2): Transaction.jwsRepresentation — подпись ES256, сертификаты в заголовке (x5c). Проверяем цепочку до
 * корня Apple (по отпечатку), метки Apple, сроки, саму подпись; товар — нашего приложения, покупку не отменили.
 * Покупки из Xcode (StoreKit Testing) подписаны сертификатом самого Xcode — их принимаем только на этом компьютере
 * с IAP_ALLOW_XCODE=1.
 */
export function verifyApple(jws: string): Verified | null {
  const [h, p, s] = jws.split(".");
  if (!h || !p || !s) return null;
  let head: { alg?: string; x5c?: string[] };
  let tx: { bundleId?: string; productId?: string; transactionId?: string; environment?: string; revocationDate?: number; signedDate?: number };
  try {
    head = JSON.parse(Buffer.from(h, "base64url").toString());
    tx = JSON.parse(Buffer.from(p, "base64url").toString());
  } catch {
    return null;
  }
  if (head.alg !== "ES256" || !head.x5c?.length) return null;
  const xcode = tx.environment === "Xcode";
  if (xcode && !(local() && env("IAP_ALLOW_XCODE") === "1")) return null;
  let leaf: X509Certificate;
  try {
    leaf = der(head.x5c[0]);
    if (!xcode) {
      if (head.x5c.length !== 3) return null;
      const mid = der(head.x5c[1]);
      const root = der(head.x5c[2]);
      if (createHash("sha256").update(root.raw).digest("hex") !== APPLE_ROOT_G3) return null;
      if (!leaf.verify(mid.publicKey) || !mid.verify(root.publicKey)) return null;
      if (!leaf.raw.includes(OID_LEAF) || !mid.raw.includes(OID_INTERMEDIATE)) return null;
      const at = tx.signedDate ?? Date.now();
      for (const c of [leaf, mid]) if (at < Date.parse(c.validFrom) || at > Date.parse(c.validTo)) return null;
    }
  } catch {
    return null;
  }
  if (!verify("sha256", Buffer.from(`${h}.${p}`), { key: leaf.publicKey, dsaEncoding: "ieee-p1363" }, Buffer.from(s, "base64url"))) return null;
  if (tx.bundleId !== APP_BUNDLE || !tx.productId || !tx.transactionId || tx.revocationDate) return null;
  return { id: `apple:${tx.transactionId}`, product: tx.productId, test: tx.environment !== "Production" };
}

/**
 * Google Play: спрашиваем у Google, куплен ли товар по этому токену (сервисный аккаунт с доступом к Play Console —
 * GOOGLE_PLAY_SERVICE_ACCOUNT), и сами «гасим» покупку (consume) — второй раз её не предъявить. purchaseType 0 —
 * проверочная покупка (тестировщики) — не выручка.
 */
export async function verifyGoogle(product: string, token: string): Promise<Verified | null> {
  const sa = readAccount(env("GOOGLE_PLAY_SERVICE_ACCOUNT"));
  if (!sa || !/^[\w.-]{1,150}$/.test(product) || !/^[\w.:-]{10,1000}$/.test(token)) return null;
  const access = await googleToken(sa, "https://www.googleapis.com/auth/androidpublisher", local() ? env("GOOGLE_PLAY_TEST_TOKEN_URL") : undefined);
  if (!access) return null;
  const base = (local() && env("GOOGLE_PLAY_TEST_URL")) || "https://androidpublisher.googleapis.com";
  const url = `${base}/androidpublisher/v3/applications/${APP_BUNDLE}/purchases/products/${encodeURIComponent(product)}/tokens/${encodeURIComponent(token)}`;
  const r = await fetch(url, { headers: { authorization: `Bearer ${access}` } }).catch(() => null);
  if (!r?.ok) return null;
  const p = (await r.json()) as { purchaseState?: number; consumptionState?: number; orderId?: string; purchaseType?: number };
  if (p.purchaseState !== 0 || p.consumptionState === 1) return null;
  const done = await fetch(`${url}:consume`, { method: "POST", headers: { authorization: `Bearer ${access}` } }).catch(() => null);
  if (!done?.ok) return null;
  return { id: `google:${p.orderId ?? createHash("sha256").update(token).digest("hex")}`, product, test: p.purchaseType === 0 };
}
