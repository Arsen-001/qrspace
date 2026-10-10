"use client";
// Кабинет администратора — «Маркет»: все дизайны (встроенные и от дизайнеров) — скрыть / показать, в подборку, дроп дня,
// цена, название и описание; лоты перепродажи — снять с продажи. Правки сразу видны в маркете.
import Link from "next/link";
import { useEffect, useState } from "react";
import { adminApi, type AdminDesign, type AdminMarket as Data, type DesignPatch } from "@/lib/admin";
import { fmtDateTime } from "@/lib/format";
import { fill, tr, type Dict, type L10n, type Lang } from "@/lib/i18n";
import { useMe } from "@/lib/me";
import { sampleLink } from "../MarketPage";
import { QrThumb } from "../QrThumb";
import { Notice } from "../Shell";
import { AdminSection, btn, btnGhost, btnMain, btnWarn, btnWarnSoft, Empty, field, money, Pill } from "./parts";

const LANGS3 = ["ru", "en", "hy"] as const;

/** Правка цены, названия и описания (три языка). */
function DesignEditor({ t, d, busy, onSave, onCancel }: { t: Dict; d: AdminDesign; busy: boolean; onSave: (p: DesignPatch) => void; onCancel: () => void }) {
  const [price, setPrice] = useState(String(d.price));
  const [name, setName] = useState<L10n>({ ...d.name });
  const [about, setAbout] = useState<L10n>({ ...d.about });
  const n = Number(price);
  const ok = Number.isInteger(n) && n >= 1 && n <= 10_000 && !!name.ru.trim();
  return (
    <form
      className="space-y-3 border-t border-line p-4 text-sm"
      onSubmit={(e) => {
        e.preventDefault();
        if (ok) onSave({ price: n, name, about });
      }}
    >
      <label className="block text-xs font-medium text-muted">
        {t.adminPrice}
        <input type="number" inputMode="numeric" min={1} max={10000} step={1} value={price} onChange={(e) => setPrice(e.target.value)} className={`${field} mt-1`} />
      </label>
      {LANGS3.map((l) => (
        <label key={`n-${l}`} className="block text-xs font-medium text-muted">
          {t.adminNameField} · {l.toUpperCase()}
          <input value={name[l]} onChange={(e) => setName({ ...name, [l]: e.target.value })} maxLength={40} required={l === "ru"} className={`${field} mt-1`} />
        </label>
      ))}
      {LANGS3.map((l) => (
        <label key={`a-${l}`} className="block text-xs font-medium text-muted">
          {t.adminAboutField} · {l.toUpperCase()}
          <textarea value={about[l]} onChange={(e) => setAbout({ ...about, [l]: e.target.value })} maxLength={300} rows={2} className={`${field} mt-1 py-2`} />
        </label>
      ))}
      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={busy || !ok} className={btnMain}>
          {t.save}
        </button>
        <button type="button" onClick={onCancel} className={btnGhost}>
          {t.cancel}
        </button>
      </div>
    </form>
  );
}

function DesignCard({ t, lang, d, link, onPatch }: { t: Dict; lang: Lang; d: AdminDesign; link: string; onPatch: (p: DesignPatch) => Promise<void> }) {
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const run = async (p: DesignPatch) => {
    setBusy(true);
    try {
      await onPatch(p);
      setEditing(false);
    } finally {
      setBusy(false);
    }
  };
  return (
    <li className={`overflow-hidden rounded-2xl border bg-card ${d.hidden ? "border-dashed border-line opacity-80" : "border-line"}`} data-design={d.id}>
      <div className="flex gap-3 p-4">
        <Link href={`/market/${d.id}`} className="block w-20 shrink-0 self-start rounded-xl p-1.5 sm:w-24" style={{ background: d.style.bg }} aria-label={tr(d.name, lang)}>
          <QrThumb link={link} style={d.style} className="w-full rounded-lg" />
        </Link>
        <div className="min-w-0 flex-1 space-y-1.5 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span className="min-w-0 break-words font-heading font-bold">{tr(d.name, lang)}</span>
            <span className="font-heading font-extrabold">{money(d.price)}</span>
            {d.price !== d.basePrice && <span className="text-xs text-muted line-through">{money(d.basePrice)}</span>}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {d.drop && <Pill tone="accent">{t.dropOfDay}</Pill>}
            {d.featured && <Pill tone="dark">★ {t.featuredBadge}</Pill>}
            {d.hidden && <Pill tone="warn">{t.adminHidden}</Pill>}
            {d.changed && <Pill>{t.adminChanged}</Pill>}
          </div>
          <p className="text-xs text-muted">
            {d.seed ? t.adminSeed : fill(t.adminByDesigner, { name: d.by?.name ?? "—" })}
            {d.collab ? ` · × ${d.collab}` : ""}
            {" · "}
            {d.edition !== null ? fill(t.adminSoldOf, { n: d.sold, of: d.edition }) : fill(t.adminSold, { n: d.sold })}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2 px-4 pb-4">
        <button type="button" disabled={busy} onClick={() => run({ hidden: !d.hidden })} className={d.hidden ? btnMain : btnWarnSoft}>
          {d.hidden ? t.adminShow : t.adminHide}
        </button>
        <button type="button" disabled={busy} onClick={() => run({ featured: !d.featured })} className={btnGhost}>
          {d.featured ? t.adminUnfeature : t.adminFeature}
        </button>
        {!d.hidden && (
          <button type="button" disabled={busy} onClick={() => run({ drop: !d.drop })} className={btnGhost}>
            {d.drop ? t.adminUndrop : t.adminMakeDrop}
          </button>
        )}
        {!editing && (
          <button type="button" onClick={() => setEditing(true)} className={btnGhost}>
            {t.edit}
          </button>
        )}
        {d.changed && (
          <button type="button" disabled={busy} onClick={() => run({ reset: true })} className={`${btn} text-muted hover:text-ink`}>
            {t.adminReset}
          </button>
        )}
      </div>
      {editing && <DesignEditor t={t} d={d} busy={busy} onSave={run} onCancel={() => setEditing(false)} />}
    </li>
  );
}

