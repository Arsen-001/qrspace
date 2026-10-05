"use client";
// Что видит человек после скана: память (если ему открыто) или «Код закрыт» с просьбой о доступе.
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { api, PRESETS, type CodeView } from "@/lib/codes";
import { fill, type Dict, type Lang } from "@/lib/i18n";
import { fmtDate } from "@/lib/format";
import { KindIcon } from "./KindIcon";
import { useLang } from "@/lib/lang";
import { refreshPeople, useMe } from "@/lib/me";
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

/** Вещь бренда: «Оригинал», чья она, регистрация секретом, передача при продаже, тревога «возможно, копия». */
function AuthCard({ t, lang, code, me, onChange }: { t: Dict; lang: Lang; code: CodeView; me: string | null; onChange: (v: CodeView) => void }) {
  const a = code.auth!;
  const [secret, setSecret] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "bad" | "taken">("idle");
  const [given, setGiven] = useState<string | null>(null);
  const claim = async () => {
    setState("busy");
    try {
      onChange(await api.claimItem(code.id, secret));
      setState("idle");
    } catch (e) {
      setState((e as Error).message === "409" ? "taken" : "bad");
    }
  };
  const warn = a.status === "taken" || a.suspicious;
  return (
    <div className="space-y-4">
      <section className={`rounded-2xl p-5 text-white ${warn ? "bg-warn" : "bg-ok"}`}>
        <div className="text-sm font-semibold uppercase tracking-wider opacity-90">{a.brand}</div>
        <div className="mt-1 font-heading text-3xl font-extrabold leading-tight">{warn ? `⚠ ${t.authCheck}` : `✓ ${t.authOriginal}`}</div>
        <div className="mt-2 text-sm opacity-95">
          {a.product} · {t.editionNo} {a.serial}
        </div>
      </section>
      {a.suspicious && <p className="rounded-2xl bg-warn-soft p-4 text-sm font-medium text-warn">{t.authSuspicious}</p>}
      <section className="rounded-2xl border border-line bg-card p-5">
        {a.status === "mine" ? (
          <>
            <p className="font-semibold">✓ {fill(t.authMine, { date: a.claimedAt ? fmtDate(a.claimedAt.slice(0, 10), lang) : "" })}</p>
            {given ? (
              <p className="mt-3 rounded-xl bg-field p-3 text-sm">
                {t.authGiveSecret} <span className="select-all font-mono text-lg font-bold tracking-widest">{given}</span>
              </p>
            ) : (
              <button
                type="button"
                onClick={async () => {
                  const r = await api.releaseItem(code.id);
                  setGiven(r.secret);
                  onChange(r.view);
                }}
                className="mt-3 min-h-11 rounded-xl border border-line bg-field px-4 text-sm font-semibold hover:border-muted"
              >
                {t.authSell}
              </button>
            )}
          </>
        ) : (
          <>
            <p className="font-semibold">{a.status === "free" ? t.authFree : fill(t.authTaken, { date: a.claimedAt ? fmtDate(a.claimedAt.slice(0, 10), lang) : "" })}</p>
            {a.status === "taken" && <p className="mt-1 text-sm text-muted">{a.transferable ? t.authTransferable : t.authTakenHint}</p>}
            {(a.status === "free" || a.transferable) &&
              (me ? (
                <form
                  className="mt-4 flex flex-wrap gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (secret.trim()) claim();
                  }}
                >
                  <input
                    value={secret}
                    onChange={(e) => setSecret(e.target.value)}
                    placeholder={t.authSecret}
                    aria-label={t.authSecret}
                    autoCapitalize="characters"
                    className="min-h-12 min-w-0 flex-1 rounded-xl border border-line bg-field px-3.5 font-mono text-lg tracking-widest uppercase"
                  />
                  <button type="submit" disabled={state === "busy" || !secret.trim()} className={primary}>
                    {t.authClaim}
                  </button>
                  {state === "bad" && <p className="w-full text-sm text-warn">{t.authBadSecret}</p>}
                  {state === "taken" && <p className="w-full text-sm text-warn">{t.authTakenHint}</p>}
                </form>
              ) : (
                <Link href={`/login?next=${encodeURIComponent(`/c/${code.id}`)}`} className={`${primary} mt-4`}>
                  {t.authLoginToClaim}
                </Link>
              ))}
          </>
        )}
      </section>
    </div>
  );
}

/** Крупно, если хозяин включил «Потеряно». */
function LostBanner({ t, code }: { t: Dict; code: CodeView }) {
  return (
    <div className="mb-5 rounded-2xl bg-warn p-5 text-white">
      <div className="font-heading text-2xl font-extrabold leading-tight">{t[`lostBanner.${code.kind}`]}</div>
      {code.reward && (
        <div className="mt-2 text-sm font-medium">
          {t.reward}: <span className="text-base font-bold">{code.reward}</span>
        </div>
      )}
    </div>
  );
}

