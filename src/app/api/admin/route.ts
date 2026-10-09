import { isAdminId, mutate } from "@/server/db";
import { currentPerson } from "@/server/session";

/** Кабинет администратора: общие цифры, жалобы (с тем, что за код), новые люди. Только администраторам. */
export async function GET() {
  const me = await currentPerson();
  if (!(await isAdminId(me))) return Response.json({ error: "admin" }, { status: 403 });
  return Response.json(
    await mutate((db) => {
      const byKind: Record<string, number> = {};
      db.codes.forEach((c) => (byKind[c.kind] = (byKind[c.kind] ?? 0) + 1));
      const week = Date.now() - 7 * 86_400_000;
      return {
        totals: {
          users: db.users.filter((u) => u.provider !== "demo").length,
          demoUsers: db.users.filter((u) => u.provider === "demo").length,
          codes: db.codes.length,
          byKind,
          scans: db.codes.reduce((n, c) => n + c.visits.length, 0),
          scansWeek: db.codes.reduce((n, c) => n + c.visits.filter((v) => Date.parse(v.at) > week).length, 0),
          revenue: db.purchases.reduce((n, p) => n + p.price, 0) + db.packs.reduce((n, p) => n + p.price, 0) + db.spaces.reduce((n, p) => n + p.price, 0),
          purchases: db.purchases.length,
          openLots: db.listings.filter((l) => l.status === "open").length,
          blocked: db.codes.filter((c) => c.blocked).length,
        },
        reports: [...db.reports].reverse().slice(0, 100).map((r) => {
          const c = db.codes.find((x) => x.id === r.code);
          return { ...r, title: c?.title ?? null, kind: c?.kind ?? null, owner: c?.owner ?? null, target: c?.target ?? null, blocked: !!c?.blocked };
        }),
        newUsers: db.users
          .filter((u) => u.provider !== "demo")
          .slice(-20)
          .reverse()
          .map((u) => ({ id: u.id, name: u.name, provider: u.provider, at: u.createdAt })),
      };
    }),
  );
}
