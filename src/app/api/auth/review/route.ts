import { mutate } from "@/server/db";
import { clientKey, REVIEW_TRIES, REVIEW_WINDOW, reviewMatches, reviewUser } from "@/server/review";
import { startSession } from "@/server/session";
import { reviewAccount } from "@/server/users";

/**
 * Вход проверяющих App Store / Google Play: логин и код из заметок к проверке (src/server/review.ts). Выключен — 404.
 * 5 неверных попыток с одного адреса за 15 минут — дальше 429, даже с верным кодом.
 */
export async function POST(req: Request) {
  if (!reviewAccount()) {
    if (process.env.REVIEW_LOGIN) console.warn("review login is off: REVIEW_LOGIN_CODE must be at least 8 characters");
    return Response.json({ error: "off" }, { status: 404 });
  }
  const body = (await req.json().catch(() => ({}))) as { login?: unknown; code?: unknown };
  const login = typeof body.login === "string" ? body.login.slice(0, 200) : "";
  const code = typeof body.code === "string" ? body.code.slice(0, 200) : "";
  const ok = reviewMatches(login, code);
  const ip = clientKey(req);
  const user = await mutate((db) => {
    const now = Date.now();
    db.reviewTries = db.reviewTries.filter((t) => now - Date.parse(t.at) < REVIEW_WINDOW);
    if (db.reviewTries.filter((t) => t.ip === ip).length >= REVIEW_TRIES) return 429;
    if (!ok) {
      db.reviewTries.push({ ip, at: new Date(now).toISOString() });
      return 401;
    }
    return reviewUser(db, now);
  });
  if (user === 429) return Response.json({ error: "tries" }, { status: 429 });
  if (user === 401) return Response.json({ error: "wrong" }, { status: 401 });
  await startSession(user.id);
  console.info("review login used");
  return Response.json({ me: user.id });
}
