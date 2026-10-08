"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/codes";
import type { Dict } from "@/lib/i18n";
import { useMe } from "@/lib/me";
import { PRICES, type Quote, type Tier } from "@/lib/pricing";
import { useInBrowser } from "./QrThumb";
import { type Drawing, toSvg } from "@/lib/qr/render";
import { downloadLive, downloadPng, downloadSvg } from "@/lib/qr/raster";
import { useLang } from "@/lib/lang";
import { LoginModal } from "./LoginModal";
import { StepBadge } from "./ui";

export type ScanState = "idle" | "checking" | "ok" | "bad";

/**
 * Оплата при скачивании: tier — простой или красивый, key — какой это код (считается только по нажатию).
 * finalize — перед сохранением получить настоящий код (генератор: короткая ссылка вместо образца);
 * blocked — скачать нельзя, вместо кнопок — объяснение.
 */
export type Gate = { tier: Tier; key: () => string; finalize?: () => Promise<{ drawing: Drawing; payload: string }>; blocked?: string; beforeLogin?: () => void };
type Format = "png" | "svg" | "live";

/** sample — показываем пример (человек ещё ничего не ввёл): видно оформление, скачать нельзя. step — номер шага в генераторе. */
export function Preview({
  t,
  drawing,
  scan,
  error,
  name = "qr-code",
  gate,
  payload,
  sample,
  step,
}: {
  t: Dict;
  drawing: Drawing | null;
  scan: ScanState;
  error: string | null;
  name?: string;
  gate?: Gate | null;
  payload?: string;
  sample?: boolean;
  step?: number;
}) {
  const [forced, setForced] = useState(false);
  const canDownload = !!drawing && !sample && !gate?.blocked && (scan === "ok" || (scan === "bad" && forced));
  const [failed, setFailed] = useState(false);
  const { me } = useMe();
  const path = usePathname();
  const [pay, setPay] = useState<{ format: Format; quote: Quote | null; key: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const [live, setLive] = useState<number | "bad" | null>(null);
  // Запись видео есть не во всех браузерах; на сервере кнопку не рисуем — иначе страницы не совпадут.
  const canRecord = useInBrowser() && typeof MediaRecorder !== "undefined";
  const save = async (format: Format) => {
    if (!drawing) return;
    let d = drawing;
    let text = payload ?? "";
    if (gate?.finalize) {
      setFailed(false);
      const f = await gate.finalize().catch(() => null);
      if (!f) return setFailed(true);
      ({ drawing: d, payload: text } = f);
    }
    if (format === "png") return downloadPng(d, 2048, name);
    if (format === "svg") return downloadSvg(d, name);
    // Живой код пишется в реальном времени (4 с) — показываем, сколько осталось.
    setLive(0);
    const ok = await downloadLive(d, text, name, (p) => setLive(p)).catch(() => false);
    setLive(ok ? null : "bad");
  };
  const { lang } = useLang();
  // Без входа — окно входа поверх страницы; после демо-входа скачивание продолжается само.
  const [login, setLogin] = useState<Format | null>(null);
  const download = async (format: Format, signedIn = false) => {
    if (!gate) return save(format);
    const key = gate.key();
    if (!me && !signedIn) return setLogin(format);
    setBusy(true);
    try {
      const q = await api.quote(key, gate.tier);
      if (q.paid) {
        setPay(null);
        await save(format);
      } else setPay({ format, quote: q, key });
    } finally {
      setBusy(false);
    }
  };
  const confirm = async () => {
    if (!pay || !gate) return;
    setBusy(true);
    try {
      await api.pay(pay.key, gate.tier);
      await save(pay.format);
      setPay(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-2xl border border-line bg-card p-5 sm:p-6">
      {step && (
        <h2 className="mb-4 flex items-center gap-3 font-heading text-lg font-bold">
          <StepBadge n={step} />
          {t.step3}
        </h2>
      )}
      <div className="relative mx-auto aspect-square w-full max-w-[420px] overflow-hidden rounded-xl border border-line bg-field">
        {drawing ? (
          <>
            <div className={`h-full w-full transition-opacity [&>svg]:h-full [&>svg]:w-full ${sample ? "opacity-85" : ""}`} dangerouslySetInnerHTML={{ __html: toSvg(drawing, 420) }} />
            {sample && <span className="absolute left-3 top-3 rounded-md bg-stage px-2.5 py-1 font-mono text-xs font-bold uppercase tracking-wider text-accent">{t.sampleBadge}</span>}
          </>
        ) : (
          <div className="grid h-full place-items-center p-8 text-center text-sm text-muted">{error ?? t.previewEmpty}</div>
        )}
      </div>

      <div className="mt-4 min-h-14" aria-live="polite">
        {drawing && sample && <p className="rounded-xl border border-dashed border-line p-3 text-sm text-muted">{t.sampleHint}</p>}
        {drawing && !sample && scan === "checking" && <p className="text-sm text-muted">{t.checking}</p>}
        {drawing && !sample && scan === "ok" && (
          <div className="flex items-start gap-2.5 rounded-xl bg-ok-soft p-3">
            <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-ok text-xs text-on-ok">✓</span>
            <div>
              <div className="text-sm font-semibold">{t.scanOk}</div>
              <div className="text-xs text-muted">{t.scanOkHint}</div>
            </div>
          </div>
        )}
        {drawing && !sample && scan === "bad" && (
          <div className="flex items-start gap-2.5 rounded-xl bg-warn-soft p-3">
            <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-warn text-xs text-on-warn">!</span>
            <div>
              <div className="text-sm font-semibold">{t.scanBad}</div>
              <div className="text-xs text-muted">{t.scanBadHint}</div>
              {!forced && (
                <button type="button" onClick={() => setForced(true)} className="mt-1.5 text-xs font-medium underline underline-offset-2">
                  {t.downloadAnyway}
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {gate?.blocked && <p className="mt-3 rounded-xl bg-warn-soft p-3 text-sm">{gate.blocked}</p>}
      {/* Главное действие — одна крупная кнопка; SVG и видео-код — рядом поменьше. */}
      <button
        type="button"
        disabled={!canDownload || busy}
        onClick={() => download("png")}
        className="group mt-3 flex min-h-14 w-full items-center justify-center gap-3 rounded-xl bg-accent px-4 text-on-accent transition-all hover:brightness-95 disabled:opacity-40"
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0 transition-transform group-enabled:group-hover:translate-y-0.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M12 4v11m0 0-4.5-4.5M12 15l4.5-4.5M5 20h14" />
        </svg>
        <span className="text-left">
          <span className="block font-heading text-sm font-bold">
            {t.download} {t.png}
          </span>
          <span className="block text-xs opacity-75">{t.pngHint}</span>
        </span>
      </button>
      <div className={`mt-2 grid gap-2 ${payload && canRecord ? "grid-cols-2" : "grid-cols-1"}`}>
        <button
          type="button"
          disabled={!canDownload || busy}
          onClick={() => download("svg")}
          className="min-h-14 min-w-0 rounded-xl border border-line bg-field px-3 py-2 text-left transition-colors hover:border-muted disabled:opacity-40"
        >
          <span className="block text-sm font-semibold">
            {t.download} {t.svg}
          </span>
          <span className="block text-xs leading-snug text-muted">{t.svgHint}</span>
        </button>
        {payload && canRecord && (
          <button
            type="button"
            disabled={!canDownload || busy || typeof live === "number"}
            onClick={() => download("live")}
            title={t.liveCode}
            className="min-h-14 min-w-0 rounded-xl border border-line bg-field px-3 py-2 text-left transition-colors hover:border-muted disabled:opacity-40"
          >
            <span className="block text-sm font-semibold">
              <span aria-hidden>✨ </span>
              {typeof live === "number" ? `${t.liveRecording} ${Math.round(live * 100)}%` : t.liveShort}
            </span>
            <span className="block text-xs leading-snug text-muted">{t.liveHint}</span>
          </button>
        )}
      </div>
      {live === "bad" && <p className="mt-2 text-xs text-warn">{t.liveBad}</p>}
      {failed && <p className="mt-2 text-xs text-warn">{t.saveError}</p>}
      {gate && !gate.blocked && (
        <div className="mt-3">
          <div className="flex items-center justify-between gap-3 rounded-xl border border-line px-3 py-2.5">
            <span className="flex items-center gap-2 text-sm font-semibold">
              <span className={`h-2 w-2 rounded-full ${gate.tier === "simple" ? "bg-muted" : "bg-accent"}`} aria-hidden />
              {gate.tier === "simple" ? t.tierSimple : t.tierStyled}
            </span>
            <span className="font-heading text-lg font-bold">${PRICES[gate.tier]}</span>
          </div>
          <p className="mt-2 text-center text-xs text-muted">{t.firstFree}</p>
        </div>
      )}
      {pay && (
        <div className="mt-3 rounded-xl bg-stage p-4 text-on-stage" role="dialog" aria-label={t.payTitle}>
          {!pay.quote ? (
            <>
              <p className="text-sm font-semibold">{t.loginToDownload}</p>
              <Link href={`/login?next=${encodeURIComponent(path)}`} className="mt-3 grid min-h-11 place-items-center rounded-xl bg-accent px-4 text-sm font-semibold text-on-accent">
                {t.login}
              </Link>
            </>
          ) : (
            <>
              <p className="text-sm font-semibold">{pay.quote.free ? t.freeFirst : `${t.payTitle}: $${pay.quote.price}`}</p>
              {!pay.quote.free && <p className="mt-1 text-xs text-on-stage/60">{t.buyDemo}</p>}
              <div className="mt-3 flex gap-2">
                <button type="button" disabled={busy} onClick={confirm} className="min-h-11 flex-1 rounded-xl bg-accent px-4 text-sm font-semibold text-on-accent disabled:opacity-50">
                  {pay.quote.free ? t.downloadFree : `${t.payAndDownload} — $${pay.quote.price}`}
                </button>
                <button type="button" onClick={() => setPay(null)} className="min-h-11 rounded-xl px-3 text-sm font-medium text-on-stage/70 hover:text-on-stage">
                  {t.cancel}
                </button>
              </div>
            </>
          )}
        </div>
      )}
      {login && (
        <LoginModal
          t={t}
          lang={lang}
          next={`${path}#make`}
          beforeLeave={gate?.beforeLogin}
          onClose={() => setLogin(null)}
          onDone={() => {
            const f = login;
            setLogin(null);
            download(f, true);
          }}
        />
      )}
    </section>
  );
}
