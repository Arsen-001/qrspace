"use client";
// Первый экран (владелец 08.10.2026): вертикальный выключатель рядом с большим кодом. Включили — луч сканера идёт сверху
// вниз и открывает, что под кодом (фото, текст, видео); выключили — луч идёт обратно и код закрывает память.
import { useRef, useState, type ReactNode } from "react";
import type { Dict } from "@/lib/i18n";

/** Что «под кодом»: живой пример памяти — как её увидит тот, кто отсканировал (фото, видео, слова, кто видит). */
function MemoryUnder({ t }: { t: Dict }) {
  const photo = "relative grid place-items-center overflow-hidden rounded-lg text-2xl sm:text-3xl";
  return (
    <div className="flex h-full flex-col gap-2 p-3.5 text-left sm:gap-2.5 sm:p-5">
      <div className="flex items-center gap-2.5">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-accent font-heading text-sm font-extrabold text-on-accent">А</span>
        <div className="min-w-0">
          <div className="truncate font-heading text-sm font-bold sm:text-base">{t.heroMemTitle}</div>
          <div className="font-mono text-[10px] text-on-stage/50">08.10 · {t.heroMemPhotos}</div>
        </div>
      </div>
      <div className="grid flex-1 grid-cols-3 gap-1.5">
        <span className={`${photo} col-span-2 row-span-2 bg-[linear-gradient(160deg,#ffd48a,#ff8a5c_60%,#e2557a)]`}>
          <span aria-hidden className="text-5xl sm:text-6xl">🌻</span>
        </span>
        <span className={`${photo} bg-[linear-gradient(160deg,#8fd3ff,#4c6ef5)]`}>
          <span aria-hidden>🌊</span>
        </span>
        <span className={`${photo} bg-[linear-gradient(160deg,#ffe1ec,#ff9db8)]`}>
          <span aria-hidden>🎂</span>
        </span>
      </div>
      <div className="flex items-center gap-2.5 rounded-xl bg-white/10 p-2">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-on-stage text-xs text-stage">▶</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-xs font-semibold sm:text-sm">{t.heroMemVideo}</span>
          <span className="mt-1 block h-1 overflow-hidden rounded-full bg-white/15">
            <span className="block h-full w-1/3 rounded-full bg-accent" />
          </span>
        </span>
      </div>
      <p className="rounded-xl rounded-bl-sm bg-accent px-3 py-2 text-xs font-medium leading-snug text-on-accent sm:text-sm">{t.heroMemText}</p>
      <div className="flex items-center justify-between font-mono text-[10px] text-on-stage/60">
        <span className="flex items-center gap-1">🔒 {t.heroMemWho}</span>
        <span>♥ 12</span>
      </div>
    </div>
  );
}

/** Состояние выключателя: открыт ли код и идёт ли луч (виден, пока движется — в обе стороны). */
export function useReveal() {
  const [open, setOpen] = useState(false);
  const [moving, setMoving] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const toggle = () => {
    setOpen((v) => !v);
    setMoving(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setMoving(false), 1450);
  };
  return { open, moving, toggle };
}

/** Вертикальный выключатель — рядом с заголовком; мягко мерцает, пока его не включили. */
export function HeroSwitch({ t, open, toggle }: { t: Dict; open: boolean; toggle: () => void }) {
  return (
    <div className="flex shrink-0 flex-col items-center gap-2">
      <span className={`font-mono text-[10px] uppercase tracking-[0.14em] transition-colors ${open ? "text-accent" : "text-on-stage/50"}`}>{t.heroUnder}</span>
      <button
        type="button"
        role="switch"
        aria-checked={open}
        aria-label={t.heroSwitch}
        onClick={toggle}
        className={`relative h-40 w-12 rounded-full border transition-colors sm:h-48 sm:w-14 ${open ? "border-accent bg-accent/20" : "border-stage-line bg-white/5"}`}
      >
        <span aria-hidden className={`x-blink pointer-events-none absolute -inset-1.5 rounded-full bg-accent/25 blur-md ${open ? "opacity-40" : ""}`} />
        <span
          className={`absolute left-1/2 top-1 h-10 w-10 -translate-x-1/2 rounded-full shadow-lg transition-transform duration-700 ease-[cubic-bezier(.65,0,.35,1)] sm:h-12 sm:w-12 ${
            open ? "translate-y-0 bg-accent" : "translate-y-[6.75rem] bg-on-stage sm:translate-y-[8.25rem]"
          }`}
        />
      </button>
      <span className={`font-mono text-[10px] uppercase tracking-[0.14em] transition-colors ${open ? "text-on-stage/50" : "text-on-stage"}`}>QR</span>
    </div>
  );
}

/** Большой код; под ним — память. Включили — луч сверху вниз открывает её, выключили — закрывает. */
export function HeroCode({ t, code, open, moving }: { t: Dict; code: ReactNode; open: boolean; moving: boolean }) {
  const ease = "duration-[1400ms] ease-[cubic-bezier(.65,0,.35,1)]";
  return (
    <div className="relative">
      <div className="relative aspect-square overflow-hidden rounded-2xl border border-stage-line bg-stage">
        <MemoryUnder t={t} />
        {/* Код сверху; открываем/закрываем его срезом сверху — граница среза идёт вместе с лучом. */}
        <div className={`absolute inset-0 bg-stage p-5 transition-[clip-path] sm:p-7 ${ease}`} style={{ clipPath: open ? "inset(100% 0 0 0)" : "inset(0 0 0 0)" }} aria-hidden={open}>
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
  );
}
