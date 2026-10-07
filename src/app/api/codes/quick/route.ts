import { kindDefaults, linkBase, mutate, newId, newShort, overDailyLimit, takenShorts } from "@/server/db";
import { currentPerson } from "@/server/session";
import { linkOf, validTarget, type CodeRecord } from "@/lib/codes";
import { readStyle, readText } from "../validate";

/** Название кода из генератора: сайт — его адрес без https://, звонок/почта/SMS — номер или почта, текст — начало. */
function titleOf(target: string | null, text: string): string {
  if (!target) return text.replace(/\s+/g, " ").slice(0, 60);
  const t = target.replace(/^(https?:\/\/|tel:|mailto:|sms:|viber:\/\/chat\?number=)/i, "").replace(/\?.*$/, "");
  return decodeURIComponent(t).replace(/\/$/, "").slice(0, 60);
}

/**
 * Генератор на главной: при скачивании любой код (кроме Wi-Fi, контакта, события) ведёт через нашу короткую ссылку.
 * Сайт, звонок, почта… — код-ссылка (скан сразу переадресует), текст — память с этим текстом, открытая всем.
 * Тот же адрес или текст ещё раз — тот же код (оформление обновляем), чтобы напечатанное не размножалось.
 */
export async function POST(req: Request) {
  const me = await currentPerson();
  if (!me) return Response.json({ error: "login" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const target = typeof body.target === "string" ? body.target.trim() : "";
  const text = readText(body.text);
  if (target ? !validTarget(target) : !text) return Response.json({ error: "bad" }, { status: 400 });
  const style = await readStyle(body.style);
  const at = new Date().toISOString();
  const code = await mutate((db) => {
    const same = db.codes.find((c) =>
      c.owner === me && c.compact && (target ? c.kind === "link" && c.target === target : c.kind === "memory" && c.blocks.length === 1 && c.blocks[0].text === text),
    );
    if (same) {
      if (style) same.style = style;
      return same;
    }
    if (overDailyLimit(db, me, 1)) return null;
    const c: CodeRecord = {
      ...kindDefaults(target ? "link" : "memory"),
      id: newId(),
      short: newShort(takenShorts(db)),
      compact: true,
      owner: me,
      title: titleOf(target || null, text),
      people: [],
      requests: [],
      invite: newId(12),
      blocks: target ? [] : [{ id: newId(), kind: "text", text, media: null, author: me, at }],
      style,
      visits: [],
      createdAt: at,
      ...(target ? { target } : { visibility: "all" as const }),
    };
    db.codes.push(c);
    return c;
  });
  if (!code) return Response.json({ error: "limit" }, { status: 429 });
  return Response.json({ id: code.id, link: linkOf(linkBase(req), code) });
}
