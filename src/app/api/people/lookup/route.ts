import type { NextRequest } from "next/server";
import { userByEmail } from "@/server/db";
import { currentPerson } from "@/server/session";

/** Найти человека по почте (той, что у него в Google/Apple), чтобы добавить его к коду. Почту не возвращаем. */
export async function GET(req: NextRequest) {
  if (!(await currentPerson())) return Response.json({ error: "login" }, { status: 401 });
  const email = req.nextUrl.searchParams.get("email") ?? "";
  const u = /^\S+@\S+\.\S+$/.test(email) ? await userByEmail(email) : null;
  return u ? Response.json({ id: u.id }) : Response.json({ error: "not-found" }, { status: 404 });
}
