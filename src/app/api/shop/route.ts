import { isDesignerId, mutate, newId, shopOrders } from "@/server/db";
import { currentPerson } from "@/server/session";
import { PRODUCT_IDS, PRODUCTS, priceOf, type ProductId, type ShopOrder } from "@/lib/shop";
import { readShort } from "../codes/validate";

/** Мои заказы; сотруднику (дизайнеру) с ?all=1 — все, чтобы вести печать и отправку. */
export async function GET(req: Request) {
  const me = await currentPerson();
  if (!me) return Response.json({ error: "login" }, { status: 401 });
  const all = new URL(req.url).searchParams.has("all") && (await isDesignerId(me));
  return Response.json([...(await shopOrders())].filter((o) => all || o.person === me).reverse());
}

/** Заказ товара с моим кодом (оплата — демо; печать по требованию подключим позже). */
export async function POST(req: Request) {
  const me = await currentPerson();
  if (!me) return Response.json({ error: "login" }, { status: 401 });
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const product = (PRODUCT_IDS as unknown[]).includes(b.product) ? (b.product as ProductId) : null;
  const variant = typeof b.variant === "string" && product && (PRODUCTS[product].variants as readonly string[]).includes(b.variant) ? b.variant : null;
  const qty = Number(b.qty);
  const a = (b.address ?? {}) as Record<string, unknown>;
  const address = { name: readShort(a.name, 80), phone: readShort(a.phone, 30), city: readShort(a.city, 60), street: readShort(a.street, 120) };
  if (!product || !variant || !Number.isInteger(qty) || qty < 1 || qty > 50 || !address.name || !address.phone || !address.city || !address.street) {
    return Response.json({ error: "bad" }, { status: 400 });
  }
  const result = await mutate((db) => {
    if (!db.codes.some((c) => c.id === b.code && c.owner === me)) return 403;
    const o: ShopOrder = { id: newId(), person: me, product, variant, code: b.code as string, qty, total: priceOf(product, variant, qty), address, status: "paid", createdAt: new Date().toISOString() };
    db.shop.push(o);
    return o;
  });
  return typeof result === "number" ? Response.json({ error: result }, { status: result }) : Response.json(result);
}
