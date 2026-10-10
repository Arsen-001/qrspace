import type { NextRequest } from "next/server";
import { USER_FILTERS, type UserFilter } from "@/lib/admin";
import { read } from "@/server/db";
import { adminId, bad, forbidden, readQuery, userRows } from "@/server/admin";

/** Люди: ?q= — имя или почта, ?filter= all | real | demo | blocked. Почты демо-людей и аккаунта проверки — пустые. */
export async function GET(req: NextRequest) {
  if (!(await adminId())) return forbidden();
  const filter = req.nextUrl.searchParams.get("filter") ?? "all";
  if (!(USER_FILTERS as readonly string[]).includes(filter)) return bad();
  return Response.json(userRows(await read(), readQuery(req.nextUrl.searchParams.get("q")), filter as UserFilter));
}
