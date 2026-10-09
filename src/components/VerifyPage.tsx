"use client";
// «Проверить код»: камера (или фото) читает QR, сайт говорит — настоящий ли это код QR Space или наклейка-подделка,
// которая ведёт на чужой сайт (так мошенники подменяют коды на машинах, в кафе, на столбах).
// С 09.10.2026 это и наш сканер (/scan; владелец: «у нас должен быть и наш сканер», «а можно сканер для штрихкодов?»):
// любой код и штрихкод — что в нём и кнопки (Wi‑Fi, звонок, контакт, событие…), у штрихкода — номер и поиск.
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { Kind } from "@/lib/codes";
import { fill } from "@/lib/i18n";
import { useLang } from "@/lib/lang";
import { readAny } from "@/lib/qr/raster";
import { parseScanned, type Scanned } from "@/lib/qr/scan";
import { ContentCard } from "./ContentCard";
import { KindIcon } from "./KindIcon";
import { ReportBox } from "./ReportBox";
import { Shell } from "./Shell";
import { StepBadge } from "./ui";

type Result = { result: "ours"; id: string; kind: Kind; title: string | null } | { result: "foreign"; host: string } | { result: "missing" | "site" | "text" };

export function VerifyPage({ mode = "verify" }: { mode?: "scan" | "verify" }) {
  const { lang, t } = useLang((t) => `${mode === "scan" ? t.scanTitle : t.verifyTitle} — ${t.appName}`);
  const video = useRef<HTMLVideoElement>(null);
  const [on, setOn] = useState(false);
  const [text, setText] = useState<string | null>(null);
  const [res, setRes] = useState<Result | null>(null);
  const [scanned, setScanned] = useState<Scanned | null>(null);
  const [error, setError] = useState<string | null>(null);

  const check = async (decoded: string, format: string) => {
    setText(decoded);
    setOn(false);
    const sc = parseScanned(decoded, format);
    setScanned(sc);
    // Ссылку проверяем: наш ли это код или подделка, ведущая на чужой сайт. Остальное проверять не нужно.
    if (sc.kind === "content" && sc.content.type === "url") setRes(await fetch(`/api/verify?u=${encodeURIComponent(decoded)}`).then((r) => r.json() as Promise<Result>));
    else setRes({ result: "text" });
  };

  // Камера: кадр раз в 300 мс → читаем QR. Задняя камера на телефоне.
  useEffect(() => {
    if (!on) return;
    let stream: MediaStream | null = null;
    let timer = 0;
    let live = true;
    navigator.mediaDevices
      ?.getUserMedia({ video: { facingMode: "environment" }, audio: false })
      .then((s) => {
        stream = s;
        if (!live || !video.current) return;
        video.current.srcObject = s;
        void video.current.play();
        const c = document.createElement("canvas");
        const tick = async () => {
          const v = video.current;
          if (!live || !v) return;
          if (v.videoWidth) {
            const k = Math.min(1, 720 / Math.max(v.videoWidth, v.videoHeight));
            c.width = Math.round(v.videoWidth * k);
            c.height = Math.round(v.videoHeight * k);
            const ctx = c.getContext("2d", { willReadFrequently: true })!;
            ctx.drawImage(v, 0, 0, c.width, c.height);
            const found = await readAny(ctx.getImageData(0, 0, c.width, c.height)).catch(() => null);
            if (found && live) {
              navigator.vibrate?.(40);
              return void check(found.text, found.format);
            }
          }
          timer = window.setTimeout(tick, 300);
        };
        void tick();
      })
      .catch(() => {
        setError(t.verifyNoCamera);
        setOn(false);
      });
    return () => {
      live = false;
      clearTimeout(timer);
      stream?.getTracks().forEach((tr) => tr.stop());
    };
  }, [on, t.verifyNoCamera]);

  const fromPhoto = async (f: File) => {
    setError(null);
    const url = URL.createObjectURL(f);
    try {
      const img = new Image();
      await new Promise((ok, bad) => ((img.onload = ok), (img.onerror = bad), (img.src = url)));
      const k = Math.min(1, 1200 / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement("canvas");
      c.width = Math.round(img.naturalWidth * k);
      c.height = Math.round(img.naturalHeight * k);
      const ctx = c.getContext("2d", { willReadFrequently: true })!;
      ctx.drawImage(img, 0, 0, c.width, c.height);
      const found = await readAny(ctx.getImageData(0, 0, c.width, c.height));
      if (found) await check(found.text, found.format);
      else setError(t.verifyNotFound);
    } catch {
      setError(t.verifyNotFound);
    } finally {
      URL.revokeObjectURL(url);
    }
  };

  const reset = () => {
    setRes(null);
    setScanned(null);
    setText(null);
    setError(null);
  };

  return (
    <Shell t={t} lang={lang} narrow>
      <h1 className="font-heading text-3xl font-extrabold tracking-tight">{mode === "scan" ? t.scanTitle : t.verifyTitle}</h1>
      <p className="mt-2 text-sm text-muted">{mode === "scan" ? t.scanHint : t.verifyHint}</p>

      {!res && (
        <div className="mt-6 space-y-3">
          {on ? (
            <div className="overflow-hidden rounded-2xl bg-black">
              <video ref={video} muted playsInline className="aspect-square w-full object-cover" />
            </div>
          ) : (
            <div className="rounded-2xl bg-stage p-5 text-on-stage sm:p-6">
              {/* Рамка сканера с бегущим лучом — сразу понятно, что тут наводят камеру. */}
              <div aria-hidden className="relative mx-auto aspect-square w-full max-w-[220px] overflow-hidden rounded-xl">
                {["left-0 top-0 border-l-4 border-t-4", "right-0 top-0 border-r-4 border-t-4", "bottom-0 left-0 border-b-4 border-l-4", "bottom-0 right-0 border-b-4 border-r-4"].map((c) => (
                  <span key={c} className={`absolute h-10 w-10 rounded-sm border-accent ${c}`} />
                ))}
                <div className="x-scan" />
              </div>
              <button type="button" onClick={() => setOn(true)} className="mt-5 min-h-12 w-full rounded-xl bg-accent px-5 font-heading text-sm font-bold text-on-accent">
                📷 {t.verifyCamera}
              </button>
            </div>
          )}
          <label className="flex min-h-12 w-full cursor-pointer items-center justify-center rounded-xl border border-line bg-card px-5 text-sm font-semibold hover:border-muted">
            {t.verifyPhoto}
            <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && fromPhoto(e.target.files[0])} />
          </label>
          {error && <p className="text-sm text-warn">{error}</p>}
          <ol className="grid gap-2 pt-3 sm:grid-cols-3">
            {[t.verifyHow1, t.verifyHow2, t.verifyHow3].map((x, i) => (
              <li key={x} className="flex items-start gap-3 rounded-xl border border-line bg-card p-3 text-sm">
                <StepBadge n={i + 1} />
                <span className="pt-1">{x}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {res && (
        <section className="mt-6 space-y-4">
          {scanned?.kind === "barcode" ? (
            <div className="overflow-hidden rounded-3xl border border-line bg-card">
              <div className="bg-stage p-6 text-on-stage sm:p-8">
                <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-on-stage/60">
                  {t.scanBarcode} · {scanned.format}
                </div>
                <div className="mt-3 break-all font-mono text-3xl font-bold tracking-wider">{scanned.number}</div>
              </div>
              <div className="grid gap-2 p-4 sm:grid-cols-2 sm:p-5">
                <a href={`https://www.google.com/search?q=${encodeURIComponent(scanned.number)}`} target="_blank" rel="noopener noreferrer" className="grid min-h-12 place-items-center rounded-xl bg-accent px-4 font-heading text-sm font-bold text-on-accent">
                  {t.scanSearch} →
                </a>
                <button type="button" onClick={() => navigator.clipboard?.writeText(scanned.number)} className="min-h-12 rounded-xl border border-line bg-field px-4 font-heading text-sm font-bold hover:border-muted">
                  {t.copy}
                </button>
              </div>
            </div>
          ) : scanned?.kind === "content" && scanned.content.type !== "url" ? (
            <>
              {mode === "verify" && scanned.content.type === "text" && (
                <div className="rounded-2xl border border-line bg-card p-5">
                  <div className="font-heading text-xl font-bold">{t.verifyText}</div>
                </div>
              )}
              <ContentCard t={t} lang={lang} content={scanned.content} />
            </>
          ) : res.result === "ours" ? (
            <div className="rounded-2xl bg-ok p-5 text-on-ok">
              <div className="font-heading text-2xl font-extrabold">✓ {t.verifyOurs}</div>
              <div className="mt-2 flex items-center gap-2 text-sm">
                <KindIcon kind={res.kind} className="h-5 w-5" />
                {res.title ?? t[`tpl.${res.kind}`]}
              </div>
            </div>
          ) : res.result === "foreign" ? (
            <div className="rounded-2xl bg-warn p-5 text-on-warn">
              <div className="font-heading text-2xl font-extrabold">⚠ {t.verifyForeign}</div>
              <p className="mt-2 text-sm">{fill(t.verifyForeignHint, { host: res.host })}</p>
            </div>
          ) : (
            <div className="rounded-2xl border border-line bg-card p-5">
              <div className="font-heading text-xl font-bold">{res.result === "missing" ? t.verifyMissing : res.result === "site" ? t.verifySite : t.verifyText}</div>
            </div>
          )}
          {/* Чужая ссылка — предупредили выше; открыть всё равно можно. */}
          {scanned?.kind === "content" && scanned.content.type === "url" && res.result !== "ours" && <ContentCard t={t} lang={lang} content={scanned.content} />}
          {text && scanned?.kind === "content" && scanned.content.type === "url" && <p className="break-all rounded-xl bg-field p-3 font-mono text-xs text-muted">{text}</p>}
          <div className="flex flex-wrap gap-2">
            {res.result === "ours" && <ReportBox t={t} id={res.id} />}
            {res.result === "ours" && (
              <Link href={`/c/${res.id}`} className="grid min-h-11 place-items-center rounded-xl bg-accent px-5 text-sm font-semibold text-on-accent">
                {t.verifyOpen} →
              </Link>
            )}
            <button type="button" onClick={reset} className="min-h-11 rounded-xl border border-line bg-card px-4 text-sm font-semibold hover:border-muted">
              {mode === "scan" ? t.scanAgain : t.verifyAgain}
            </button>
          </div>
        </section>
      )}
    </Shell>
  );
}
