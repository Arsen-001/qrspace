import { directory, findUser, isAdminId, linkBase } from "@/server/db";
import { currentPerson, endSession, startSession } from "@/server/session";
import { demoEnabled } from "@/server/users";
import { PEOPLE } from "@/lib/people";
import { providers } from "@/server/oauth";

/** Кто я, адрес сайта для ссылок, имена людей, какие входы включены. */
export async function GET(req: Request) {
  const me = await currentPerson();
  const colors = (me && (await findUser(me))?.recentColors) || [];
  return Response.json({ me, base: linkBase(req), people: await directory(me), demo: demoEnabled(), providers: providers(), admin: await isAdminId(me), colors });
}

/** Демо-вход (выбрать человека) — только пока DEMO_LOGIN не выключен; personId: null — выйти. */
export async function POST(req: Request) {
  const { personId } = (await req.json().catch(() => ({}))) as { personId?: unknown };
  if (personId === null) {
    await endSession();
    return Response.json({ me: null });
  }
  if (!demoEnabled() || !PEOPLE.some((p) => p.id === personId)) return Response.json({ error: "demo-off" }, { status: 403 });
  await startSession(personId as string);
  return Response.json({ me: personId });
}
