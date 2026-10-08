"use client";
// Первый экран (владелец 08.10.2026): вертикальный выключатель рядом с большим кодом. Включили — луч сканера идёт сверху
// вниз и открывает, что под кодом (номер телефона); выключили — луч идёт обратно и код закрывает память.
import { useRef, useState, type ReactNode } from "react";
import type { Dict } from "@/lib/i18n";
import { TypeIcon } from "./TypeIcon";

/** Что «под кодом»: номер телефона — так его увидит тот, кто отсканировал (владелец 08.10.2026). */
function PhoneUnder({ t }: { t: Dict }) {
  const btn = "flex min-h-11 items-center justify-center gap-2 rounded-xl px-3 font-heading text-sm font-bold sm:min-h-12";
  return (
    <div className="flex h-full flex-col justify-center gap-3 p-4 text-left min-[400px]:gap-4 min-[400px]:p-5 sm:gap-5 sm:p-7">
      <div className="flex items-center gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-accent text-on-accent sm:h-12 sm:w-12">
          <TypeIcon type="phone" className="h-6 w-6" />
        </span>
        <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-on-stage/60">{t["type.phone"]}</span>
      </div>
      <p className="whitespace-nowrap font-heading text-[clamp(1rem,6vw,1.6rem)] font-extrabold leading-tight sm:text-4xl">+1 (212) 555-0142</p>
      <div className="grid gap-2">
        <span className={`${btn} bg-accent text-on-accent`}>
          {t.actCall} <span aria-hidden>→</span>
        </span>
        <span className={`${btn} border border-stage-line bg-white/5`}>{t.actCopyNumber}</span>
      </div>
      <span className="font-mono text-[10px] text-on-stage/60">🔒 {t.heroMemWho}</span>
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
        <PhoneUnder t={t} />
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
