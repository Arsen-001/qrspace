"use client";
// Кабинет администратора: общие цифры сайта, жалобы на коды (заблокировать / отклонить), новые люди.
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { Kind, Report } from "@/lib/codes";
import { fmtDateTime } from "@/lib/format";
import { useLang } from "@/lib/lang";
import { useMe } from "@/lib/me";
import { personName } from "./Avatar";
import { Notice, Shell } from "./Shell";

type AdminReport = Report & { title: string | null; kind: Kind | null; owner: string | null; target: string | null; blocked: boolean };
type AdminData = {
  totals: Record<string, number> & { byKind: Record<string, number> };
  reports: AdminReport[];
  newUsers: { id: string; name: string; provider: string; at: string }[];
};

/** Цифра кабинета; main — главная (тёмная, лаймом), чтобы глаз сразу находил оборот. */
function Tile({ label, value, main }: { label: string; value: string | number; main?: boolean }) {
  return (
    <div className={`rounded-2xl p-4 ${main ? "bg-stage text-on-stage" : "border border-line bg-card"}`}>
      <div className={`text-xs ${main ? "text-on-stage/60" : "text-muted"}`}>{label}</div>
      <div className={`mt-1 font-heading text-2xl font-extrabold ${main ? "text-accent" : ""}`}>{value}</div>
    </div>
  );
}

export function AdminPage() {
  const { lang, t } = useLang((t) => `${t.adminTitle} — ${t.appName}`);
  const { ready, me, admin } = useMe();
  const [data, setData] = useState<AdminData | null>(null);
  const load = useCallback(() => {
    fetch("/api/admin", { cache: "no-store" })
      .then((r) => (r.ok ? (r.json() as Promise<AdminData>) : null))
      .then(setData, () => {});
  }, []);
  useEffect(() => {
    if (admin) load();
  }, [admin, load]);
  const act = async (id: string, action: "block" | "dismiss" | "unblock") => {
    await fetch(`/api/admin/reports/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ action }) });
    load();
  };

  return (
    <Shell t={t} lang={lang}>
      <h1 className="font-heading text-3xl font-extrabold tracking-tight">{t.adminTitle}</h1>
      {!ready ? null : !me || !admin ? (
        <div className="mt-6">
          <Notice>{t.adminOnly}</Notice>
        </div>
      ) : !data ? (
        <div className="mt-6">
          <Notice>{t.loading}</Notice>
        </div>
      ) : (
        <div className="mt-6 space-y-8">
          <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <Tile label={t.adminUsers} value={data.totals.users} />
            <Tile label={t.adminCodes} value={data.totals.codes} />
            <Tile label={t.adminScans} value={data.totals.scans} />
            <Tile label={t.statsWeek} value={data.totals.scansWeek} />
            <Tile label={t.adminRevenue} value={`$${data.totals.revenue}`} main />
            <Tile label={t.adminBlocked} value={data.totals.blocked} />
          </section>
          <p className="-mt-5 text-xs text-muted">
            {t.adminRevenueNote} · {t.brandTitle}: {data.totals.brandOrders} · {t.shopTitle}: {data.totals.shopOrders} · {t.resaleTitle}: {data.totals.openLots}
          </p>

          <section>
            <h2 className="font-heading text-xl font-bold">{t.adminReports}</h2>
            {data.reports.length === 0 ? (
              <p className="mt-2 text-sm text-muted">{t.adminNoReports}</p>
            ) : (
              <ul className="mt-3 divide-y divide-line rounded-2xl border border-line bg-card">
                {data.reports.map((r) => (
                  <li key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 p-4 text-sm">
                    <span className="min-w-0 flex-1 basis-64">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-warn-soft px-2 py-0.5 text-xs font-semibold text-warn">{t[`reason.${r.reason}`]}</span>
                        <Link href={`/c/${r.code}`} className="font-semibold underline underline-offset-2">
                          {r.title ?? r.code}
                        </Link>
                        {r.blocked && <span className="text-xs font-semibold text-warn">⛔ {t.adminIsBlocked}</span>}
                      </span>
                      {r.text && <span className="mt-1 block text-ink">{r.text}</span>}
                      {r.target && <span className="mt-1 block break-all text-xs text-muted">→ {r.target}</span>}
                      <span className="mt-1 block text-xs text-muted">
                        {t.ownerLabel}: {r.owner ? personName(r.owner, lang) : "—"} · {r.from ? personName(r.from, lang) : t.guest} · {fmtDateTime(r.at, lang)}
                      </span>
                    </span>
                    {r.status === "open" ? (
                      <span className="flex gap-2">
                        <button type="button" onClick={() => act(r.id, "block")} className="min-h-10 rounded-xl bg-warn px-3 text-sm font-semibold text-white">
                          {t.adminBlock}
                        </button>
                        <button type="button" onClick={() => act(r.id, "dismiss")} className="min-h-10 rounded-xl border border-line bg-field px-3 text-sm font-medium">
                          {t.adminDismiss}
                        </button>
                      </span>
                    ) : r.blocked ? (
                      <button type="button" onClick={() => act(r.id, "unblock")} className="min-h-10 rounded-xl border border-line bg-field px-3 text-sm font-medium">
                        {t.adminUnblock}
                      </button>
                    ) : (
                      <span className="text-xs text-muted">{t.adminDismissed}</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <h2 className="font-heading text-xl font-bold">{t.adminNewUsers}</h2>
            {data.newUsers.length === 0 ? (
              <p className="mt-2 text-sm text-muted">{t.adminNoUsers}</p>
            ) : (
              <ul className="mt-3 divide-y divide-line rounded-2xl border border-line bg-card text-sm">
                {data.newUsers.map((u) => (
                  <li key={u.id} className="flex items-center gap-3 p-3">
                    <span className="min-w-0 flex-1 truncate font-medium">{u.name}</span>
                    <span className="text-xs text-muted">{u.provider === "google" ? "Google" : "Apple"}</span>
                    <span className="text-xs text-muted">{fmtDateTime(u.at, lang)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </Shell>
  );
}
