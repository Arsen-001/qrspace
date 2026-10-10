import type { NextRequest } from "next/server";
import { CODE_FILTERS, type CodeFilter } from "@/lib/admin";
import { read } from "@/server/db";
import { adminId, bad, codeRows, forbidden, readQuery } from "@/server/admin";

/** Все коды: ?q= — название, короткая ссылка, id, хозяин, куда ведёт; ?filter= all | blocked | reported. */
export async function GET(req: NextRequest) {
  if (!(await adminId())) return forbidden();
  const filter = req.nextUrl.searchParams.get("filter") ?? "all";
  if (!(CODE_FILTERS as readonly string[]).includes(filter)) return bad();
  return Response.json(codeRows(await read(), readQuery(req.nextUrl.searchParams.get("q")), filter as CodeFilter));
}
