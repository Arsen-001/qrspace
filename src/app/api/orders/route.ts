import { allOrders, designerIdsIn, isDesignerId, mutate, newId, notify } from "@/server/db";
import { currentPerson } from "@/server/session";
import { NEEDS, PACKAGES, type Need, type Order, type Pkg } from "@/lib/orders";
import { storeImage } from "@/server/assets";
import { readShort, readText } from "../codes/validate";

/** Мои заказы; дизайнеру — все. Новые сверху. */
export async function GET() {
  const me = await currentPerson();
  if (!me) return Response.json({ error: "login" }, { status: 401 });
  const designer = await isDesignerId(me);
  const orders = (await allOrders()).filter((o) => designer || o.client === me);
  return Response.json([...orders].reverse());
}

/** Заявка от бренда (пакет оплачивается сразу — демо). */
export async function POST(req: Request) {
  const me = await currentPerson();
  if (!me) return Response.json({ error: "login" }, { status: 401 });
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const brand = readShort(b.brand, 60);
  const contact = readShort(b.contact, 100);
  const need = (NEEDS as readonly unknown[]).includes(b.need) ? (b.need as Need) : null;
  const pkg = b.pkg === "start" || b.pkg === "pro" ? (b.pkg as Pkg) : null;
  const qty = Number(b.qty);
  const deadline = typeof b.deadline === "string" && /^\d{4}-\d{2}-\d{2}$/.test(b.deadline) ? b.deadline : null;
  const logo = typeof b.logo === "string" && /^data:image\/(png|jpeg);base64,[A-Za-z0-9+/]+={0,2}$/.test(b.logo) && b.logo.length < 600_000 ? await storeImage(b.logo) : null;
  if (!brand || !contact || !need || !pkg || !Number.isInteger(qty) || qty < 1 || qty > 1_000_000) return Response.json({ error: "bad" }, { status: 400 });
  const at = new Date().toISOString();
  const order: Order = {
    id: newId(),
    client: me,
    brand,
    contact,
    need,
    qty,
    pkg,
    deadline,
    notes: readText(b.notes).slice(0, 2000),
    logo,
    status: "new",
    thread: [],
    design: null,
    codes: 0,
    createdAt: at,
  };
  await mutate((db) => {
    db.orders.push(order);
    designerIdsIn(db).forEach((d) => notify(db, d, me, "orderNew", { who: me, brand }, `/brand/${order.id}`));
    db.purchases.push({ person: me, key: `code:order-${order.id}`, tier: "styled", price: PACKAGES[pkg], free: false, at });
  });
  return Response.json(order);
}
