"use client";
// Окно входа поверх страницы (владелец 08.10.2026): скачать без входа нельзя — вместо перехода на /login спрашиваем здесь.
// Демо-вход — сразу, без ухода со страницы; Google и Apple уводят и возвращают на ту же страницу (next).
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { tr, type Dict, type Lang } from "@/lib/i18n";
import { legalFor } from "@/lib/legal";
import { signIn, useMe } from "@/lib/me";
import { PEOPLE } from "@/lib/people";
import { Avatar } from "./Avatar";
import { AppleIcon, GoogleIcon } from "./LoginPage";

export function LoginModal({ t, lang, next, onClose, onDone, beforeLeave }: { t: Dict; lang: Lang; next: string; onClose: () => void; onDone: () => void; beforeLeave?: () => void }) {
  const { demo } = useMe();
  const [busy, setBusy] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
  const q = `?next=${encodeURIComponent(next)}`;

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panel.current?.querySelector<HTMLElement>("a, button")?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const pick = async (id: string) => {
    setBusy(true);
    try {
      await signIn(id);
      onDone();
    } finally {
      setBusy(false);
    }
  };
  const btn = "flex min-h-13 w-full items-center justify-center gap-3 rounded-xl px-5 py-3 text-base font-semibold transition-opacity";

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center sm:p-4" onClick={onClose}>
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={t.loginModalTitle}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[92dvh] w-full overflow-y-auto rounded-t-3xl bg-card shadow-2xl sm:max-w-md sm:rounded-3xl"
      >
        <div className="relative overflow-hidden bg-stage p-6 text-on-stage">
          <div aria-hidden className="x-stage-glow" />
          <button type="button" onClick={onClose} aria-label={t.cancel} className="absolute right-3 top-3 grid h-10 w-10 place-items-center rounded-full text-on-stage/70 hover:bg-white/10 hover:text-on-stage">
            ✕
          </button>
          <div className="relative">
            <span aria-hidden className="grid h-12 w-12 place-items-center rounded-2xl bg-accent text-on-accent">
              <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 4v11m0 0-4.5-4.5M12 15l4.5-4.5M5 20h14" />
              </svg>
            </span>
            <h2 className="mt-4 font-heading text-2xl font-extrabold">{t.loginModalTitle}</h2>
            <p className="mt-2 text-sm leading-relaxed text-on-stage/70">{t.loginModalText}</p>
          </div>
        </div>
        <div className="space-y-3 p-6">
          {/* Обычные ссылки: вход уходит на страницу Google/Apple и возвращается сюда же. */}
          <a href={`/api/auth/google${q}`} onClick={beforeLeave} className={`${btn} border border-[#dadce0] bg-white text-[#1f1f1f] hover:bg-[#f8f9fa]`}>
            <GoogleIcon />
            {t.withGoogle}
          </a>
          <a href={`/api/auth/apple${q}`} onClick={beforeLeave} className={`${btn} bg-black text-white hover:opacity-90`}>
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
          {demo && (
            <div className="border-t border-line pt-4">
              <div className="mb-2 text-sm font-semibold">{t.demoLoginTitle}</div>
              <div className="grid grid-cols-2 gap-2">
                {PEOPLE.slice(0, 6).map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    disabled={busy}
                    onClick={() => pick(p.id)}
                    className="flex min-w-0 items-center gap-2 rounded-xl border border-line bg-field p-2 text-left text-sm font-semibold hover:border-muted disabled:opacity-60"
                  >
                    <Avatar id={p.id} lang={lang} size={28} />
                    <span className="truncate">{tr(p.name, lang)}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
