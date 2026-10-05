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

export type ScanState = "idle" | "checking" | "ok" | "bad";

/** Оплата при скачивании: tier — простой или красивый, key — какой это код (считается только по нажатию). */
export type Gate = { tier: Tier; key: () => string };
type Format = "png" | "svg" | "live";

export function Preview({ t, drawing, scan, error, name = "qr-code", gate, payload }: { t: Dict; drawing: Drawing | null; scan: ScanState; error: string | null; name?: string; gate?: Gate | null; payload?: string }) {
  const [forced, setForced] = useState(false);
  const canDownload = !!drawing && (scan === "ok" || (scan === "bad" && forced));
  const { me } = useMe();
  const path = usePathname();
  const [pay, setPay] = useState<{ format: Format; quote: Quote | null; key: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const [live, setLive] = useState<number | "bad" | null>(null);
  // Запись видео есть не во всех браузерах; на сервере кнопку не рисуем — иначе страницы не совпадут.
  const canRecord = useInBrowser() && typeof MediaRecorder !== "undefined";
  const save = async (format: Format) => {
    if (!drawing) return;
    if (format === "png") return downloadPng(drawing, 2048, name);
    if (format === "svg") return downloadSvg(drawing, name);
    // Живой код пишется в реальном времени (4 с) — показываем, сколько осталось.
    setLive(0);
    const ok = await downloadLive(drawing, payload ?? "", name, (p) => setLive(p)).catch(() => false);
    setLive(ok ? null : "bad");
  };
  const download = async (format: Format) => {
    if (!gate) return save(format);
    const key = gate.key();
    if (!me) return setPay({ format, quote: null, key });
    setBusy(true);
    try {
      const q = await api.quote(key, gate.tier);
      if (q.paid) {
        setPay(null);
        save(format);
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
      save(pay.format);
      setPay(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-2xl border border-line bg-card p-5 sm:p-6">
      <div className="mx-auto aspect-square w-full max-w-[420px] overflow-hidden rounded-xl border border-line bg-field">
        {drawing ? (
          <div className="h-full w-full [&>svg]:h-full [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: toSvg(drawing, 420) }} />
        ) : (
          <div className="grid h-full place-items-center p-8 text-center text-sm text-muted">{error ?? t.previewEmpty}</div>
        )}
      </div>

      <div className="mt-4 min-h-14" aria-live="polite">
        {drawing && scan === "checking" && <p className="text-sm text-muted">{t.checking}</p>}
        {drawing && scan === "ok" && (
          <div className="flex items-start gap-2.5 rounded-xl bg-ok-soft p-3">
            <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-ok text-xs text-on-ok">✓</span>
            <div>
              <div className="text-sm font-semibold">{t.scanOk}</div>
              <div className="text-xs text-muted">{t.scanOkHint}</div>
            </div>
          </div>
        )}
        {drawing && scan === "bad" && (
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

      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          type="button"
          disabled={!canDownload || busy}
          onClick={() => download("png")}
          className="min-h-14 rounded-xl bg-accent px-3 text-on-accent transition-opacity disabled:opacity-40"
        >
          <span className="block text-sm font-semibold">
            {t.download} {t.png}
          </span>
          <span className="block text-xs opacity-80">{t.pngHint}</span>
        </button>
        <button
          type="button"
          disabled={!canDownload || busy}
          onClick={() => download("svg")}
          className="min-h-14 rounded-xl border border-line bg-field px-3 transition-opacity disabled:opacity-40"
        >
          <span className="block text-sm font-semibold">
            {t.download} {t.svg}
          </span>
          <span className="block text-xs text-muted">{t.svgHint}</span>
        </button>
      </div>
      {payload && canRecord && (
        <button
          type="button"
          disabled={!canDownload || busy || typeof live === "number"}
          onClick={() => download("live")}
          className="mt-2 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-line bg-field px-3 text-sm font-semibold transition-opacity hover:border-muted disabled:opacity-40"
        >
          ✨ {typeof live === "number" ? `${t.liveRecording} ${Math.round(live * 100)}%` : t.liveCode}
          <span className="text-xs font-normal text-muted">{t.liveHint}</span>
        </button>
      )}
      {live === "bad" && <p className="mt-2 text-xs text-warn">{t.liveBad}</p>}
      {gate && (
        <p className="mt-3 text-center text-xs text-muted">
          {gate.tier === "simple" ? t.tierSimple : t.tierStyled} · {t.priceFrom} ${PRICES[gate.tier]}
          <span className="block">{t.firstFree}</span>
        </p>
      )}
      {pay && (
        <div className="mt-3 rounded-xl border border-accent/40 bg-field p-4" role="dialog" aria-label={t.payTitle}>
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
              {!pay.quote.free && <p className="mt-1 text-xs text-muted">{t.buyDemo}</p>}
              <div className="mt-3 flex gap-2">
                <button type="button" disabled={busy} onClick={confirm} className="min-h-11 flex-1 rounded-xl bg-accent px-4 text-sm font-semibold text-on-accent disabled:opacity-50">
                  {pay.quote.free ? t.downloadFree : `${t.payAndDownload} — $${pay.quote.price}`}
                </button>
                <button type="button" onClick={() => setPay(null)} className="min-h-11 rounded-xl px-3 text-sm font-medium text-muted hover:text-ink">
                  {t.cancel}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </section>
  );
}
