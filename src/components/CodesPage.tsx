"use client";
// «Мои коды»: свои коды с памятью и коды, которые открыли мне.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api, codeLink, KINDS, type CodeList, type CodeView, type Kind } from "@/lib/codes";
import type { Dict, Lang } from "@/lib/i18n";
import { useLang } from "@/lib/lang";
import { useMe } from "@/lib/me";
import { DEFAULT_STYLE, toSaved } from "@/lib/qr/style";
import { personName } from "./Avatar";
import { KindIcon } from "./KindIcon";
import { QrThumb } from "./QrThumb";
import { Notice, Shell } from "./Shell";
import { VisBadge } from "./VisBadge";

function CodeCard({ t, lang, base, code, shared }: { t: Dict; lang: Lang; base: string; code: CodeView; shared?: boolean }) {
  const requests = code.requests?.length ?? 0;
  const unread = code.messages?.filter((m) => !m.read).length ?? 0;
  return (
    <li>
      <Link href={shared ? `/c/${code.id}` : `/codes/${code.id}`} className="flex h-full gap-4 rounded-2xl border border-line bg-card p-4 transition-colors hover:border-muted">
        <QrThumb link={codeLink(base, code.id)} style={code.style} className="h-24 w-24 shrink-0 border border-line" />
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
        {KINDS.map((k) => (
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
  }, [me]);
  const list = data?.me === me ? data.list : null;

  return (
    <Shell t={t} lang={lang}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-2xl">
          <h1 className="font-heading text-3xl font-extrabold tracking-tight sm:text-4xl">{t.navCodes}</h1>
          <p className="mt-2 text-sm text-muted">{t.codesHint}</p>
        </div>
        {me && <NewCode t={t} />}
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
            {list.mine.length ? (
              <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {list.mine.map((c) => (
                  <CodeCard key={c.id} t={t} lang={lang} base={list.base} code={c} />
                ))}
              </ul>
            ) : (
              <Notice>{t.emptyCodes}</Notice>
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
