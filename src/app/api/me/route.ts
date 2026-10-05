import { cookies } from "next/headers";
import { isPerson, publicBase } from "@/server/db";
import { currentPerson, SESSION_COOKIE } from "@/server/session";

export async function GET(req: Request) {
  return Response.json({ me: await currentPerson(), base: publicBase(req) });
}

/** Войти демо-человеком или выйти (personId: null). */
export async function POST(req: Request) {
  const { personId } = (await req.json().catch(() => ({}))) as { personId?: unknown };
  const jar = await cookies();
  if (isPerson(personId)) {
    jar.set(SESSION_COOKIE, personId, { path: "/", sameSite: "lax", httpOnly: true, maxAge: 60 * 60 * 24 * 365 });
    return Response.json({ me: personId });
  }
  jar.delete(SESSION_COOKIE);
  return Response.json({ me: null });
}
