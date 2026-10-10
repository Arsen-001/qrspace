"use client";
// Верх маркета — горизонтальный слайдер (владелец 09.10.2026): «1 QR — $1» и «Дроп дня» с коллекционными.
// Листается пальцем (прокрутка со щелчком) и полосками внизу — как в сторис (стрелки убраны, владелец 09.10.2026);
// сам — раз в 7 с, пока его не трогали: активная полоска заполняется, заполнилась — следующий слайд.
import { Children, useEffect, useRef, useState, type ReactNode } from "react";

export function HeroSlider({ children }: { children: ReactNode }) {
  const slides = Children.toArray(children);
  const track = useRef<HTMLDivElement>(null);
  const [at, setAt] = useState(0);
  const [touched, setTouched] = useState(false);

  const go = (i: number) => {
    const el = track.current;
    if (!el) return;
    const n = (i + slides.length) % slides.length;
    el.scrollTo({ left: n * el.clientWidth, behavior: "smooth" });
  };

  useEffect(() => {
    const el = track.current;
    if (!el) return;
    const onScroll = () => setAt(Math.round(el.scrollLeft / el.clientWidth));
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="relative [&:hover_.x-fill]:[animation-play-state:paused]" aria-roledescription="carousel" onPointerDown={() => setTouched(true)} onFocusCapture={() => setTouched(true)}>
      <div ref={track} className="flex snap-x snap-mandatory overflow-x-auto rounded-[2rem] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {slides.map((s, i) => (
          <div key={i} className="flex w-full shrink-0 snap-center [&>*]:w-full" aria-roledescription="slide" aria-label={`${i + 1} / ${slides.length}`}>
            {s}
          </div>
        ))}
      </div>
      {slides.length > 1 && (
        <div className="mt-4 flex justify-center gap-2">
          {slides.map((_, i) => (
            <button key={i} type="button" aria-label={`${i + 1} / ${slides.length}`} aria-current={at === i} onClick={() => go(i)} className="group grid min-h-11 place-items-center px-1">
              <span className="block h-1.5 w-12 overflow-hidden rounded-full bg-line transition-colors group-hover:bg-muted/50">
                <span
                  key={`${at}-${touched}`}
                  // Заполнилась — следующий слайд (на наведении полоска стоит).
                  onAnimationEnd={() => go(at + 1)}
                  className={`block h-full rounded-full ${at === i ? (touched || slides.length < 2 ? "w-full bg-ink" : "x-fill bg-ink") : "w-0"}`}
                />
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
