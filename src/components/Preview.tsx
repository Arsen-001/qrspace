"use client";
import { useState } from "react";
import type { Dict } from "@/lib/i18n";
import { type Drawing, toSvg } from "@/lib/qr/render";
import { downloadPng, downloadSvg } from "@/lib/qr/raster";

export type ScanState = "idle" | "checking" | "ok" | "bad";

export function Preview({ t, drawing, scan, error, name = "qr-code" }: { t: Dict; drawing: Drawing | null; scan: ScanState; error: string | null; name?: string }) {
  const [forced, setForced] = useState(false);
  const canDownload = !!drawing && (scan === "ok" || (scan === "bad" && forced));

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
            <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-ok text-xs text-white">✓</span>
            <div>
              <div className="text-sm font-semibold">{t.scanOk}</div>
              <div className="text-xs text-muted">{t.scanOkHint}</div>
            </div>
          </div>
        )}
        {drawing && scan === "bad" && (
          <div className="flex items-start gap-2.5 rounded-xl bg-warn-soft p-3">
            <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-warn text-xs text-white">!</span>
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
          disabled={!canDownload}
          onClick={() => drawing && downloadPng(drawing, 2048, name)}
          className="min-h-14 rounded-xl bg-accent px-3 text-on-accent transition-opacity disabled:opacity-40"
        >
          <span className="block text-sm font-semibold">
            {t.download} {t.png}
          </span>
          <span className="block text-xs opacity-80">{t.pngHint}</span>
        </button>
        <button
          type="button"
          disabled={!canDownload}
          onClick={() => drawing && downloadSvg(drawing, name)}
          className="min-h-14 rounded-xl border border-line bg-field px-3 transition-opacity disabled:opacity-40"
        >
          <span className="block text-sm font-semibold">
            {t.download} {t.svg}
          </span>
          <span className="block text-xs text-muted">{t.svgHint}</span>
        </button>
      </div>
    </section>
  );
}
