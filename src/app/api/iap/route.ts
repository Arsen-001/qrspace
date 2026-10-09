import { findCode, mutate } from "@/server/db";
import { extendSpace, grantPack } from "@/server/grants";
import { verifyApple, verifyGoogle, type Verified } from "@/server/iap";
import { currentPerson } from "@/server/session";
import { PRICES } from "@/lib/pricing";
import { CODE_PACKS } from "@/lib/packs";
import { FREE_STORAGE, STORAGE_PLANS, storageOf } from "@/lib/codes";
import { matches, type IapIntent } from "@/lib/iap";

function readIntent(v: unknown): IapIntent | null {
  const i = v as Record<string, unknown> | null;
  if (!i || typeof i !== "object") return null;
  if (i.kind === "code" && typeof i.key === "string" && /^(g|code):[\w-]{1,40}$/.test(i.key) && (i.tier === "simple" || i.tier === "styled")) return { kind: "code", key: i.key, tier: i.tier };
  if (i.kind === "pack" && typeof i.plan === "string") return { kind: "pack", plan: i.plan };
  if (i.kind === "space" && typeof i.code === "string" && typeof i.plan === "string") return { kind: "space", code: i.code, plan: i.plan };
  return null;
}

/**
 * Покупка в приложении (App Store / Google Play): приложение присылает подписанную покупку (Apple) или токен (Google)
 * и что покупали; сервер проверяет у Apple / Google, засчитывает один раз и выдаёт то же, что оплата на сайте:
 * код (оплата по ключу — дальше /api/codes/quick), пакет кодов, месяц места для своего кода. Цена в данных — цена
 * сайта (настоящую сумму в валюте видно в отчётах магазина); проверочные покупки — без выручки.
 * 402 — покупка не подтвердилась, 409 — уже засчитана (закрыть её в приложении), 422 — товар не тот, что покупали;
 * место: 403/404 — не свой или нет кода, 413 — занятое не влезает (покупку не закрывать — деньги не пропадут).
 */
export async function POST(req: Request) {
  const me = await currentPerson();
  if (!me) return Response.json({ error: "login" }, { status: 401 });
  const b = (await req.json().catch(() => ({}))) as { platform?: unknown; jws?: unknown; productId?: unknown; purchaseToken?: unknown; intent?: unknown };
  const intent = readIntent(b.intent);
  if (!intent) return Response.json({ error: "bad" }, { status: 400 });
  // Место — для своего кода, куда уже занятое влезает: проверяем до магазина (Google «гасит» покупку при проверке —
  // нельзя, чтобы человек заплатил, а выдать было нечего).
  if (intent.kind === "space") {
    const c = await findCode(intent.code);
    const plan = STORAGE_PLANS.find((p) => p.id === intent.plan);
    if (!c || !plan) return Response.json({ error: "space" }, { status: 404 });
    if (c.owner !== me) return Response.json({ error: "space" }, { status: 403 });
    // 413, а не 409: 409 значит «покупка уже засчитана» — приложение тогда закрывает её, а тут деньги бы пропали.
    if (storageOf(c).used > Math.max(FREE_STORAGE, plan.bytes)) return Response.json({ error: "space" }, { status: 413 });
  }
  let v: Verified | null = null;
  if (b.platform === "ios" && typeof b.jws === "string" && b.jws.length < 20_000) v = verifyApple(b.jws);
  else if (b.platform === "android" && typeof b.productId === "string" && typeof b.purchaseToken === "string") v = await verifyGoogle(b.productId, b.purchaseToken);
  else return Response.json({ error: "bad" }, { status: 400 });
  if (!v) return Response.json({ error: "unverified" }, { status: 402 });
  if (!matches(v.product, intent)) return Response.json({ error: "product" }, { status: 422 });
  const verified = v;
  const store = b.platform === "ios" ? ("apple" as const) : ("google" as const);

  const result = await mutate((db) => {
    if (db.iap.some((x) => x.id === verified.id)) return 409;
    const paid = { store, ...(verified.test && { test: true }) };
    if (intent.kind === "code") {
      db.purchases.push({ person: me, key: intent.key, tier: intent.tier, price: verified.test ? 0 : PRICES[intent.tier], free: false, at: new Date().toISOString(), ...paid });
    } else if (intent.kind === "pack") {
      const plan = CODE_PACKS.find((p) => p.id === intent.plan)!;
      grantPack(db, me, plan.id, { price: verified.test ? 0 : plan.price, ...paid });
    } else {
      const plan = STORAGE_PLANS.find((p) => p.id === intent.plan)!;
      const err = extendSpace(db, me, intent.code, plan.id, { price: verified.test ? 0 : plan.price, ...paid });
      // Место купили, а код не тот (чужой, удалён, занято больше) — покупку не засчитываем, приложение покажет ошибку.
      if (err) return err;
    }
    db.iap.push({ id: verified.id, store, product: verified.product, person: me, at: new Date().toISOString(), ...(verified.test && { test: true }) });
    return 200;
  });
  if (result === 409) return Response.json({ error: "used" }, { status: 409 });
  if (result !== 200) return Response.json({ error: "space" }, { status: result === 409 ? 413 : result });
  return Response.json({ ok: true });
}
