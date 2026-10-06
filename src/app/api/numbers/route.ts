import type { NextRequest } from "next/server";
import { allCodes, kindDefaults, mutate, newId, viewOf } from "@/server/db";
import { currentPerson } from "@/server/session";
import type { CodeRecord } from "@/lib/codes";
import { NUMBER_DESIGN, NUMBERS_MAX, priceOfNumber, SHOWCASE, tierOf, validNumber } from "@/lib/numbers";

const takenNumbers = (codes: CodeRecord[]) => new Map(codes.filter((c) => c.edition?.design === NUMBER_DESIGN).map((c) => [c.edition!.no, c]));

/**
 * ?n=777 — свободен ли номер и сколько стоит (занят — кто хозяин и id кода, если он продаётся, см. лоты).
 * Без n — витрина: красивые свободные номера и недавно купленные.
 */
export async function GET(req: NextRequest) {
  const codes = await allCodes();
  const taken = takenNumbers(codes);
  const q = req.nextUrl.searchParams.get("n");
  if (q !== null) {
    const n = Number(q);
    if (!validNumber(n)) return Response.json({ error: "bad" }, { status: 400 });
    const c = taken.get(n);
    return Response.json({ n, tier: tierOf(n), price: priceOfNumber(n), free: !c, owner: c?.owner ?? null, code: c?.id ?? null });
  }
  const recent = [...taken.values()]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 12)
    .map((c) => ({ n: c.edition!.no, at: c.createdAt, owner: c.owner, code: c.id }));
  const showcase = SHOWCASE.map((n) => ({ n, tier: tierOf(n), price: priceOfNumber(n), free: !taken.has(n) }));
  return Response.json({ recent, showcase, sold: taken.size, max: NUMBERS_MAX });
}

/** Купить номер (оплата — демо): код с памятью, номер навсегда за хозяином, пока он сам не продаст. */
export async function POST(req: NextRequest) {
  const me = await currentPerson();
  if (!me) return Response.json({ error: "login" }, { status: 401 });
  const { n } = (await req.json().catch(() => ({}))) as { n?: unknown };
  if (!validNumber(n)) return Response.json({ error: "bad" }, { status: 400 });
  const result = await mutate((db) => {
    if (takenNumbers(db.codes).has(n)) return 409;
    const at = new Date().toISOString();
    const price = priceOfNumber(n);
    const code: CodeRecord = {
      ...kindDefaults("memory"),
      id: newId(),
      owner: me,
      title: `№ ${n}`,
      people: [],
      requests: [],
      invite: newId(12),
      blocks: [],
      style: null,
      visits: [],
      createdAt: at,
      edition: { design: NUMBER_DESIGN, no: n, of: NUMBERS_MAX },
      owners: [{ person: me, at, price }],
    };
    db.codes.push(code);
    db.purchases.push({ person: me, key: `code:${code.id}`, tier: "styled", price, free: false, at });
    return viewOf(code, me);
  });
  return typeof result === "number" ? Response.json({ error: result }, { status: result }) : Response.json(result);
}
