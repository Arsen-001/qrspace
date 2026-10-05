import { accessOf, allCodes, mutate, noticesFor } from "@/server/db";
import { currentPerson } from "@/server/session";
import { daysLeft } from "@/lib/codes";

/** Мои уведомления (последние 30) + сколько дел на сегодня и просрочено (по моим кодам и где можно дописывать). */
export async function GET() {
  const me = await currentPerson();
  if (!me) return Response.json({ error: "login" }, { status: 401 });
  const mine = await noticesFor(me);
  const due = (await allCodes())
    .filter((c) => ["owner", "edit"].includes(accessOf(c, me)))
    .flatMap((c) => c.tasks)
    .filter((t) => daysLeft(t.due) <= 0).length;
  return Response.json({ items: mine.slice(-30).reverse(), unread: mine.filter((n) => !n.read).length, due });
}

/** Отметить все прочитанными. */
export async function POST() {
  const me = await currentPerson();
  if (!me) return Response.json({ error: "login" }, { status: 401 });
  await mutate((db) => db.notifications.forEach((n) => n.to === me && (n.read = true)));
  return Response.json({ ok: true });
}
