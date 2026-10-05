import { promises as fs } from "node:fs";
import path from "node:path";
import { MEDIA_DIR, mutate } from "@/server/db";
import { currentPerson, endSession } from "@/server/session";
import { readShort } from "../codes/validate";

/** Мой профиль: имя, почта, чем вхожу, мои покупки. */
export async function GET() {
  const me = await currentPerson();
  if (!me) return Response.json({ error: "login" }, { status: 401 });
  return Response.json(
    await mutate((db) => {
      const u = db.users.find((x) => x.id === me)!;
      return {
        id: u.id,
        name: u.name,
        email: u.provider === "demo" ? "" : u.email,
        provider: u.provider,
        designer: u.designer,
        codes: db.codes.filter((c) => c.owner === me).length,
        purchases: db.purchases.filter((p) => p.person === me).slice(-50).reverse(),
      };
    }),
  );
}

/** Поменять имя (его видят другие). */
export async function PATCH(req: Request) {
  const me = await currentPerson();
  if (!me) return Response.json({ error: "login" }, { status: 401 });
  const name = readShort(((await req.json().catch(() => ({}))) as { name?: unknown }).name, 60);
  if (!name) return Response.json({ error: "bad" }, { status: 400 });
  await mutate((db) => {
    db.users.find((x) => x.id === me)!.name = name;
  });
  return Response.json({ ok: true });
}

/**
 * Удалить аккаунт навсегда (этого требуют Google и Apple): коды, память, фото и видео, контакты, уведомления, покупки;
 * человека убираем из чужих списков; открытые лоты снимаем. Демо-людей не удаляем — на них держится проверка.
 */
export async function DELETE() {
  const me = await currentPerson();
  if (!me) return Response.json({ error: "login" }, { status: 401 });
  const media = await mutate((db) => {
    const u = db.users.find((x) => x.id === me);
    if (!u || u.provider === "demo") return null;
    const mine = db.codes.filter((c) => c.owner === me);
    const files = mine.flatMap((c) => c.blocks.map((b) => b.media)).filter((m): m is string => !!m);
    const ids = new Set(mine.map((c) => c.id));
    db.codes = db.codes.filter((c) => c.owner !== me);
    for (const c of db.codes) {
      c.people = c.people.filter((g) => g.personId !== me);
      c.requests = c.requests.filter((r) => r.personId !== me);
    }
    db.listings.forEach((l) => l.status === "open" && (l.seller === me || ids.has(l.code)) && (l.status = "cancelled"));
    db.users.forEach((x) => x.contacts && (x.contacts = x.contacts.filter((c) => c !== me)));
    db.users = db.users.filter((x) => x.id !== me);
    db.notifications = db.notifications.filter((n) => n.to !== me);
    db.purchases = db.purchases.filter((p) => p.person !== me);
    db.orders = db.orders.filter((o) => o.client !== me);
    db.shop = db.shop.filter((o) => o.person !== me);
    return files;
  });
  if (!media) return Response.json({ error: "demo" }, { status: 403 });
  await Promise.all(media.map((m) => fs.rm(path.join(MEDIA_DIR, m), { force: true })));
  await endSession();
  return Response.json({ ok: true });
}