export function AdminMarket({ t, lang, onPerson }: { t: Dict; lang: Lang; onPerson: (id: string) => void }) {
  const { base } = useMe();
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    let live = true;
    adminApi.market().then((d) => live && setData(d), () => {});
    return () => {
      live = false;
    };
  }, []);
  if (!data) return <Notice>{t.loading}</Notice>;
  const link = sampleLink(base);
  const patch = async (id: string, p: DesignPatch) => {
    setError(false);
    try {
      setData(await adminApi.design(id, p));
    } catch {
      setError(true);
    }
  };
  const remove = async (id: string) => {
    setError(false);
    try {
      setData(await adminApi.removeLot(id));
    } catch {
      setError(true);
    }
  };
  const open = data.lots.filter((l) => l.status === "open");
  const closed = data.lots.filter((l) => l.status !== "open").slice(0, 20);
  return (
    <div className="space-y-10">
      {error && (
        <p role="alert" className="rounded-xl bg-warn-soft p-3 text-sm text-warn">
          {t.adminFailed}
        </p>
      )}
      <AdminSection title={t.adminDesigns} note={t.adminMarketNote}>
        <ul className="grid gap-3 lg:grid-cols-2">
          {data.designs.map((d) => (
            <DesignCard key={d.id} t={t} lang={lang} d={d} link={link} onPatch={(p) => patch(d.id, p)} />
          ))}
        </ul>
      </AdminSection>

      <AdminSection title={t.resaleTitle}>
        {!open.length ? (
          <Empty>{t.adminNoLots}</Empty>
        ) : (
          <ul className="divide-y divide-line rounded-2xl border border-line bg-card text-sm">
            {open.map((l) => (
              <li key={l.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 p-4" data-lot={l.id}>
                <span className="min-w-0 flex-1 basis-56">
                  <span className="flex flex-wrap items-center gap-2">
                    <Link href={`/market/lot/${l.id}`} className="inline-flex min-h-10 items-center font-semibold underline underline-offset-2">
                      {l.title}
                    </Link>
                    {l.edition && (
                      <span className="font-mono text-xs text-muted">
                        № {l.edition.no}
                        {l.edition.of ? ` / ${l.edition.of}` : ""}
                      </span>
                    )}
                    <Pill>{l.mode === "auction" ? t.auction : t.fixedPrice}</Pill>
                  </span>
                  <span className="mt-1 block text-xs text-muted">
                    {money(l.top ?? l.price)}
                    {l.mode === "auction" ? ` · ${fill(t.adminBids, { n: l.bids })}` : ""}
                    {l.endsAt ? ` · ${t.adminEnds} ${fmtDateTime(l.endsAt, lang)}` : ""}
                  </span>
                </span>
                <button type="button" onClick={() => onPerson(l.seller.id)} className={btnGhost}>
                  {l.seller.name}
                </button>
                <button type="button" onClick={() => remove(l.id)} className={btnWarn}>
                  {t.adminRemoveLot}
                </button>
              </li>
            ))}
          </ul>
        )}
        {closed.length > 0 && (
          <ul className="mt-3 divide-y divide-line rounded-2xl border border-line bg-card text-sm">
            {closed.map((l) => (
              <li key={l.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 p-3 text-muted">
                <span className="min-w-0 flex-1 truncate">{l.title}</span>
                <Pill tone={l.removed ? "warn" : "plain"}>{l.removed ? t.adminLotRemoved : t[`adminLot.${l.status}` as keyof Dict]}</Pill>
                <span className="text-xs">{l.seller.name}</span>
                <span className="font-heading font-bold">{money(l.top ?? l.price)}</span>
              </li>
            ))}
          </ul>
        )}
      </AdminSection>
    </div>
  );
}
