"use client";
// Кабинет администратора — «Люди»: все, кто входил (поиск по имени и почте), чем входит, когда пришёл, коды, сканы,
// покупки, место; человек целиком — его коды, покупки, пакеты, лоты; заблокировать / разблокировать.
import Link from "next/link";
import { useEffect, useState } from "react";
import { adminApi, USER_FILTERS, type AdminUserDetail, type AdminUserRow, type AdminUsers as Users, type UserFilter } from "@/lib/admin";
import { fmtBytes } from "@/lib/codes";
import { fmtDateTime } from "@/lib/format";
import { fill, type Dict, type Lang } from "@/lib/i18n";
import { Notice } from "../Shell";
import { CodeRow } from "./AdminCodes";
import { BuyRow } from "./AdminPurchases";
import { AdminSection, btnGhost, btnWarn, btnWarnSoft, Empty, field, money, Pill, providerLabel, SearchBar, Tile, useDebounced } from "./parts";

const since = (iso: string, lang: Lang) => (Date.parse(iso) > 0 ? fmtDateTime(iso, lang).split(",")[0] : "—");

function Badges({ t, u }: { t: Dict; u: AdminUserRow }) {
  return (
    <>
      <Pill tone={u.provider === "demo" ? "plain" : "dark"}>{providerLabel(t, u.provider)}</Pill>
      {u.admin && <Pill tone="accent">{t.navAdmin}</Pill>}
      {u.designer && <Pill>{t.designerRole}</Pill>}
      {u.blocked && <Pill tone="warn">⛔ {t.adminUserBlocked}</Pill>}
    </>
  );
}

function UserCard({ t, lang, u, onOpen }: { t: Dict; lang: Lang; u: AdminUserRow; onOpen: () => void }) {
  return (
    <li>
      <button type="button" onClick={onOpen} className="block w-full p-4 text-left text-sm transition-colors hover:bg-field/60" data-user={u.id}>
        <span className="flex flex-wrap items-center gap-2">
          <span className="min-w-0 break-words font-semibold">{u.name}</span>
          <Badges t={t} u={u} />
        </span>
        <span className="mt-1 block break-all text-xs text-muted">
          {u.email ? `${u.email} · ` : ""}
          {t.accSince} {since(u.createdAt, lang)}
        </span>
        <span className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted">
          <span>
            {t.adminStatCodes}: <b className="text-ink">{u.codes}</b>
          </span>
          <span>
            {t.adminStatScans}: <b className="text-ink">{u.scans}</b>
          </span>
          <span>
            {t.adminStatBuys}: <b className="text-ink">{u.buys}</b> · {money(u.spent)}
          </span>
          <span>
            {t.adminStatSpace}: <b className="text-ink">{u.storage ? fmtBytes(u.storage, lang) : "0"}</b>
          </span>
        </span>
      </button>
    </li>
  );
}

/** Заблокировать (за что — по желанию; заодно все его коды и лоты) или разблокировать. */
function BlockBox({ t, lang, d, me, onDone }: { t: Dict; lang: Lang; d: AdminUserDetail; me: string | null; onDone: (d: AdminUserDetail) => void }) {
  const u = d.user;
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [codes, setCodes] = useState(false);
  const [busy, setBusy] = useState(false);
  const run = async (fn: () => Promise<AdminUserDetail>) => {
    setBusy(true);
    try {
      onDone(await fn());
      setOpen(false);
      setNote("");
      setCodes(false);
    } finally {
      setBusy(false);
    }
  };
  if (u.blocked)
    return (
      <div className="rounded-2xl border border-warn/40 bg-warn-soft p-4 text-sm">
        <p className="font-semibold text-warn">
          ⛔ {t.adminUserBlocked} · {fmtDateTime(u.blocked.at, lang)}
        </p>
        {u.blocked.note && <p className="mt-1 break-words text-ink">{u.blocked.note}</p>}
        <p className="mt-1 text-xs text-muted">{t.adminBlockHint}</p>
        <button type="button" disabled={busy} onClick={() => run(() => adminApi.unblockUser(u.id))} className={`${btnGhost} mt-3`}>
          {t.adminUnblockUser}
        </button>
      </div>
    );
  if (u.admin || u.id === me) return <p className="text-xs text-muted">{t.adminCantBlockAdmin}</p>;
  if (!open)
    return (
      <button type="button" onClick={() => setOpen(true)} className={btnWarnSoft}>
        {t.adminBlockUser}
      </button>
    );
  return (
    <div className="space-y-3 rounded-2xl border border-line bg-card p-4 text-sm">
      <p className="text-muted">{t.adminBlockHint}</p>
      <label className="block text-xs font-medium text-muted">
        {t.adminBlockNote}
        <textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} rows={2} className={`${field} mt-1 py-2`} />
      </label>
      <label className="flex min-h-10 items-center gap-3">
        <input type="checkbox" checked={codes} onChange={(e) => setCodes(e.target.checked)} className="h-5 w-5 accent-[var(--warn)]" />
        <span>{t.adminBlockCodesToo}</span>
      </label>
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={busy} onClick={() => run(() => adminApi.blockUser(u.id, note, codes))} className={btnWarn}>
          {t.adminBlockUser}
        </button>
        <button type="button" onClick={() => setOpen(false)} className={btnGhost}>
          {t.cancel}
        </button>
      </div>
    </div>
  );
}

