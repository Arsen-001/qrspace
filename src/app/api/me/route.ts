import { directory, publicBase } from "@/server/db";
import { currentPerson, endSession, startSession } from "@/server/session";
import { demoEnabled } from "@/server/users";
import { PEOPLE } from "@/lib/people";
import { providers } from "@/server/oauth";

/** Кто я, адрес сайта для ссылок, имена людей, какие входы включены. */
export async function GET(req: Request) {
  return Response.json({ me: await currentPerson(), base: publicBase(req), people: await directory(), demo: demoEnabled(), providers: providers() });
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
