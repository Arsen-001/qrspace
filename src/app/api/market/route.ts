import { market, mutate, newId, isDesignerId } from "@/server/db";
import { currentPerson } from "@/server/session";
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
  const about = readText(body.about).slice(0, 300);
  const price = Number(body.price);
  const edition = body.edition === null ? null : Number(body.edition);
  const style = readStyle(body.style);
  if (!name || !style || !Number.isFinite(price) || price < 1 || price > 10000) return Response.json({ error: "bad" }, { status: 400 });
  if (edition !== null && !(Number.isInteger(edition) && edition >= 1 && edition <= 100000)) return Response.json({ error: "bad" }, { status: 400 });
  const design: Design = {
    id: newId(),
    name: { hy: name, ru: name, en: name },
    about: { hy: about, ru: about, en: about },
    price: Math.round(price),
    edition,
    drop: body.drop === true,
    by: me!,
    createdAt: new Date().toISOString(),
    style,
  };
  await mutate((db) => {
    // Дроп дня один: новый дроп снимает отметку со старых.
    if (design.drop) db.designs.forEach((d) => (d.drop = false));
    db.designs.push(design);
  });
  return Response.json(design);
}