/** «Связь через нас»: готовые сообщения, свой текст, контакт для ответа — по желанию. Номер хозяина — только по выключателю. */
function ContactBox({ t, code }: { t: Dict; code: CodeView }) {
  const presets = PRESETS[code.kind];
  const [preset, setPreset] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [reply, setReply] = useState("");
  const [share, setShare] = useState(false);
  const [state, setState] = useState<"idle" | "sending" | "sent" | "limit" | "error">("idle");
  const field = "w-full rounded-xl border border-line bg-field px-3.5 py-2.5 text-base outline-none transition-colors focus:border-accent";

  const send = async () => {
    setState("sending");
    try {
      // Место — только по согласию нашедшего; не дал доступ или нет GPS — отправляем без него.
      const place = share
        ? await new Promise<{ lat: number; lon: number } | undefined>((done) =>
            navigator.geolocation
              ? navigator.geolocation.getCurrentPosition((p) => done({ lat: p.coords.latitude, lon: p.coords.longitude }), () => done(undefined), { timeout: 8000, maximumAge: 60_000 })
              : done(undefined),
          )
        : undefined;
      await api.message(code.id, { preset, text, reply, place });
      setState("sent");
      setPreset(null);
      setText("");
    } catch (e) {
      setState((e as Error).message === "429" ? "limit" : "error");
    }
  };

  return (
    <section className="mt-5 rounded-2xl border border-line bg-card p-5">
      {code.contact.phone && (
        <a href={`tel:${code.contact.phone.replace(/[^\d+]/g, "")}`} className="mb-5 flex min-h-14 flex-col items-center justify-center rounded-xl bg-ok px-4 py-2.5 text-white">
          <span className="text-base font-semibold">{t.callOwner}</span>
          <span className="text-sm opacity-90">{code.contact.phone}</span>
        </a>
      )}
      <h2 className="font-heading text-lg font-bold">{t.sendTitle}</h2>
      <p className="mt-1 text-sm text-muted">{t.sendHint}</p>
      {state === "sent" ? (
        <div className="mt-4 rounded-xl bg-ok-soft p-4">
          <p className="text-sm font-semibold text-ok">✓ {t.sent}</p>
          <button type="button" onClick={() => setState("idle")} className="mt-2 min-h-10 text-sm font-medium underline underline-offset-2">
            {t.sendMore}
          </button>
        </div>
      ) : (
        <form
          className="mt-4 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (preset || text.trim()) send();
          }}
        >
          {presets.length > 0 && (
            <div role="radiogroup" aria-label={t.sendTitle} className="flex flex-wrap gap-2">
              {presets.map((p) => (
                <button
                  key={p}
                  type="button"
                  role="radio"
                  aria-checked={preset === p}
                  onClick={() => setPreset(preset === p ? null : p)}
                  className={`min-h-11 rounded-xl border px-3.5 text-left text-sm font-medium transition-colors ${preset === p ? "border-accent bg-accent text-on-accent" : "border-line bg-field hover:border-muted"}`}
                >
                  {t[`preset.${p}` as keyof Dict]}
                </button>
              ))}
            </div>
          )}
          <textarea value={text} rows={3} maxLength={500} placeholder={t.messagePlaceholder} onChange={(e) => setText(e.target.value)} className={`${field} resize-y`} />
          <input value={reply} maxLength={100} placeholder={t.replyPlaceholder} onChange={(e) => setReply(e.target.value)} className={field} autoComplete="tel" />
          {code.kind !== "memory" && (
            <label className="flex cursor-pointer items-start gap-2 text-sm">
              <input type="checkbox" checked={share} onChange={(e) => setShare(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[var(--accent)]" />
              <span>
                {t.shareWhere}
                <span className="block text-xs text-muted">{t.shareWhereHint}</span>
              </span>
            </label>
          )}
          {state === "limit" && <p className="text-sm text-warn">{t.sendLimit}</p>}
          {state === "error" && <p className="text-sm text-warn">{t.sendError}</p>}
          <button type="submit" disabled={state === "sending" || !(preset || text.trim())} className={primary}>
            {state === "sending" ? t.sending : t.send}
          </button>
        </form>
      )}
      {code.kind === "lost" && <p className="mt-4 text-xs text-muted">{t.returnSafe}</p>}
    </section>
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
      .then((code) => refreshPeople().then(() => live && setState({ me, code })))
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
          {code.lost && code.kind !== "item" && <LostBanner t={t} code={code} />}
          {code.auth && <AuthCard t={t} lang={lang} code={code} me={me} onChange={setCode} />}
          {code.kind === "item" ? null : code.access === "closed" && code.kind === "memory" ? (
            <Closed key={me ?? ""} t={t} code={code} me={me} id={id} invite={invite} onChange={setCode} />
          ) : (
            <>
              <h1 className="flex items-start gap-2 font-heading text-3xl font-extrabold leading-tight tracking-tight">
                {code.kind !== "memory" && <KindIcon kind={code.kind} className="mt-1.5 h-7 w-7 text-muted" />}
                <span className="min-w-0">{code.title ?? t[`heading.${code.kind === "car" ? "car" : "lost"}`]}</span>
              </h1>
              <div className="mb-5 mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
                {code.owner && (
                  <span className="flex items-center gap-1.5">
                    <Avatar id={code.owner} lang={lang} size={22} />
                    {personName(code.owner, lang)}
                  </span>
                )}
                {code.access === "edit" && <span className="font-medium text-ok">✎ {t.canEdit}</span>}
              </div>
              {code.access !== "closed" && (code.kind === "memory" || code.access !== "view" || !!code.blocks?.length) && (
                <Memory t={t} lang={lang} code={code} me={me} onChange={setCode} />
              )}
            </>
          )}
          {code.contact.enabled && code.access !== "owner" && <ContactBox t={t} code={code} />}
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
