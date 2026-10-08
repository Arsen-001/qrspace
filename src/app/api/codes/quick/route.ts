import { kindDefaults, linkBase, mutate, newId, newShort, overDailyLimit, takenShorts } from "@/server/db";
import { currentPerson } from "@/server/session";
import { linkOf, type CodeRecord } from "@/lib/codes";
import { cleanContent, titleOfContent } from "@/lib/qr/payload";
import { canon } from "@/lib/canon";
import { readStyle } from "../validate";

/**
 * Генератор на главной: при скачивании любой код ведёт через нашу короткую ссылку, а скан открывает нашу страницу
 * с содержимым и кнопками (решение владельца 08.10.2026 — и Wi-Fi, контакт, событие тоже: «чтобы кодом нельзя было
 * пользоваться без нас»). Кто видит — хозяин меняет в «Мои коды» (все / выбранные / только я).
 * То же содержимое ещё раз — тот же код (оформление обновляем), чтобы напечатанное не размножалось.
 */
export async function POST(req: Request) {
  const me = await currentPerson();
  if (!me) return Response.json({ error: "login" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const content = cleanContent(body.content);
  if (!content) return Response.json({ error: "bad" }, { status: 400 });
  const style = await readStyle(body.style);
  const key = canon(content);
  const code = await mutate((db) => {
    // То же содержимое в том же виде — тот же код. Другой вид — новый код: вид скачанного кода не меняется.
    const look = canon(style);
    const same = db.codes.find((c) => c.owner === me && c.compact && c.kind === "link" && c.content && canon(c.content) === key && canon(c.style) === look);
    if (same) return same;
    if (overDailyLimit(db, me, 1)) return null;
    const c: CodeRecord = {
      ...kindDefaults("link"),
      id: newId(),
      short: newShort(takenShorts(db)),
      compact: true,
      owner: me,
      title: titleOfContent(content),
      people: [],
      requests: [],
      invite: newId(12),
      blocks: [],
      style,
      visits: [],
      createdAt: new Date().toISOString(),
      content,
      styleLocked: true,
    };
    db.codes.push(c);
    return c;
  });
  if (!code) return Response.json({ error: "limit" }, { status: 429 });
  return Response.json({ id: code.id, link: linkOf(linkBase(req), code) });
}
