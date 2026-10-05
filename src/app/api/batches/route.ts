import { kindDefaults, mutate, newId, newSecret, newShort, takenShorts } from "@/server/db";
import { currentPerson } from "@/server/session";
import type { Batch, CodeRecord } from "@/lib/codes";
import { readShort } from "../codes/validate";

/** Мои партии вещей (защита от подделок): сколько кодов и сколько уже зарегистрировали покупатели. */
export async function GET() {
  const me = await currentPerson();
  if (!me) return Response.json({ error: "login" }, { status: 401 });
  const batches = await mutate((db) => {
    const map = new Map<string, Batch>();
    for (const c of db.codes) {
      if (c.owner !== me || !c.auth) continue;
      const b = map.get(c.auth.batch) ?? { batch: c.auth.batch, brand: c.auth.brand, product: c.auth.product, count: 0, claimed: 0, createdAt: c.createdAt };
      b.count += 1;
      if (c.auth.holder) b.claimed += 1;
      map.set(c.auth.batch, b);
    }
    return [...map.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  });
  return Response.json(batches);
}

/** Новая партия: N вещей, у каждой свой код (маленький — для бирки) и свой секрет. */
export async function POST(req: Request) {
  const me = await currentPerson();
  if (!me) return Response.json({ error: "login" }, { status: 401 });
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const brand = readShort(b.brand, 60);
  const product = readShort(b.product, 80);
  const count = Number(b.count);
  if (!brand || !product || !Number.isInteger(count) || count < 1 || count > 500) return Response.json({ error: "bad" }, { status: 400 });
  const batch = newId(10);
  const at = new Date().toISOString();
  const result = await mutate((db) => {
    const taken = takenShorts(db);
    const codes: CodeRecord[] = Array.from({ length: count }, (_, i) => ({
      ...kindDefaults("item"),
      id: newId(),
      owner: me,
      title: `${product} № ${i + 1}`,
      people: [],
      requests: [],
      invite: newId(12),
      blocks: [],
      style: null,
      visits: [],
      createdAt: at,
      short: newShort(taken),
      compact: true,
      auth: { batch, brand, product, serial: i + 1, secret: newSecret(), holder: null, claimedAt: null, transferable: false },
    }));
    codes.forEach((c) => taken.add(c.short!));
    db.codes.push(...codes);
    // Защита от подделок — пакет «Про» в заказах брендов; здесь — демо без оплаты.
    return { batch, brand, product, count, claimed: 0, createdAt: at } satisfies Batch;
  });
  return Response.json(result);
}
