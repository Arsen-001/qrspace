"use client";
// Кабинет администратора (владелец 10.10.2026: «своя админка — смотреть юзеров, менять всякое в маркете»).
// Разделы — вкладки с адресом (?tab=…): Обзор (цифры, жалобы, новые люди), Люди, Коды, Маркет, Покупки.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ADMIN_TABS, type AdminTab } from "@/lib/admin";
import type { Kind, Report } from "@/lib/codes";
import { fmtDateTime } from "@/lib/format";
import type { Dict, Lang } from "@/lib/i18n";
import { useLang } from "@/lib/lang";
import { useMe } from "@/lib/me";
import { personName } from "./Avatar";
import { AdminCodes } from "./admin/AdminCodes";
import { AdminMarket } from "./admin/AdminMarket";
import { AdminPurchases } from "./admin/AdminPurchases";
import { AdminUsers } from "./admin/AdminUsers";
import { AdminSection, Empty, money, Pill, Tile } from "./admin/parts";
import { Notice, Shell } from "./Shell";

type AdminReport = Report & { title: string | null; kind: Kind | null; owner: string | null; target: string | null; blocked: boolean };
type AdminData = {
  totals: Record<string, number> & { byKind: Record<string, number> };
  reports: AdminReport[];
  newUsers: { id: string; name: string; provider: string; at: string; blocked: boolean }[];
};

const tabLabel = (t: Dict, tab: AdminTab) =>
  ({ overview: t.adminTabOverview, users: t.adminTabUsers, codes: t.adminTabCodes, market: t.adminTabMarket, purchases: t.adminTabPurchases })[tab];

/** Значки вкладок — тонкие линии, как в кабинете человека. */
function TabIcon({ tab, className }: { tab: AdminTab; className: string }) {
  const d = {
    overview: "M4 13h6V4H4zM14 20h6v-9h-6zM14 8h6V4h-6zM4 20h6v-4H4z",
    users: "M16 19v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1M9.5 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM21 19v-1a4 4 0 0 0-3-3.9M15.5 4.1a3 3 0 0 1 0 5.8",
    codes: "M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2v2h-2zM18 18h2v2h-2zM14 18h2",
    market: "M4 9 5.5 4h13L20 9M4 9h16M4 9v11h16V9M9 13h6",
    purchases: "M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6",
  }[tab];
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}

