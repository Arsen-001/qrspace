import { randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { mutate } from "@/server/db";
import { currentPerson } from "@/server/session";

const TTL = 5 * 60_000;

/**
 * Вход в приложении (iOS, Android): приложение открывает в своём браузере /api/auth/google?next=/app/callback (или Apple,
 * или /login?next=/app/callback); после входа сюда — выдаём одноразовый код на 5 минут и возвращаем в приложение
 * qrspace://auth?token=…; приложение меняет код на свою сессию (POST /api/auth/token). Cookie браузера в приложение не
 * попадают — поэтому так.
 */
export async function GET(req: NextRequest) {
  const me = await currentPerson();
  if (!me) return NextResponse.redirect(new URL("/login?next=/app/callback", req.url));
  const token = randomBytes(24).toString("base64url");
  await mutate((db) => {
    const now = Date.now();
    db.appTokens = db.appTokens.filter((x) => Date.parse(x.until) > now);
    db.appTokens.push({ token, person: me, until: new Date(now + TTL).toISOString() });
  });
  return new Response(null, { status: 302, headers: { location: `qrspace://auth?token=${token}`, "cache-control": "no-store" } });
}
