"use client";
// «Проверить код»: камера (или фото) читает QR, сайт говорит — настоящий ли это код QR Studio или наклейка-подделка,
// которая ведёт на чужой сайт (так мошенники подменяют коды на машинах, в кафе, на столбах).
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { Kind } from "@/lib/codes";
import { fill } from "@/lib/i18n";
import { useLang } from "@/lib/lang";
import { readQr } from "@/lib/qr/raster";
import { KindIcon } from "./KindIcon";
import { Shell } from "./Shell";

type Result = { result: "ours"; id: string; kind: Kind; title: string | null } | { result: "foreign"; host: string } | { result: "missing" | "site" | "text" };

export function VerifyPage() {
  const { lang, t } = useLang((t) => `${t.verifyTitle} — ${t.appName}`);
  const video = useRef<HTMLVideoElement>(null);
  const [on, setOn] = useState(false);
  const [text, setText] = useState<string | null>(null);
  const [res, setRes] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);

  const check = async (decoded: string) => {
    setText(decoded);
    setOn(false);
    setRes(await fetch(`/api/verify?u=${encodeURIComponent(decoded)}`).then((r) => r.json() as Promise<Result>));
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
            const found = await readQr(ctx.getImageData(0, 0, c.width, c.height)).catch(() => null);
            if (found && live) return void check(found);
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
      const found = await readQr(ctx.getImageData(0, 0, c.width, c.height));
      if (found) await check(found);
      else setError(t.verifyNotFound);
    } catch {
      setError(t.verifyNotFound);
    } finally {
      URL.revokeObjectURL(url);
    }
  };

  const reset = () => {
    setRes(null);
    setText(null);
    setError(null);
  };

  return (
    <Shell t={t} lang={lang} narrow>
      <h1 className="font-heading text-3xl font-extrabold tracking-tight">{t.verifyTitle}</h1>
      <p className="mt-2 text-sm text-muted">{t.verifyHint}</p>

      {!res && (
        <div className="mt-6 space-y-3">
          {on ? (
            <div className="overflow-hidden rounded-2xl bg-black">
              <video ref={video} muted playsInline className="aspect-square w-full object-cover" />
            </div>
          ) : (
            <button type="button" onClick={() => setOn(true)} className="min-h-12 w-full rounded-xl bg-accent px-5 text-sm font-semibold text-on-accent">
              📷 {t.verifyCamera}
            </button>
          )}
          <label className="flex min-h-12 w-full cursor-pointer items-center justify-center rounded-xl border border-line bg-card px-5 text-sm font-semibold hover:border-muted">
            {t.verifyPhoto}
            <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && fromPhoto(e.target.files[0])} />
          </label>
          {error && <p className="text-sm text-warn">{error}</p>}
        </div>
      )}

      {res && (
        <section className="mt-6 space-y-4">
          {res.result === "ours" ? (
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
          {text && <p className="break-all rounded-xl bg-field p-3 font-mono text-xs text-muted">{text}</p>}
          <div className="flex flex-wrap gap-2">
            {res.result === "ours" && (
              <Link href={`/c/${res.id}`} className="grid min-h-11 place-items-center rounded-xl bg-accent px-5 text-sm font-semibold text-on-accent">
                {t.verifyOpen} →
              </Link>
            )}
            <button type="button" onClick={reset} className="min-h-11 rounded-xl border border-line bg-card px-4 text-sm font-semibold hover:border-muted">
              {t.verifyAgain}
            </button>
          </div>
        </section>
      )}
    </Shell>
  );
}
