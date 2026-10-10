"use client";
// Кабинет администратора — «Коды»: поиск по всем кодам (название, короткая ссылка, хозяин, куда ведёт), блокировка.
import Link from "next/link";
import { useEffect, useState } from "react";
import { adminApi, BLOCK_REASONS, CODE_FILTERS, type AdminCodeRow, type AdminCodes as Codes, type BlockReason, type CodeFilter } from "@/lib/admin";
import { fmtBytes } from "@/lib/codes";
import { fmtDateTime } from "@/lib/format";
import { fill, type Dict, type Lang } from "@/lib/i18n";
import { KindIcon } from "../KindIcon";
import { Notice } from "../Shell";
import { btnGhost, btnWarn, btnWarnSoft, Empty, field, Pill, SearchBar, useDebounced } from "./parts";

const reasonLabel = (t: Dict, r: string) => t[`reason.${r}` as keyof Dict] ?? r;

/** Строка кода: что за код, чей, сканы, жалобы, блокировка; «Хозяин» ведёт к человеку (onOwner). */
export function CodeRow({ t, lang, c, onChange, onOwner }: { t: Dict; lang: Lang; c: AdminCodeRow; onChange: (c: AdminCodeRow) => void; onOwner?: (id: string) => void }) {
  const [asking, setAsking] = useState(false);
  const [reason, setReason] = useState<BlockReason>("phishing");
  const [busy, setBusy] = useState(false);
  const act = async (fn: () => Promise<AdminCodeRow>) => {
    setBusy(true);
    try {
      onChange(await fn());
      setAsking(false);
    } finally {
      setBusy(false);
    }
  };
  return (
    <li className="space-y-2 p-4 text-sm" data-code={c.id}>
      <div className="flex flex-wrap items-center gap-2">
        <KindIcon kind={c.kind} className="h-5 w-5 shrink-0 text-muted" />
        <span className="min-w-0 break-words font-semibold">{c.title}</span>
        {c.edition && (
          <span className="font-mono text-xs text-muted">
            № {c.edition.no}
            {c.edition.of ? ` / ${c.edition.of}` : ""}
          </span>
        )}
        {c.blocked && <Pill tone="warn">⛔ {reasonLabel(t, c.blocked.reason)}</Pill>}
        {c.reports > 0 && <Pill tone="warn">{fill(t.adminReportsN, { n: c.reports })}</Pill>}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted">
        {c.short && <span className="font-mono">/K/{c.short}</span>}
        <span>{t[`tpl.${c.kind}` as keyof Dict]}</span>
        <span>{t[`vis.${c.visibility}` as keyof Dict]}</span>
        <span>
          {t.adminStatScans}: {c.scans}
        </span>
        {c.storage > 0 && <span>{fmtBytes(c.storage, lang)}</span>}
        <span>{fmtDateTime(c.createdAt, lang)}</span>
      </div>
      {c.target && <div className="break-all text-xs text-muted">→ {c.target}</div>}
      <div className="flex flex-wrap items-center gap-2">
        {onOwner ? (
          <button type="button" onClick={() => onOwner(c.owner.id)} className={btnGhost}>
            {t.ownerLabel}: {c.owner.name}
          </button>
        ) : null}
        <Link href={`/c/${c.id}`} className={btnGhost}>
          {t.dashAsGuest}
        </Link>
        {c.blocked ? (
          <button type="button" disabled={busy} onClick={() => act(() => adminApi.unblockCode(c.id))} className={btnGhost}>
            {t.adminUnblock}
          </button>
        ) : !asking ? (
          <button type="button" onClick={() => setAsking(true)} className={btnWarnSoft}>
            {t.adminBlock}
          </button>
        ) : null}
      </div>
      {asking && !c.blocked && (
        <div className="flex flex-wrap items-end gap-2 rounded-xl border border-line bg-field/50 p-3">
          <label className="min-w-0 flex-1 basis-48 text-xs font-medium text-muted">
            {t.adminBlockReason}
            <select value={reason} onChange={(e) => setReason(e.target.value as BlockReason)} className={`${field} mt-1`}>
              {BLOCK_REASONS.map((r) => (
                <option key={r} value={r}>
                  {reasonLabel(t, r)}
                </option>
              ))}
            </select>
          </label>
          <button type="button" disabled={busy} onClick={() => act(() => adminApi.blockCode(c.id, reason))} className={btnWarn}>
            {t.adminBlock}
          </button>
          <button type="button" onClick={() => setAsking(false)} className={btnGhost}>
            {t.cancel}
          </button>
        </div>
      )}
    </li>
  );
}

export function AdminCodes({ t, lang, onOwner }: { t: Dict; lang: Lang; onOwner: (id: string) => void }) {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<CodeFilter>("all");
  const [data, setData] = useState<Codes | null>(null);
  const query = useDebounced(q);
  useEffect(() => {
    let live = true;
    adminApi.codes(query, filter).then((d) => live && setData(d), () => {});
    return () => {
      live = false;
    };
  }, [query, filter]);
  const labels: Record<CodeFilter, string> = { all: t.adminFilterAll, blocked: t.adminFilterBlocked, reported: t.adminFilterReported };
  const update = (c: AdminCodeRow) => setData((d) => d && { ...d, rows: d.rows.map((x) => (x.id === c.id ? c : x)) });
  return (
    <div>
      <SearchBar label={t.adminSearchCodes} q={q} onQ={setQ} filters={CODE_FILTERS.map((id) => ({ id, label: labels[id] }))} filter={filter} onFilter={setFilter} />
      {!data ? (
        <Notice>{t.loading}</Notice>
      ) : !data.rows.length ? (
        <Empty>{t.adminNothing}</Empty>
      ) : (
        <>
          <p className="mb-2 text-xs text-muted">{fill(t.adminShown, { n: data.rows.length, total: data.total })}</p>
          <ul className="divide-y divide-line rounded-2xl border border-line bg-card">
            {data.rows.map((c) => (
              <CodeRow key={c.id} t={t} lang={lang} c={c} onChange={update} onOwner={onOwner} />
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
