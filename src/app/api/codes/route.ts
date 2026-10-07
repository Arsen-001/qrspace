import { accessOf, allCodes, kindDefaults, linkBase, mutate, newId, viewOf } from "@/server/db";
import { currentPerson } from "@/server/session";
import { ymd, type CodeRecord } from "@/lib/codes";
import { LANGS, tr, type Lang } from "@/lib/i18n";
import { STARTERS } from "@/lib/starters";
import { readKind, readStyle, readTitle } from "./validate";

/** Мои коды и коды, которые мне открыли. */
export async function GET(req: Request) {
  const me = await currentPerson();
  if (!me) return Response.json({ error: "login" }, { status: 401 });
  const codes = await allCodes();
  const newest = (a: CodeRecord, b: CodeRecord) => b.createdAt.localeCompare(a.createdAt);
  return Response.json({
    base: linkBase(req),
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
  // Шаблон: подсказки, напоминания и видимость — на языке человека.
  const st = STARTERS.find((x) => x.id === (body.starter as { id?: unknown } | undefined)?.id && x.kind === code.kind);
  if (st) {
    const raw = (body.starter as { lang?: unknown }).lang;
    const lang: Lang = LANGS.some((l) => l.id === raw) ? (raw as Lang) : "en";
    const at = new Date();
    code.visibility = st.visibility;
    code.publicAdd = !!st.publicAdd;
    code.blocks = st.blocks.map((b, i) => ({ id: newId(), kind: "text" as const, text: tr(b, lang), media: null, author: me, at: new Date(at.getTime() + i).toISOString() }));
    code.tasks = st.tasks.map((t) => ({ id: newId(), text: tr(t.text, lang), due: ymd(new Date(at.getTime() + t.inDays * 86_400_000)), every: t.every, done: [] }));
  }
  await mutate((db) => db.codes.push(code));
  return Response.json(viewOf(code, me));
}
