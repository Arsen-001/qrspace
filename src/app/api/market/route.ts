import { sales } from "@/server/db";

/** Сколько продано каждого дизайна (для «осталось N из M»). */
export async function GET() {
  return Response.json({ sold: await sales() });
}
