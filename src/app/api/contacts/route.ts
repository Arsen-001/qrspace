import type { NextRequest } from "next/server";
import { mutate } from "@/server/db";
import { currentPerson } from "@/server/session";
import { usable } from "@/server/users";

/** «Мои контакты»: кого я добавил по почте. Код с видимостью «Мои контакты» открыт только им. */
export async function GET() {
  const me = await currentPerson();
  if (!me) return Response.json({ error: "login" }, { status: 401 });
  return Response.json(await mutate((db) => db.users.find((u) => u.id === me)?.contacts ?? []));
}

export async function POST(req: NextRequest) {
  const me = await currentPerson();
  if (!me) return Response.json({ error: "login" }, { status: 401 });
  const { email } = (await req.json().catch(() => ({}))) as { email?: unknown };
  const e = typeof email === "string" ? email.trim().toLowerCase() : "";
  const result = await mutate((db) => {
    const other = usable(db).find((u) => u.email.toLowerCase() === e);
    const self = db.users.find((u) => u.id === me)!;
    if (!other) return 404;
    if (other.id === me) return 400;
    self.contacts = [...new Set([...(self.contacts ?? []), other.id])];
    return self.contacts;
  });
  return typeof result === "number" ? Response.json({ error: result }, { status: result }) : Response.json(result);
}

export async function DELETE(req: NextRequest) {
  const me = await currentPerson();
  if (!me) return Response.json({ error: "login" }, { status: 401 });
  const id = req.nextUrl.searchParams.get("id");
  const list = await mutate((db) => {
    const self = db.users.find((u) => u.id === me)!;
    self.contacts = (self.contacts ?? []).filter((c) => c !== id);
    return self.contacts;
  });
  return Response.json(list);
}
