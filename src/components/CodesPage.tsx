"use client";
// «Мои коды»: свои коды с памятью и коды, которые открыли мне.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api, linkOf, daysLeft, KINDS, type CodeList, type CodeView, type Kind, type Task } from "@/lib/codes";
import type { Dict, Lang } from "@/lib/i18n";
import { useLang } from "@/lib/lang";
import { useMe } from "@/lib/me";
import { DEFAULT_STYLE, toSaved } from "@/lib/qr/style";
import { personName } from "./Avatar";
import { KindIcon } from "./KindIcon";
import { QrThumb } from "./QrThumb";
import { DueNote } from "./Tasks";
import { Notice, Shell } from "./Shell";
import { VisBadge } from "./VisBadge";

function CodeCard({ t, lang, base, code, shared }: { t: Dict; lang: Lang; base: string; code: CodeView; shared?: boolean }) {
  const requests = code.requests?.length ?? 0;
  const unread = code.messages?.filter((m) => !m.read).length ?? 0;
  return (
    <li>
      <Link href={shared ? `/c/${code.id}` : `/codes/${code.id}`} className="flex h-full gap-4 rounded-2xl border border-line bg-card p-4 transition-colors hover:border-muted">
        <QrThumb link={linkOf(base, code)} style={code.style} className="h-24 w-24 shrink-0 border border-line" />
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex items-start gap-1.5">
            <KindIcon kind={code.kind} className="mt-0.5 h-4 w-4 text-muted" />
            <span className="font-heading font-bold leading-snug">{code.title}</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {shared ? (
              <span className="rounded-full bg-field px-2.5 py-1 text-xs font-medium text-muted">
                {code.owner && `${t.ownerLabel}: ${personName(code.owner, lang)} · `}
                {t[`role.${code.access === "edit" ? "edit" : "view"}`]}
              </span>
            ) : (
              <VisBadge t={t} v={code.visibility} />
            )}
            {code.edition && (
              <span className="rounded-full bg-ink px-2.5 py-1 text-xs font-semibold text-bg">
                {t.editionNo} {code.edition.no}
                {code.edition.of !== null && ` / ${code.edition.of}`}
              </span>
            )}
            {code.lost && <span className="rounded-full bg-warn px-2.5 py-1 text-xs font-semibold text-white">{t.lostMode}</span>}
            {unread > 0 && <span className="rounded-full bg-warn-soft px-2.5 py-1 text-xs font-semibold text-warn">{t.messagesBadge}: {unread}</span>}
            {requests > 0 && <span className="rounded-full bg-warn-soft px-2.5 py-1 text-xs font-semibold text-warn">{t.requestsTitle}: {requests}</span>}
          </div>
          <div className="text-xs text-muted">
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
          <li key={task.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 py-3">
            <div className="min-w-0 flex-1 basis-56">
              <div className="font-medium">{task.text}</div>
              <div className="mt-0.5 text-xs">
                <DueNote t={t} lang={lang} due={task.due} />
                <span className="text-muted"> · </span>
                <Link href={c.access === "owner" ? `/codes/${c.id}` : `/c/${c.id}`} className="text-muted underline underline-offset-2 hover:text-ink">
                  {c.title}
                </Link>
              </div>
            </div>
            <button type="button" disabled={busy === task.id} onClick={() => done(c, task)} className="min-h-10 rounded-xl bg-ok px-4 text-sm font-semibold text-white disabled:opacity-50">
              ✓ {t.markDone}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function NewCode({ t }: { t: Dict }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<Kind>("memory");
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
      const code = await api.create(title, kind, toSaved(DEFAULT_STYLE));
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
            onClick={() => setKind(k)}
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

export function CodesPage() {
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
          <h1 className="font-heading text-3xl font-extrabold tracking-tight sm:text-4xl">{t.navCodes}</h1>
          <p className="mt-2 text-sm text-muted">{t.codesHint}</p>
        </div>
        {me && (
          <div className="flex flex-wrap items-start gap-2">
            <Link href="/codes/print" className="grid min-h-11 place-items-center rounded-xl border border-line bg-card px-4 text-sm font-semibold hover:border-muted">
              🖨 {t.printTitle}
            </Link>
            <NewCode t={t} />
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
              <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {list.mine.map((c) => (
                  <CodeCard key={c.id} t={t} lang={lang} base={list.base} code={c} />
                ))}
              </ul>
            ) : (
              <Notice>{t.emptyCodes}</Notice>
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
