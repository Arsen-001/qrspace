import { market, mutate, newId, isDesignerId, kindDefaults } from "@/server/db";
import { currentPerson } from "@/server/session";
import type { CodeRecord } from "@/lib/codes";
import type { Design } from "@/lib/market";
import { readShort, readStyle, readText } from "../codes/validate";

/** Что выложено дизайнерами и сколько продано (для «осталось N из M»). */
export async function GET() {
  return Response.json(await market());
}

/** Дизайнер выкладывает код в маркет (чтение кода он проверил у себя перед публикацией). */
export async function POST(req: Request) {
  const me = await currentPerson();
  if (!(await isDesignerId(me))) return Response.json({ error: "designer" }, { status: 403 });
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const name = readShort(body.name, 40);
  // Название на других языках — по желанию; нет — везде основное.
  const nameHy = readShort(body.nameHy, 40) || name;
  const nameEn = readShort(body.nameEn, 40) || name;
  const collab = readShort(body.collab, 40);
  const about = readText(body.about).slice(0, 300);
  const price = Number(body.price);
  const edition = body.edition === null ? null : Number(body.edition);
  const style = await readStyle(body.style);
  if (!name || !style || !Number.isFinite(price) || price < 1 || price > 10000) return Response.json({ error: "bad" }, { status: 400 });
  if (edition !== null && !(Number.isInteger(edition) && edition >= 1 && edition <= 100000)) return Response.json({ error: "bad" }, { status: 400 });
  const design: Design = {
    id: newId(),
    name: { hy: nameHy, ru: name, en: nameEn },
    ...(collab && { collab }),
    about: { hy: about, ru: about, en: about },
    price: Math.round(price),
    edition,
    drop: body.drop === true,
    by: me!,
    createdAt: new Date().toISOString(),
    style,
  };
  // «№ 1 — на аукцион» (только у тиража): первый номер сразу у дизайнера и на аукционе на сутки, старт — 3 цены.
  const firstOnAuction = body.firstOnAuction === true && edition !== null;
  await mutate((db) => {
    // Дроп дня один: новый дроп снимает отметку со старых.
    if (design.drop) db.designs.forEach((d) => (d.drop = false));
    db.designs.push(design);
    if (!firstOnAuction) return;
    const at = design.createdAt ?? new Date().toISOString();
    const code: CodeRecord = {
      ...kindDefaults("memory"),
      id: newId(),
      owner: me!,
      title: design.name.ru,
      people: [],
      requests: [],
      invite: newId(12),
      blocks: [],
      style,
      visits: [],
      createdAt: at,
      edition: { design: design.id, no: 1, of: edition },
      owners: [{ person: me!, at, price: null }],
    };
    db.codes.push(code);
    db.sales[design.id] = 1;
    db.listings.push({
      id: newId(),
      code: code.id,
      seller: me!,
      mode: "auction",
      price: design.price * 3,
      endsAt: new Date(Date.parse(at) + 24 * 3_600_000).toISOString(),
      bids: [],
      status: "open",
      buyer: null,
      final: null,
      createdAt: at,
    });
  });
  return Response.json(design);
}
