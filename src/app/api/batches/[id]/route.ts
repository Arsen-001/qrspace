import type { NextRequest } from "next/server";
import { allCodes } from "@/server/db";
import { currentPerson } from "@/server/session";
import type { Batch, BatchItem } from "@/lib/codes";

/** Партия для печати бирок — с секретами. Только тому, кто её создал. */
export async function GET(_req: NextRequest, ctx: RouteContext<"/api/batches/[id]">) {
  const { id } = await ctx.params;
  const me = await currentPerson();
  const codes = (await allCodes()).filter((c) => c.owner === me && c.auth?.batch === id).sort((a, b) => a.auth!.serial - b.auth!.serial);
  if (!me || !codes.length) return Response.json({ error: "not-found" }, { status: 404 });
  const a = codes[0].auth!;
  const batch: Batch = { batch: id, brand: a.brand, product: a.product, count: codes.length, claimed: codes.filter((c) => c.auth!.holder).length, createdAt: codes[0].createdAt };
  const items: BatchItem[] = codes.map((c) => ({ id: c.id, short: c.short ?? "", serial: c.auth!.serial, secret: c.auth!.secret, claimed: !!c.auth!.holder }));
  return Response.json({ batch, items });
}
