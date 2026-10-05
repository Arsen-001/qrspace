"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useLang } from "@/lib/lang";
import { signIn, useMe } from "@/lib/me";
import { PEOPLE } from "@/lib/people";
import { Avatar } from "./Avatar";
import { Shell } from "./Shell";

/** Демо-вход: выбрать человека. Только адреса нашего сайта — на чужие не уводим. */
export function LoginPage({ next }: { next: string | null }) {
  const { lang, t } = useLang((t) => `${t.loginTitle} — ${t.appName}`);
  const { me } = useMe();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const target = next && next.startsWith("/") && !next.startsWith("//") && next !== "/login" ? next : "/codes";

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

  return (
    <Shell t={t} lang={lang} narrow>
      <h1 className="font-heading text-3xl font-extrabold tracking-tight">{t.loginTitle}</h1>
      <p className="mt-2 text-sm text-muted">{t.loginHint}</p>
      <ul className="mt-6 grid gap-2">
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
                <span className="block font-semibold">{p.name[lang]}</span>
                <span className="block text-sm text-muted">{p.demo[lang]}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
      {me && (
        <button type="button" disabled={busy} onClick={() => pick(null)} className="mt-4 min-h-11 rounded-xl px-3 text-sm font-medium text-muted hover:text-ink">
          {t.logout}
        </button>
      )}
    </Shell>
  );
}
