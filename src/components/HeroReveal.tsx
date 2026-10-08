"use client";
// Первый экран (владелец 08.10.2026): вертикальный выключатель рядом с большим кодом. Включили — луч сканера идёт сверху
// вниз и открывает, что под кодом (фото, текст, видео); выключили — луч идёт обратно и код закрывает память.
import { useRef, useState, type ReactNode } from "react";
import type { Dict } from "@/lib/i18n";

/** Что «под кодом»: пример памяти — фото, видео, слова. */
function MemoryUnder({ t }: { t: Dict }) {
  return (
    <div className="flex h-full flex-col gap-2.5 p-4 sm:p-6">
      <div className="grid flex-1 grid-cols-3 grid-rows-2 gap-2">
        <span className="col-span-2 row-span-2 rounded-xl bg-[linear-gradient(135deg,#ffb38a,#ff6f91_55%,#962fbf)]" />
        <span className="relative grid place-items-center rounded-xl bg-[linear-gradient(135deg,#7ad7f0,#4c6ef5)]">
          <span className="grid h-8 w-8 place-items-center rounded-full bg-white/90 text-xs text-[#111]">▶</span>
        </span>
        <span className="rounded-xl bg-[linear-gradient(135deg,#c6ff2e,#3ecf8e)]" />
      </div>
      <div className="rounded-xl bg-white/10 p-3">
        <div className="flex items-center justify-between gap-2">
          <span className="font-heading text-sm font-bold sm:text-base">{t.heroMemTitle}</span>
          <span className="font-mono text-[11px] text-on-stage/60">♥ 128</span>
        </div>
        <p className="mt-1 text-xs leading-relaxed text-on-stage/70 sm:text-sm">{t.heroMemText}</p>
      </div>
    </div>
  );
}

export function HeroReveal({ t, code }: { t: Dict; code: ReactNode }) {
  const [open, setOpen] = useState(false);
  // Луч виден, пока идёт (в обе стороны); в покое его нет.
  const [moving, setMoving] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const toggle = () => {
    setOpen((v) => !v);
    setMoving(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setMoving(false), 1450);
  };
  const ease = "duration-[1400ms] ease-[cubic-bezier(.65,0,.35,1)]";
  return (
    <div className="flex items-center gap-4 sm:gap-6">
      <div className="flex flex-col items-center gap-2">
        <span className={`font-mono text-[10px] uppercase tracking-[0.14em] transition-colors ${open ? "text-accent" : "text-on-stage/50"}`}>{t.heroUnder}</span>
        <button
          type="button"
          role="switch"
          aria-checked={open}
          aria-label={t.heroSwitch}
          onClick={toggle}
          className={`relative h-28 w-11 rounded-full border transition-colors ${open ? "border-accent bg-accent/20" : "border-stage-line bg-white/5"}`}
        >
          <span
            className={`absolute left-1/2 top-1 h-9 w-9 -translate-x-1/2 rounded-full shadow-lg transition-transform duration-500 ${open ? "translate-y-0 bg-accent" : "translate-y-[3.75rem] bg-on-stage"}`}
          >
            {!open && <span className="x-blink absolute inset-0 rounded-full ring-2 ring-accent/60" />}
          </span>
        </button>
        <span className={`font-mono text-[10px] uppercase tracking-[0.14em] transition-colors ${open ? "text-on-stage/50" : "text-on-stage"}`}>QR</span>
      </div>

      <div className="relative min-w-0 flex-1">
        <div className="relative aspect-square overflow-hidden rounded-2xl border border-stage-line bg-stage">
          <MemoryUnder t={t} />
          {/* Код сверху; открываем/закрываем его срезом сверху — граница среза идёт вместе с лучом. */}
          <div
            className={`absolute inset-0 bg-stage p-5 transition-[clip-path] sm:p-7 ${ease}`}
            style={{ clipPath: open ? "inset(100% 0 0 0)" : "inset(0 0 0 0)" }}
            aria-hidden={open}
          >
            {code}
            {!open && <div aria-hidden className="x-scan pointer-events-none" />}
          </div>
          <div aria-hidden className={`pointer-events-none absolute inset-0 transition-transform ${ease}`} style={{ transform: open ? "translateY(100%)" : "translateY(0%)" }}>
            <div className={`h-1 bg-accent shadow-[0_0_24px_6px_rgba(198,255,46,0.65)] transition-opacity duration-300 ${moving ? "opacity-100" : "opacity-0"}`} />
          </div>
        </div>
        <span className="absolute -top-3 right-6 rounded-md bg-accent px-2.5 py-1 font-heading text-xs font-bold text-on-accent">№ 000 777</span>
        <span className="absolute -bottom-3 left-6 rounded-md border border-stage-line bg-stage px-2.5 py-1 font-mono text-xs text-on-stage/80">{open ? t.heroUnder : t.numbersTitle}</span>
      </div>
    </div>
  );
}
