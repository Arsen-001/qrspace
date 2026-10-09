import { mutate } from "@/server/db";
import { startSession } from "@/server/session";

/** Приложение меняет одноразовый код (см. /app/callback) на свою сессию. Код — один раз и 5 минут. */
export async function POST(req: Request) {
  const { token } = (await req.json().catch(() => ({}))) as { token?: unknown };
  if (typeof token !== "string" || token.length < 20) return Response.json({ error: "bad" }, { status: 400 });
  const person = await mutate((db) => {
    const i = db.appTokens.findIndex((x) => x.token === token);
    if (i < 0) return null;
    const [t] = db.appTokens.splice(i, 1);
    return Date.parse(t.until) > Date.now() && db.users.some((u) => u.id === t.person) ? t.person : null;
  });
  if (!person) return Response.json({ error: "token" }, { status: 401 });
  await startSession(person);
  return Response.json({ me: person });
}
