"use client";
// Что видит человек после скана: память (если ему открыто) или «Код закрыт» с просьбой о доступе.
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { api, type CodeView } from "@/lib/codes";
import type { Dict } from "@/lib/i18n";
import { useLang } from "@/lib/lang";
import { useMe } from "@/lib/me";
import { Avatar, personName } from "./Avatar";
import { Memory } from "./Memory";
import { Notice, Shell } from "./Shell";

function Lock() {
  return (
    <svg viewBox="0 0 24 24" className="mx-auto h-12 w-12 text-muted" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

const primary = "inline-grid min-h-12 place-items-center rounded-xl bg-accent px-5 text-sm font-semibold text-on-accent disabled:opacity-50";

function Closed({ t, code, me, id, invite, onChange }: { t: Dict; code: CodeView; me: string | null; id: string; invite: string | null; onChange: (v: CodeView) => void }) {
  const [busy, setBusy] = useState(false);
  const [inviteBad, setInviteBad] = useState(false);
  const next = `/c/${id}${invite ? `?invite=${encodeURIComponent(invite)}` : ""}`;
  const run = async (fn: () => Promise<CodeView>) => {
    setBusy(true);
    try {
      onChange(await fn());
    } catch {
      setInviteBad(true);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="rounded-2xl border border-line bg-card p-6 text-center sm:p-8">
      <Lock />
      <h1 className="mt-3 font-heading text-2xl font-extrabold">{invite && !inviteBad ? t.inviteJoin : t.closedTitle}</h1>
      {!(invite && !inviteBad) && <p className="mt-2 text-sm text-muted">{code.visibility === "me" ? t.closedMe : t.closedHint}</p>}
      {inviteBad && <p className="mt-2 text-sm text-warn">{t.inviteBad}</p>}
      <div className="mt-5">
        {!me ? (
          <>
            <Link href={`/login?next=${encodeURIComponent(next)}`} className={primary}>
              {invite ? t.login : t.loginToAsk}
            </Link>
            <p className="mt-3 text-xs text-muted">{t.loginToAskHint}</p>
          </>
        ) : invite && !inviteBad ? (
          <button type="button" disabled={busy} onClick={() => run(() => api.join(id, invite))} className={primary}>
            {t.accept}
          </button>
        ) : code.requested ? (
          <p className="text-sm font-medium text-ok">✓ {t.asked}</p>
        ) : (
          <button type="button" disabled={busy} onClick={() => run(() => api.request(id))} className={primary}>
            {t.askAccess}
          </button>
        )}
      </div>
    </div>
  );
}

export function ScanPage({ id, invite }: { id: string; invite: string | null }) {
  const { lang, t } = useLang((t) => t.appName);
  const { ready, me } = useMe();
  const [state, setState] = useState<{ me: string | null; code: CodeView | null; error?: boolean } | null>(null);
  // Скан пишем в историю один раз на открытие страницы (в разработке React запускает эффект дважды).
  const visited = useRef(false);

  useEffect(() => {
    if (!ready) return;
    let live = true;
    const visit = !visited.current;
    visited.current = true;
    api
      .get(id, { visit })
      .then((code) => live && setState({ me, code }))
      .catch((e: Error) => live && setState({ me, code: null, error: e.message !== "404" }));
    return () => {
      live = false;
    };
  }, [id, me, ready]);
  const loaded = state && state.me === me ? state : null;
  const code = loaded?.code;
  const setCode = (c: CodeView) => setState({ me, code: c });

  return (
    <Shell t={t} lang={lang} narrow>
      {!loaded ? (
        <Notice>{t.loading}</Notice>
      ) : loaded.error ? (
        <Notice>{t.loadError}</Notice>
      ) : !code ? (
        <div className="rounded-2xl border border-line bg-card p-8 text-center">
          <h1 className="font-heading text-2xl font-extrabold">{t.notFound}</h1>
          <p className="mt-2 text-sm text-muted">{t.notFoundHint}</p>
        </div>
      ) : code.access === "closed" ? (
        <Closed key={me ?? ""} t={t} code={code} me={me} id={id} invite={invite} onChange={setCode} />
      ) : (
        <>
          {code.access === "owner" && (
            <div className="mb-4 flex items-center justify-between gap-3 rounded-2xl bg-accent/10 p-3 pl-4">
              <span className="text-sm font-medium">{t.youOwner}</span>
              <Link href={`/codes/${id}`} className="grid min-h-10 place-items-center rounded-xl bg-accent px-4 text-sm font-semibold text-on-accent">
                {t.editCode}
              </Link>
            </div>
          )}
          <h1 className="font-heading text-3xl font-extrabold leading-tight tracking-tight">{code.title}</h1>
          <div className="mb-5 mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
            <span className="flex items-center gap-1.5">
              <Avatar id={code.owner} lang={lang} size={22} />
              {personName(code.owner, lang)}
            </span>
            {code.access === "edit" && <span className="font-medium text-ok">✎ {t.canEdit}</span>}
          </div>
          <Memory t={t} lang={lang} code={code} me={me} onChange={setCode} />
        </>
      )}

      <footer className="mt-10 flex flex-col items-center gap-2 text-center text-sm text-muted">
        <span>{t.madeWith}</span>
        <Link href="/" className="font-semibold text-accent">
          {t.makeYours} →
        </Link>
      </footer>
    </Shell>
  );
}
