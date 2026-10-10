import { read } from "@/server/db";
import { adminId, forbidden, purchases } from "@/server/admin";

/** Покупки: итоги (оборот, сайт / App Store / Google Play, перепродажи и комиссия, проверочные) и последние 300. */
export async function GET() {
  if (!(await adminId())) return forbidden();
  return Response.json(purchases(await read()));
}
