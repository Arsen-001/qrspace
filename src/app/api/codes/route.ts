import { accessOf, allCodes, kindDefaults, mutate, newId, publicBase, viewOf } from "@/server/db";
import { currentPerson } from "@/server/session";
import type { CodeRecord } from "@/lib/codes";
import { readKind, readStyle, readTitle } from "./validate";

/** Мои коды и коды, которые мне открыли. */
export async function GET(req: Request) {
  const me = await currentPerson();
  if (!me) return Response.json({ error: "login" }, { status: 401 });
  const codes = await allCodes();
  const newest = (a: CodeRecord, b: CodeRecord) => b.createdAt.localeCompare(a.createdAt);
  return Response.json({
    base: publicBase(req),
    // Вещи партий (защита от подделок) — не в общем списке, а в «Защите от подделок».
    mine: codes.filter((c) => c.owner === me && c.kind !== "item").sort(newest).map((c) => viewOf(c, me)),
    items: codes.filter((c) => c.auth?.holder === me).map((c) => viewOf(c, me)),
    shared: codes
      .filter((c) => c.owner !== me && c.people.some((p) => p.personId === me) && accessOf(c, me) !== "closed")
      .sort(newest)
      .map((c) => viewOf(c, me)),
  });
}

export async function POST(req: Request) {
  const me = await currentPerson();
  if (!me) return Response.json({ error: "login" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const title = readTitle(body.title);
  if (!title) return Response.json({ error: "title" }, { status: 400 });
  const code: CodeRecord = {
    // Новая память — закрытая: человек сам решит, кому открыть. Остальное — по шаблону.
    ...kindDefaults(readKind(body.kind)),
    id: newId(),
    owner: me,
    title,
    people: [],
    requests: [],
    invite: newId(12),
    blocks: [],
    style: await readStyle(body.style),
    visits: [],
    createdAt: new Date().toISOString(),
  };
  await mutate((db) => db.codes.push(code));
  return Response.json(viewOf(code, me));
}
