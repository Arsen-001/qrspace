"use client";
// Вход только через Google или Apple. Демо-люди — пока не выключены (DEMO_LOGIN=off), для проверки.
import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import { legalFor } from "@/lib/legal";
import { tr } from "@/lib/i18n";
import { useLang } from "@/lib/lang";
import { signIn, useMe } from "@/lib/me";
import { PEOPLE } from "@/lib/people";
import { Avatar } from "./Avatar";
import { Shell } from "./Shell";

export function GoogleIcon() {
  return (
    <svg viewBox="0 0 48 48" className="h-5 w-5" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.6-.4-3.9z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.6-.4-3.9z" />
    </svg>
  );
}

export function AppleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden>
      <path d="M16.37 12.6c-.02-2.3 1.88-3.4 1.96-3.46-1.07-1.56-2.73-1.77-3.32-1.8-1.41-.14-2.76.83-3.48.83-.72 0-1.82-.81-3-.79-1.54.02-2.96.9-3.76 2.28-1.6 2.78-.41 6.9 1.15 9.16.76 1.1 1.67 2.34 2.86 2.3 1.15-.05 1.58-.74 2.97-.74 1.38 0 1.77.74 2.98.72 1.23-.02 2.01-1.12 2.76-2.23.87-1.28 1.23-2.52 1.25-2.58-.03-.01-2.4-.92-2.42-3.66zM14.1 5.86c.63-.77 1.06-1.83.94-2.89-.91.04-2.02.61-2.67 1.37-.58.67-1.1 1.76-.96 2.8 1.02.08 2.06-.52 2.69-1.28z" />
    </svg>
  );
}

export function LoginPage({ next, error }: { next: string | null; error: string | null }) {
  const { lang, t } = useLang((t) => `${t.loginTitle} — ${t.appName}`);
  const { ready, me, demo, providers } = useMe();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const target = next && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/login") ? next : "/codes";
  const q = `?next=${encodeURIComponent(target)}`;

  const pick = async (id: string | null) => {
    setBusy(true);
    try {
      await signIn(id);
      router.replace(id ? target : "/");
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  const btn = "flex min-h-13 w-full items-center justify-center gap-3 rounded-xl px-5 py-3 text-base font-semibold transition-opacity";
  return (
    <Shell t={t} lang={lang}>
      <div className="mx-auto grid max-w-5xl gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:items-stretch">
      {/* Зачем входить — коротко, на чёрной «сцене», как на главной. */}
      <section className="relative overflow-hidden rounded-2xl bg-stage p-6 text-on-stage sm:p-8">
        <div aria-hidden className="x-stage-glow" />
        <div className="relative">
          <h1 className="font-heading text-3xl font-extrabold tracking-tight sm:text-4xl">{t.loginTitle}</h1>
          <p className="mt-2 text-sm text-on-stage/70">{t.loginOnlyHint}</p>
          <ul className="mt-6 space-y-3 text-sm">
            {[t.loginPerk1, t.loginPerk2, t.loginPerk3].map((x) => (
              <li key={x} className="flex items-start gap-3">
                <span aria-hidden className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md bg-accent text-[11px] font-bold text-on-accent">
                  ✓
                </span>
                {x}
              </li>
            ))}
          </ul>
        </div>
      </section>
      <section className="rounded-2xl border border-line bg-card p-6 sm:p-8">
      {error && <p className="mb-4 rounded-xl bg-warn-soft p-3 text-sm text-warn">{error.endsWith("-off") ? t.providerOff : t.loginFailed}</p>}
      <div className="space-y-3">
        {/* Обычные ссылки: вход уходит на страницу Google/Apple и возвращается к нам. */}
        <a href={`/api/auth/google${q}`} className={`${btn} border border-[#dadce0] bg-white text-[#1f1f1f] hover:bg-[#f8f9fa]`}>
          <GoogleIcon />
          {t.withGoogle}
        </a>
        <a href={`/api/auth/apple${q}`} className={`${btn} bg-black text-white hover:opacity-90`}>
          <AppleIcon />
          {t.withApple}
        </a>
        <p className="text-xs text-muted">
          {t.loginAgree}{" "}
          <Link href="/legal/terms" className="underline underline-offset-2 hover:text-ink">
            {legalFor(lang).terms.title}
          </Link>{" "}
          ·{" "}
          <Link href="/legal/privacy" className="underline underline-offset-2 hover:text-ink">
            {legalFor(lang).privacy.title}
          </Link>
        </p>
        {ready && (!providers.google || !providers.apple) && <p className="text-xs text-muted">{t.providersPending}</p>}
      </div>

      {me && (
        <button type="button" disabled={busy} onClick={() => pick(null)} className="mt-4 min-h-11 rounded-xl px-3 text-sm font-medium text-muted hover:text-ink">
          {t.logout}
        </button>
      )}
      </section>
      </div>

      {demo && (
        <section className="mx-auto mt-8 max-w-5xl border-t border-line pt-6">
          <h2 className="font-heading text-lg font-bold">{t.demoLoginTitle}</h2>
          <p className="mt-1 text-sm text-muted">{t.loginHint}</p>
          <ul className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {PEOPLE.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => pick(p.id)}
                  className={`flex w-full items-center gap-3 rounded-2xl border bg-card p-4 text-left transition-colors hover:border-muted disabled:opacity-60 ${me === p.id ? "border-accent" : "border-line"}`}
                >
                  <Avatar id={p.id} lang={lang} size={44} />
                  <span className="min-w-0">
                    <span className="block font-semibold">{tr(p.name, lang)}</span>
                    <span className="block text-sm text-muted">{tr(p.demo, lang)}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </Shell>
  );
}
