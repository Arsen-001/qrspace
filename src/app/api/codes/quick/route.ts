import { kindDefaults, linkBase, mutate, newId, newShort, overDailyLimit, takenShorts } from "@/server/db";
import { currentPerson } from "@/server/session";
import { linkOf, type CodeRecord } from "@/lib/codes";
import { cleanContent, titleOfContent } from "@/lib/qr/payload";
import { tierOf } from "@/lib/pricing";
import { DEFAULT_STYLE } from "@/lib/qr/style";
import { canon } from "@/lib/canon";
import { readStyle, readTitle } from "../validate";

/**
 * Генератор на главной: при скачивании любой код ведёт через нашу короткую ссылку, а скан открывает нашу страницу
 * с содержимым и кнопками (решение владельца 08.10.2026 — и Wi-Fi, контакт, событие тоже: «чтобы кодом нельзя было
 * пользоваться без нас»). Кто видит — хозяин меняет в «Мои коды» (все / выбранные / только я).
 * То же содержимое ещё раз — тот же код (оформление обновляем), чтобы напечатанное не размножалось.
 * Новый код — только по оплате (key — тот, что оплачен в /api/purchases; первый простой бесплатный и код из пакета —
 * тоже оплата): одна оплата — один код, иначе сервер раздавал бы коды в обход оплаты (09.10.2026).
 */
export async function POST(req: Request) {
  const me = await currentPerson();
  if (!me) return Response.json({ error: "login" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const content = cleanContent(body.content);
  if (!content) return Response.json({ error: "bad" }, { status: 400 });
  const style = await readStyle(body.style);
  // Название — можно сразу (приложения); нет — по содержимому. Уже существующий код не переименовываем.
  const title = "title" in body ? readTitle(body.title) : null;
  const payKey = typeof body.key === "string" ? body.key : "";
  const tier = tierOf(style ?? DEFAULT_STYLE);
  const key = canon(content);
  const code = await mutate((db) => {
    // То же содержимое в том же виде — тот же код. Другой вид — новый код: вид скачанного кода не меняется.
    const look = canon(style);
    const same = db.codes.find((c) => c.owner === me && c.compact && c.kind === "link" && c.content && canon(c.content) === key && canon(c.style) === look);
    if (same) return same;
    if (overDailyLimit(db, me, 1)) return null;
    // Оплата этого кода, ещё не потраченная на другой (или тот код удалён).
    const paid = db.purchases.find((p) => p.person === me && p.key === payKey && (p.tier === "styled" || p.tier === tier) && (!p.code || !db.codes.some((c) => c.id === p.code)));
    if (!paid) return 402;
    const c: CodeRecord = {
      ...kindDefaults("link"),
      id: newId(),
      short: newShort(takenShorts(db)),
      compact: true,
      owner: me,
      title: title || titleOfContent(content),
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
    paid.code = c.id;
    return c;
  });
  if (code === 402) return Response.json({ error: "pay" }, { status: 402 });
  if (!code) return Response.json({ error: "limit" }, { status: 429 });
  return Response.json({ id: code.id, link: linkOf(linkBase(req), code) });
}
