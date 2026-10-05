import { kindDefaults, mutate, newId, viewOf } from "@/server/db";
import { currentPerson } from "@/server/session";
import type { CodeRecord } from "@/lib/codes";
import { readKind, readShort, readStyle } from "../validate";

/** Набор пустых меток: N кодов с памятью разом («Метка 1…N») — наклеить, а память заполнить потом. */
export async function POST(req: Request) {
  const me = await currentPerson();
  if (!me) return Response.json({ error: "login" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const count = Number(body.count);
  const prefix = readShort(body.prefix, 40);
  if (!Number.isInteger(count) || count < 1 || count > 100 || !prefix) return Response.json({ error: "bad" }, { status: 400 });
  const kind = readKind(body.kind);
  const style = await readStyle(body.style);
  const now = Date.now();
  const codes: CodeRecord[] = Array.from({ length: count }, (_, i) => ({
    ...kindDefaults(kind),
    id: newId(),
    owner: me,
    title: `${prefix} ${i + 1}`,
    people: [],
    requests: [],
    invite: newId(12),
    blocks: [],
    style,
    visits: [],
    // Порядок в списке — как номера: «Метка 1» первой.
    createdAt: new Date(now - i).toISOString(),
  }));
  await mutate((db) => db.codes.push(...codes));
  return Response.json(codes.map((c) => viewOf(c, me)));
}
