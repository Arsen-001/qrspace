"use client";
// «Мои коды»: свои коды с памятью и коды, которые открыли мне.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api, linkOf, daysLeft, KINDS, type CodeList, type CodeView, type Kind, type Task } from "@/lib/codes";
import { tr, type Dict, type Lang } from "@/lib/i18n";
import { useLang } from "@/lib/lang";
import { useMe } from "@/lib/me";
import { DEFAULT_STYLE, toSaved } from "@/lib/qr/style";
import { STARTERS } from "@/lib/starters";
import { personName } from "./Avatar";
import { KindIcon } from "./KindIcon";
import { QrThumb } from "./QrThumb";
import { DueNote } from "./Tasks";
import { Notice, Shell } from "./Shell";
import { MyCodesGrid } from "./MyCodesGrid";
import { DoneCheck } from "./ui";
import { VisBadge } from "./VisBadge";

function CodeCard({ t, lang, base, code, shared }: { t: Dict; lang: Lang; base: string; code: CodeView; shared?: boolean }) {
  const requests = code.requests?.length ?? 0;
  const unread = code.messages?.filter((m) => !m.read).length ?? 0;
  return (
    <li>
      <Link
        href={shared ? `/c/${code.id}` : `/codes/${code.id}`}
        className="group flex h-full gap-4 overflow-hidden rounded-3xl bg-stage p-3 text-on-stage shadow-[0_18px_40px_-24px_rgba(0,0,0,0.6)] transition-all duration-300 hover:-translate-y-1"
      >
        <span className="shrink-0 rounded-2xl p-2" style={{ background: code.style?.bg ?? "#ffffff" }}>
          <QrThumb link={linkOf(base, code)} style={code.style} className="h-24 w-24 rounded-lg" />
        </span>
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex items-start gap-1.5">
            <KindIcon kind={code.kind} className="mt-0.5 h-4 w-4 text-on-stage/50" />
            <span className="font-heading font-bold leading-snug">{code.title}</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {shared ? (
              <span className="rounded-full bg-on-stage/10 px-2.5 py-1 text-xs font-medium text-on-stage/80">
                {code.owner && `${t.ownerLabel}: ${personName(code.owner, lang)} · `}
                {t[`role.${code.access === "edit" ? "edit" : "view"}`]}
              </span>
            ) : (
              <VisBadge t={t} v={code.visibility} />
            )}
            {code.edition && (
              <span className="rounded-full bg-ink px-2.5 py-1 text-xs font-semibold text-bg">
                {code.edition.design === "number" ? t.numberCode : `${t.editionNo} ${code.edition.no}${code.edition.of !== null ? ` / ${code.edition.of}` : ""}`}
              </span>
            )}
            {code.lost && <span className="rounded-full bg-warn px-2.5 py-1 text-xs font-semibold text-on-warn">{t.lostMode}</span>}
            {unread > 0 && <span className="rounded-full bg-warn-soft px-2.5 py-1 text-xs font-semibold text-warn">{t.messagesBadge}: {unread}</span>}
            {requests > 0 && <span className="rounded-full bg-warn-soft px-2.5 py-1 text-xs font-semibold text-warn">{t.requestsTitle}: {requests}</span>}
          </div>
          <div className="text-xs text-on-stage/60">
            {t.records}: {code.blocks?.length ?? 0}
          </div>
        </div>
      </Link>
    </li>
  );
}

