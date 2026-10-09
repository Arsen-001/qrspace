import { mutate } from "@/server/db";
import { media as files } from "@/server/media";
import { currentPerson, endSession } from "@/server/session";
import { storageOf } from "@/lib/codes";
import { sellerGets } from "@/lib/listings";
import { packsLeft } from "@/lib/packs";
import { readShort } from "../codes/validate";

const DAY = 86_400_000;

/** Кабинет (владелец 09.10.2026): имя, почта, чем вхожу; цифры по моим кодам; покупки, пакеты, мои лоты. */
export async function GET() {
  const me = await currentPerson();
  if (!me) return Response.json({ error: "login" }, { status: 401 });
  return Response.json(
    await mutate((db) => {
      const u = db.users.find((x) => x.id === me)!;
      const now = Date.now();
      const mine = db.codes.filter((c) => c.owner === me);
      const titles = new Map(db.codes.map((c) => [c.id, c.title]));
      const purchases = db.purchases.filter((p) => p.person === me);
      const packs = db.packs.filter((p) => p.person === me);
      const lots = db.listings.filter((l) => l.seller === me);
      const space = mine.map((c) => storageOf(c, now));
      const visits = mine.flatMap((c) => c.visits);
      return {
        id: u.id,
        name: u.name,
        email: u.provider === "demo" ? "" : u.email,
        provider: u.provider,
        designer: u.designer,
        since: u.provider === "demo" ? null : u.createdAt,
        codes: mine.length,
        stats: {
          scans30: visits.filter((v) => now - Date.parse(v.at) < 30 * DAY).length,
          scans: visits.length,
          used: space.reduce((s, x) => s + x.used, 0),
          quota: space.reduce((s, x) => s + x.quota, 0),
          paidSpace: space.filter((x) => x.plan).length,
          packsLeft: packsLeft(packs),
          spent: purchases.reduce((s, p) => s + (p.free || p.pack ? 0 : p.price), 0) + packs.reduce((s, p) => s + p.price, 0),
          earned: lots.reduce((s, l) => s + (l.status === "sold" ? sellerGets(l.final ?? 0) : 0), 0),
        },
        purchases: purchases.slice(-50).reverse(),
        packs: packs.slice().reverse(),
        lots: lots
          .slice(-30)
          .reverse()
          .map((l) => ({ id: l.id, code: l.code, title: titles.get(l.code) ?? "", mode: l.mode, price: l.price, status: l.status, final: l.final, bids: l.bids.length, endsAt: l.endsAt, createdAt: l.createdAt })),
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
  await Promise.all(media.map((m) => files.remove(m)));
  await endSession();
  return Response.json({ ok: true });
}
