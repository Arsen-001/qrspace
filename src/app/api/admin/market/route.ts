import { read } from "@/server/db";
import { adminId, adminMarket, forbidden } from "@/server/admin";

/** Маркет для кабинета: все дизайны (и скрытые) с правками и продажами, лоты перепродажи. */
export async function GET() {
  if (!(await adminId())) return forbidden();
  return Response.json(adminMarket(await read()));
}