/** «Что сделать»: просроченные и ближайшие 2 недели — по всем моим кодам и тем, где мне можно дописывать. */
function Upcoming({ t, lang, codes, onDone }: { t: Dict; lang: Lang; codes: CodeView[]; onDone: () => void }) {
  const items = codes
    .filter((c) => c.access === "owner" || c.access === "edit")
    .flatMap((c) => (c.tasks ?? []).map((task) => ({ c, task })))
    .filter(({ task }) => daysLeft(task.due) <= 14)
    .sort((a, b) => a.task.due.localeCompare(b.task.due));
  const [busy, setBusy] = useState<string | null>(null);
  if (!items.length) return null;
  const done = async (c: CodeView, task: Task) => {
    setBusy(task.id);
    try {
      await api.doneTask(c.id, task.id);
      onDone();
    } finally {
      setBusy(null);
    }
  };
  return (
    <section className="rounded-2xl border border-line bg-card p-4 sm:p-5">
      <h2 className="font-heading text-lg font-bold">{t.upcomingTitle}</h2>
      <p className="mt-0.5 text-xs text-muted">{t.upcomingHint}</p>
      <ul className="mt-1 divide-y divide-line">
        {items.map(({ c, task }) => (
          <li key={task.id} className="flex items-start gap-3 py-3">
            <DoneCheck label={`${t.markDone}: ${task.text}`} busy={busy === task.id} onClick={() => done(c, task)} />
            <div className="min-w-0 flex-1 pt-1.5">
              <div className="font-medium">{task.text}</div>
              <div className="mt-0.5 text-xs">
                <DueNote t={t} lang={lang} due={task.due} />
                <span className="text-muted"> · </span>
                <Link href={c.access === "owner" ? `/codes/${c.id}` : `/c/${c.id}`} className="text-muted underline underline-offset-2 hover:text-ink">
                  {c.title}
                </Link>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function NewCode({ t, start }: { t: Dict; start: Kind | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(!!start);
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<Kind>(start ?? "memory");
  const [starter, setStarter] = useState<string | null>(null);
  const { lang } = useLang();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="min-h-11 rounded-xl bg-accent px-4 text-sm font-semibold text-on-accent">
        + {t.newCode}
      </button>
    );
  }
  const submit = async () => {
    if (!title.trim()) return;
    setBusy(true);
    try {
      const code = await api.create(title, kind, toSaved(DEFAULT_STYLE), starter ? { id: starter, lang } : undefined);
      router.push(`/codes/${code.id}`);
    } catch {
      setError(true);
      setBusy(false);
    }
  };
  return (
    <form
      className="w-full rounded-2xl border border-line bg-card p-4 sm:p-5"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <div className="mb-1.5 text-sm font-medium text-muted">{t.templateLabel}</div>
      <div role="radiogroup" aria-label={t.templateLabel} className="mb-4 grid gap-2 sm:grid-cols-2">
        {KINDS.filter((k) => k !== "item").map((k) => (
          <button
            key={k}
            type="button"
            role="radio"
            aria-checked={kind === k}
            onClick={() => {
              setKind(k);
              setStarter(null);
            }}
            className={`flex min-w-0 items-start gap-3 rounded-xl border p-3 text-left transition-colors ${kind === k ? "border-accent bg-accent text-on-accent" : "border-line bg-field hover:border-muted"}`}
          >
            <KindIcon kind={k} className="mt-0.5 h-5 w-5" />
            <span className="min-w-0">
              <span className="block text-sm font-semibold">{t[`tpl.${k}`]}</span>
              <span className={`mt-0.5 block text-xs ${kind === k ? "opacity-85" : "text-muted"}`}>{t[`tplHint.${k}`]}</span>
            </span>
          </button>
        ))}
      </div>
      {STARTERS.some((s) => s.kind === kind) && (
        <div className="mb-4">
          <div className="mb-1.5 text-sm font-medium text-muted">{t.starterLabel}</div>
          <div role="radiogroup" aria-label={t.starterLabel} className="flex flex-wrap gap-2">
            {STARTERS.filter((s) => s.kind === kind).map((s) => (
              <button
                key={s.id}
                type="button"
                role="radio"
                aria-checked={starter === s.id}
                title={tr(s.hint, lang)}
                onClick={() => {
                  const next = starter === s.id ? null : s.id;
                  setStarter(next);
                  // Пустое название — подставим название шаблона.
                  if (next && !title.trim()) setTitle(tr(s.name, lang));
                }}
                className={`min-h-10 rounded-xl border px-3 text-left text-sm transition-colors ${starter === s.id ? "border-accent bg-accent text-on-accent" : "border-line bg-field hover:border-muted"}`}
              >
                <span className="block font-semibold">{tr(s.name, lang)}</span>
                <span className={`block text-xs ${starter === s.id ? "opacity-85" : "text-muted"}`}>{tr(s.hint, lang)}</span>
              </button>
            ))}
          </div>
        </div>
      )}
      <label htmlFor="new-code" className="mb-1.5 block text-sm font-medium text-muted">
        {t.newCodeTitle}
      </label>
      <input
        id="new-code"
        value={title}
        maxLength={80}
        placeholder={t.newCodePlaceholder}
        onChange={(e) => setTitle(e.target.value)}
        className="w-full rounded-xl border border-line bg-field px-3.5 py-2.5 text-base outline-none focus:border-accent"
      />
      {error && <p className="mt-2 text-sm text-warn">{t.saveError}</p>}
      <div className="mt-3 flex gap-2">
        <button type="submit" disabled={busy || !title.trim()} className="min-h-11 rounded-xl bg-accent px-4 text-sm font-semibold text-on-accent disabled:opacity-40">
          {t.create}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="min-h-11 rounded-xl px-3 text-sm font-medium text-muted hover:text-ink">
          {t.cancel}
        </button>
      </div>
    </form>
  );
}

export function CodesPage({ startNew = null }: { startNew?: Kind | null }) {
  const { lang, t } = useLang((t) => `${t.navCodes} — ${t.appName}`);
  const { ready, me } = useMe();
  const [data, setData] = useState<{ me: string; list: CodeList } | null>(null);
  const [error, setError] = useState(false);

  const [reload, setReload] = useState(0);
  useEffect(() => {
    if (!me) return;
    let live = true;
    api
      .list()
      .then((list) => live && setData({ me, list }))
      .catch(() => live && setError(true));
    return () => {
      live = false;
    };
  }, [me, reload]);
  const list = data?.me === me ? data.list : null;

  return (
    <Shell t={t} lang={lang}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-2xl">
          <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">{t.codesKicker}</p>
          <h1 className="mt-2 font-heading text-4xl font-extrabold tracking-tight sm:text-6xl">{t.navCodes}</h1>
          <p className="mt-3 text-muted">{t.codesHint}</p>
          {list && list.mine.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2 font-mono text-xs">
              <span className="rounded-full border border-line bg-card px-3 py-1.5">
                <b className="text-ink">{list.mine.length}</b> {t.codesCountLabel}
              </span>
              <span className="rounded-full bg-stage px-3 py-1.5 text-on-stage">
                <b className="text-accent">{list.mine.reduce((n, c) => n + (c.stats?.week ?? 0), 0)}</b> {t.scansWeekLabel}
              </span>
            </div>
          )}
        </div>
        {me && (
          <div className="flex flex-wrap items-start gap-2">
            <Link href="/codes/print" className="grid min-h-11 place-items-center rounded-xl border border-line bg-card px-4 text-sm font-semibold hover:border-muted">
              🖨 {t.printTitle}
            </Link>
            <NewCode t={t} start={startNew} />
          </div>
        )}
      </div>

      <div className="mt-6 space-y-8">
        {!ready ? null : !me ? (
          <div className="rounded-2xl border border-line bg-card p-6 text-center">
            <Link href="/login?next=/codes" className="inline-grid min-h-11 place-items-center rounded-xl bg-accent px-5 text-sm font-semibold text-on-accent">
              {t.login}
            </Link>
          </div>
        ) : error ? (
          <Notice>{t.loadError}</Notice>
        ) : !list ? (
          <Notice>{t.loading}</Notice>
        ) : (
          <>
            <Upcoming t={t} lang={lang} codes={[...list.mine, ...list.shared]} onDone={() => setReload((n) => n + 1)} />
            {list.mine.length ? (
              <MyCodesGrid key={reload} t={t} base={list.base} codes={list.mine} />
            ) : (
              // Пусто — сцена с приглашением, как на главной: первый код делают в генераторе.
              <Link href="/#make" className="group relative block overflow-hidden rounded-[2rem] bg-stage p-8 text-on-stage sm:p-12">
                <div aria-hidden className="pointer-events-none absolute inset-0">
                  <div className="x-stage-grid" />
                  <div className="x-stage-glow" />
                </div>
                <span className="relative block font-heading text-3xl font-extrabold sm:text-5xl">{t.firstCodeTitle}</span>
                <span className="relative mt-3 block max-w-md text-on-stage/70">{t.emptyCodes}</span>
                <span className="relative mt-7 inline-flex min-h-13 items-center gap-3 rounded-xl bg-accent px-6 font-heading text-base font-bold text-on-accent">
                  {t.firstCodeCta} <span className="transition-transform group-hover:translate-x-1">→</span>
                </span>
              </Link>
            )}
            {list.items.length > 0 && (
              <section>
                <h2 className="font-heading text-xl font-bold">{t.myItems}</h2>
                <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {list.items.map((c) => (
                    <li key={c.id}>
                      <Link href={`/c/${c.id}`} className="flex items-center gap-3 rounded-2xl border border-line bg-card p-4 hover:border-muted">
                        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-ok-soft text-ok">✓</span>
                        <span className="min-w-0">
                          <span className="block truncate font-semibold">{c.auth?.brand}</span>
                          <span className="block truncate text-xs text-muted">
                            {c.auth?.product} · {t.editionNo} {c.auth?.serial}
                          </span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {list.shared.length > 0 && (
              <section>
                <h2 className="font-heading text-xl font-bold">{t.sharedTitle}</h2>
                <p className="mb-3 mt-1 text-sm text-muted">{t.sharedHint}</p>
                <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {list.shared.map((c) => (
                    <CodeCard key={c.id} t={t} lang={lang} base={list.base} code={c} shared />
                  ))}
                </ul>
              </section>
            )}
          </>
        )}
      </div>
    </Shell>
  );
}
