import { read } from "@/server/db";
import { adminId, buyRows, forbidden, revenueOf } from "@/server/admin";

/** Кабинет администратора, «Обзор»: общие цифры, жалобы (с тем, что за код), новые люди. Только администраторам. */
export async function GET() {
  if (!(await adminId())) return forbidden();
  const db = await read();
  const byKind: Record<string, number> = {};
  db.codes.forEach((c) => (byKind[c.kind] = (byKind[c.kind] ?? 0) + 1));
  const week = Date.now() - 7 * 86_400_000;
  return Response.json({
    totals: {
      users: db.users.filter((u) => u.provider !== "demo").length,
      demoUsers: db.users.filter((u) => u.provider === "demo").length,
      blockedUsers: db.users.filter((u) => u.blocked).length,
      codes: db.codes.length,
      byKind,
      scans: db.codes.reduce((n, c) => n + c.visits.length, 0),
      scansWeek: db.codes.reduce((n, c) => n + c.visits.filter((v) => Date.parse(v.at) > week).length, 0),
      revenue: revenueOf(buyRows(db)),
      purchases: db.purchases.length,
      openLots: db.listings.filter((l) => l.status === "open").length,
      blocked: db.codes.filter((c) => c.blocked).length,
      openReports: db.reports.filter((r) => r.status === "open").length,
    },
    reports: [...db.reports].reverse().slice(0, 100).map((r) => {
      const c = db.codes.find((x) => x.id === r.code);
      return { ...r, title: c?.title ?? null, kind: c?.kind ?? null, owner: c?.owner ?? null, target: c?.target ?? null, blocked: !!c?.blocked };
    }),
    newUsers: db.users
      .filter((u) => u.provider !== "demo")
      .slice(-20)
      .reverse()
      .map((u) => ({ id: u.id, name: u.name, provider: u.provider, at: u.createdAt, blocked: !!u.blocked })),
  });
}