/** «Обзор»: цифры сайта (нажал — к разделу), жалобы с решением, новые люди. */
function Overview({ t, lang, go, onPerson }: { t: Dict; lang: Lang; go: (tab: AdminTab) => void; onPerson: (id: string) => void }) {
  const [data, setData] = useState<AdminData | null>(null);
  const load = useCallback(() => {
    fetch("/api/admin", { cache: "no-store" })
      .then((r) => (r.ok ? (r.json() as Promise<AdminData>) : null))
      .then(setData, () => {});
  }, []);
  useEffect(() => {
    load();
  }, [load]);
  const act = async (id: string, action: "block" | "dismiss" | "unblock") => {
    await fetch(`/api/admin/reports/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ action }) });
    load();
  };
  if (!data) return <Notice>{t.loading}</Notice>;
  return (
    <div className="space-y-8">
      <section>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          <Tile label={t.adminRevenue} value={money(data.totals.revenue)} main onClick={() => go("purchases")} />
          <Tile label={t.adminUsers} value={data.totals.users} onClick={() => go("users")} />
          <Tile label={t.adminCodes} value={data.totals.codes} onClick={() => go("codes")} />
          <Tile label={t.adminScans} value={data.totals.scans} />
          <Tile label={t.statsWeek} value={data.totals.scansWeek} />
          <Tile label={t.adminBlocked} value={data.totals.blocked} onClick={() => go("codes")} />
          <Tile label={t.adminBlockedUsers} value={data.totals.blockedUsers} onClick={() => go("users")} />
          <Tile label={t.resaleTitle} value={data.totals.openLots} onClick={() => go("market")} />
        </div>
        <p className="mt-3 text-xs text-muted">{t.adminRevenueNote}</p>
      </section>

      <AdminSection title={t.adminReports}>
        {data.reports.length === 0 ? (
          <Empty>{t.adminNoReports}</Empty>
        ) : (
          <ul className="divide-y divide-line rounded-2xl border border-line bg-card">
            {data.reports.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 p-4 text-sm">
                <span className="min-w-0 flex-1 basis-64">
                  <span className="flex flex-wrap items-center gap-2">
                    <Pill tone="warn">{t[`reason.${r.reason}`]}</Pill>
                    <Link href={`/c/${r.code}`} className="font-semibold underline underline-offset-2">
                      {r.title ?? r.code}
                    </Link>
                    {r.blocked && <span className="text-xs font-semibold text-warn">⛔ {t.adminIsBlocked}</span>}
                  </span>
                  {r.text && <span className="mt-1 block break-words text-ink">{r.text}</span>}
                  {r.target && <span className="mt-1 block break-all text-xs text-muted">→ {r.target}</span>}
                  <span className="mt-1 block text-xs text-muted">
                    {t.ownerLabel}: {r.owner ? personName(r.owner, lang) : "—"} · {r.from ? personName(r.from, lang) : t.guest} · {fmtDateTime(r.at, lang)}
                  </span>
                </span>
                {r.status === "open" ? (
                  <span className="flex gap-2">
                    <button type="button" onClick={() => act(r.id, "block")} className="min-h-10 rounded-xl bg-warn px-3 text-sm font-semibold text-on-warn">
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
      </AdminSection>

      <AdminSection title={t.adminNewUsers}>
        {data.newUsers.length === 0 ? (
          <Empty>{t.adminNoUsers}</Empty>
        ) : (
          <ul className="divide-y divide-line rounded-2xl border border-line bg-card text-sm">
            {data.newUsers.map((u) => (
              <li key={u.id}>
                <button type="button" onClick={() => onPerson(u.id)} className="flex min-h-12 w-full items-center gap-3 p-3 text-left hover:bg-field/60">
                  <span className="min-w-0 flex-1 truncate font-medium">{u.name}</span>
                  {u.blocked && <span className="text-xs font-semibold text-warn">⛔</span>}
                  <span className="text-xs text-muted">{u.provider === "google" ? "Google" : u.provider === "review" ? "App Review" : "Apple"}</span>
                  <span className="text-xs text-muted">{fmtDateTime(u.at, lang)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </AdminSection>
    </div>
  );
}

export function AdminPage({ tab: first, user: firstUser }: { tab: AdminTab; user: string | null }) {
  const { lang, t } = useLang((t) => `${t.adminTitle} — ${t.appName}`);
  const { ready, me, admin } = useMe();
  const router = useRouter();
  const [tab, setTab] = useState<AdminTab>(first);
  // Открытый человек (раздел «Люди»): из списка, из покупок, из лотов — с адресом ?tab=users&user=…
  const [user, setUser] = useState<string | null>(firstUser);
  const show = (next: AdminTab, person: string | null = null) => {
    setTab(next);
    setUser(person);
    const q = new URLSearchParams();
    if (next !== "overview") q.set("tab", next);
    if (person) q.set("user", person);
    router.replace(q.size ? `/admin?${q}` : "/admin", { scroll: false });
  };
  const go = (next: AdminTab) => show(next);
  const openPerson = (id: string | null) => show("users", id);

  return (
    <Shell t={t} lang={lang}>
      <h1 className="font-heading text-2xl font-extrabold tracking-tight sm:text-3xl">{t.adminTitle}</h1>
      {!ready ? null : !me || !admin ? (
        <div className="mt-6">
          <Notice>{t.adminOnly}</Notice>
        </div>
      ) : (
        <div className="mt-5 lg:grid lg:grid-cols-[12rem_1fr] lg:gap-8">
          {/* Разделы: на телефоне — пять кнопок в ряд (значок над подписью), на компьютере — колонка слева. */}
          <nav aria-label={t.adminTitle} className="mb-6 grid grid-cols-5 gap-1.5 lg:sticky lg:top-4 lg:mb-0 lg:flex lg:flex-col lg:self-start">
            {ADMIN_TABS.map((x) => (
              <button
                key={x}
                type="button"
                onClick={() => go(x)}
                aria-current={tab === x ? "page" : undefined}
                className={`flex min-h-16 min-w-0 flex-col items-center justify-center gap-1.5 rounded-xl px-0.5 text-center text-xs font-semibold transition-colors lg:min-h-11 lg:flex-row lg:justify-start lg:gap-2.5 lg:px-3.5 lg:text-left lg:text-sm ${
                  tab === x ? "bg-stage text-on-stage" : "border border-line bg-card text-muted hover:text-ink lg:border-transparent lg:bg-transparent lg:hover:bg-card"
                }`}
              >
                <TabIcon tab={x} className={`h-5 w-5 shrink-0 lg:h-4 lg:w-4 ${tab === x ? "text-accent" : ""}`} />
                <span className="max-w-full truncate">{tabLabel(t, x)}</span>
              </button>
            ))}
          </nav>
          <div className="min-w-0">
            {tab === "overview" && <Overview t={t} lang={lang} go={go} onPerson={openPerson} />}
            {tab === "users" && <AdminUsers t={t} lang={lang} me={me} open={user} onOpen={openPerson} />}
            {tab === "codes" && <AdminCodes t={t} lang={lang} onOwner={openPerson} />}
            {tab === "market" && <AdminMarket t={t} lang={lang} onPerson={openPerson} />}
            {tab === "purchases" && <AdminPurchases t={t} lang={lang} onPerson={openPerson} />}
          </div>
        </div>
      )}
    </Shell>
  );
}
