import { backupNow } from "@/server/backup";

export const maxDuration = 120;

/** Vercel Cron зовёт раз в сутки с «Authorization: Bearer $CRON_SECRET». Без CRON_SECRET маршрут закрыт для всех. */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return new Response(null, { status: 401 });
  return Response.json(await backupNow());
}