function UserView({ t, lang, id, me, onBack }: { t: Dict; lang: Lang; id: string; me: string | null; onBack: () => void }) {
  const [d, setD] = useState<{ id: string; data: AdminUserDetail } | null>(null);
  const [missing, setMissing] = useState(false);
  useEffect(() => {
    let live = true;
    adminApi.user(id).then(
      (data) => live && setD({ id, data }),
      () => live && setMissing(true),
    );
    return () => {
      live = false;
    };
  }, [id]);
  const data = d?.id === id ? d.data : null;
  const back = (
    <button type="button" onClick={onBack} className={btnGhost}>
      ← {t.adminAllUsers}
    </button>
  );
  if (!data) return <div className="space-y-4">{back}<Notice>{missing ? t.adminNothing : t.loading}</Notice></div>;
  const u = data.user;
  const set = (next: AdminUserDetail) => setD({ id, data: next });
  return (
    <div className="space-y-8">
      <div className="space-y-4">
        {back}
        <section className="rounded-3xl border border-line bg-card p-5">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="min-w-0 break-words font-heading text-2xl font-extrabold">{u.name}</h2>
            <Badges t={t} u={u} />
          </div>
          <p className="mt-1 break-all text-sm text-muted">
            {u.email ? `${u.email} · ` : ""}
            {t.accSince} {since(u.createdAt, lang)}
          </p>
          <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Tile label={t.adminStatCodes} value={u.codes} />
            <Tile label={t.adminStatScans} value={u.scans} />
            <Tile label={`${t.adminStatBuys} · ${money(u.spent)}`} value={u.buys} />
            <Tile label={t.adminStatSpace} value={u.storage ? fmtBytes(u.storage, lang) : "0"} />
          </div>
          <div className="mt-4">
            <BlockBox t={t} lang={lang} d={data} me={me} onDone={set} />
          </div>
        </section>
      </div>

      <AdminSection title={t.adminUserCodes}>
        {!data.codes.length ? (
          <Empty>{t.adminNoCodes}</Empty>
        ) : (
          <ul className="divide-y divide-line rounded-2xl border border-line bg-card">
            {data.codes.map((c) => (
              <CodeRow key={c.id} t={t} lang={lang} c={c} onChange={(c) => set({ ...data, codes: data.codes.map((x) => (x.id === c.id ? c : x)) })} />
            ))}
          </ul>
        )}
      </AdminSection>

      <AdminSection title={t.accPurchases}>
        {!data.buys.length ? (
          <Empty>{t.adminNoPurchases}</Empty>
        ) : (
          <ul className="divide-y divide-line rounded-2xl border border-line bg-card">
            {data.buys.map((b, i) => (
              <BuyRow key={`${b.at}-${i}`} t={t} lang={lang} b={b} />
            ))}
          </ul>
        )}
      </AdminSection>

      {data.packs.length > 0 && (
        <AdminSection title={t.accPacks}>
          <ul className="divide-y divide-line rounded-2xl border border-line bg-card text-sm">
            {data.packs.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 p-3">
                <span className="min-w-0 flex-1 font-semibold">{p.codes} QR</span>
                <span className="text-xs text-muted">{fill(t.adminPackUsed, { used: p.used, codes: p.codes })}</span>
                {p.store && <Pill tone="dark">{p.store === "apple" ? "App Store" : "Google Play"}</Pill>}
                {p.test && <Pill tone="warn">{t.adminTestMark}</Pill>}
                <span className="text-xs text-muted">{fmtDateTime(p.at, lang)}</span>
                <span className="font-heading font-extrabold">{money(p.price)}</span>
              </li>
            ))}
          </ul>
        </AdminSection>
      )}

      {data.lots.length > 0 && (
        <AdminSection title={t.resaleTitle}>
          <ul className="divide-y divide-line rounded-2xl border border-line bg-card text-sm">
            {data.lots.map((l) => (
              <li key={l.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 p-3">
                <Link href={`/market/lot/${l.id}`} className="min-h-10 min-w-0 flex-1 content-center font-semibold underline-offset-2 hover:underline">
                  {l.title}
                </Link>
                <Pill tone={l.status === "open" ? "ok" : "plain"}>{t[`adminLot.${l.status}` as keyof Dict]}</Pill>
                <span className="text-xs text-muted">{l.mode === "auction" ? t.auction : t.fixedPrice}</span>
                <span className="font-heading font-extrabold">{money(l.final ?? l.price)}</span>
              </li>
            ))}
          </ul>
        </AdminSection>
      )}
    </div>
  );
}

export function AdminUsers({ t, lang, me, open, onOpen }: { t: Dict; lang: Lang; me: string | null; open: string | null; onOpen: (id: string | null) => void }) {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<UserFilter>("all");
  const [data, setData] = useState<Users | null>(null);
  const query = useDebounced(q);
  useEffect(() => {
    if (open) return;
    let live = true;
    adminApi.users(query, filter).then((d) => live && setData(d), () => {});
    return () => {
      live = false;
    };
  }, [query, filter, open]);
  if (open) return <UserView t={t} lang={lang} id={open} me={me} onBack={() => onOpen(null)} />;
  const labels: Record<UserFilter, string> = { all: t.adminFilterAll, real: t.adminFilterReal, demo: t.adminFilterDemo, blocked: t.adminFilterBlocked };
  return (
    <div>
      <SearchBar label={t.adminSearchUsers} q={q} onQ={setQ} filters={USER_FILTERS.map((id) => ({ id, label: labels[id] }))} filter={filter} onFilter={setFilter} />
      {!data ? (
        <Notice>{t.loading}</Notice>
      ) : !data.rows.length ? (
        <Empty>{t.adminNothing}</Empty>
      ) : (
        <>
          <p className="mb-2 text-xs text-muted">{fill(t.adminShown, { n: data.rows.length, total: data.total })}</p>
          <ul className="divide-y divide-line rounded-2xl border border-line bg-card">
            {data.rows.map((u) => (
              <UserCard key={u.id} t={t} lang={lang} u={u} onOpen={() => onOpen(u.id)} />
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
