"use client";
// Первый экран, бегущая строка и «больше, чем QR-код» на главной .
import Link from "next/link";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Dict } from "@/lib/i18n";
import { BASIC_LOGOS, LINKEDIN, logoSvg, type BrandLogo } from "@/lib/qr/logo-art";
import { HeroCode, HeroSwitch, useReveal } from "./HeroReveal";

/**
 * Заголовок первого экрана — всегда ровно три строки (владелец 08.10.2026), на любом экране и языке.
 * Строки: «The QR / code / that lives»; если первая часть — одно слово: «QR-код, / который / живёт».
 * Размер — сколько позволяет ширина под самую длинную строку, но не больше обычного.
 */
function HeroTitle({ a, b }: { a: string; b: string }) {
  const wa = a.split(" ");
  const wb = b.split(" ");
  const lines: { text: string; hi: boolean }[] =
    wa.length > 1
      ? [
          { text: wa.slice(0, -1).join(" "), hi: false },
          { text: wa.at(-1)!, hi: false },
          { text: b, hi: true },
        ]
      : [
          { text: a, hi: false },
          { text: wb.slice(0, -1).join(" ") || b, hi: true },
          { text: wb.length > 1 ? wb.at(-1)! : "", hi: true },
        ];
  // Выделенная строка шире на поля плашки — считаем её на символ длиннее.
  const longest = Math.max(...lines.map((l) => l.text.length + (l.hi ? 1 : 0)));
  // Сначала — прикидка по числу букв (так приходит с сервера), в браузере — точно по ширине самой длинной строки.
  const ref = useRef<HTMLHeadingElement>(null);
  const [fit, setFit] = useState<number | null>(null);
  useLayoutEffect(() => {
    const h = ref.current;
    const box = h?.parentElement;
    if (!h || !box) return;
    const measure = () => {
      const prev = h.style.fontSize;
      h.style.fontSize = "100px";
      const widest = Math.max(...[...h.children].map((c) => c.scrollWidth));
      h.style.fontSize = prev;
      const max = parseFloat(getComputedStyle(h).getPropertyValue("--max")) * parseFloat(getComputedStyle(document.documentElement).fontSize);
      setFit(Math.min(max, Math.floor((100 * box.clientWidth) / widest)));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(box);
    document.fonts?.ready.then(measure);
    return () => ro.disconnect();
  }, [a, b]);
  return (
    <h1
      ref={ref}
      className="font-heading leading-[1.12] font-extrabold [--max:2.5rem] sm:[--max:3.75rem] lg:[--max:4.25rem]"
      style={{ fontSize: fit ? `${fit}px` : `min(var(--max), calc(100cqw / ${(longest * 0.78).toFixed(2)}))` }}
    >
      {lines.map((l, i) => (
        <span key={i} className="block whitespace-nowrap">
          {l.hi ? <span className="rounded-md bg-accent px-[0.12em] text-on-accent">{l.text}</span> : l.text}
        </span>
      ))}
    </h1>
  );
}

const N = 25;

/** Модули большого кода: три «глаза» по углам и одинаковый на сервере и в браузере «шум». */
function modules() {
  let seed = 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const eye = (x: number, y: number) =>
    [
      [0, 0],
      [N - 7, 0],
      [0, N - 7],
    ].some(([ex, ey]) => x >= ex - 1 && x <= ex + 7 && y >= ey - 1 && y <= ey + 7);
  const out: { x: number; y: number; hot: boolean; delay: number }[] = [];
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      const r = rnd();
      if (eye(x, y) || r < 0.48) continue;
      out.push({ x, y, hot: r > 0.93, delay: Math.round(rnd() * 3200) });
    }
  return out;
}
const MODULES = modules();

function Eye({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <rect x={x + 0.5} y={y + 0.5} width={6} height={6} rx={1.2} fill="none" stroke="currentColor" strokeWidth={1} />
      <rect x={x + 2} y={y + 2} width={3} height={3} rx={0.6} className="fill-accent" />
    </g>
  );
}

function BigCode() {
  return (
    <svg viewBox={`-1 -1 ${N + 2} ${N + 2}`} className="h-full w-full text-on-stage" aria-hidden>
      <Eye x={0} y={0} />
      <Eye x={N - 7} y={0} />
      <Eye x={0} y={N - 7} />
      {MODULES.map((m) => (
        <rect
          key={`${m.x}-${m.y}`}
          x={m.x + 0.1}
          y={m.y + 0.1}
          width={0.8}
          height={0.8}
          rx={0.18}
          className={m.hot ? "x-blink fill-accent" : "fill-current"}
          style={m.hot ? { animationDelay: `${m.delay}ms` } : undefined}
        />
      ))}
    </svg>
  );
}

export function HomeHero({ t }: { t: Dict }) {
  const reveal = useReveal();
  return (
    <section className="relative overflow-hidden rounded-3xl border border-stage-line bg-stage text-on-stage">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="x-stage-grid" />
        <div className="x-stage-glow" />
      </div>
      {/* Порядок (владелец 09.10.2026: «свитчер непонятно для чего, QR внизу — не видно, что поменялось»): на телефоне
          заголовок → код с выключателем → текст и кнопки, чтобы код был на первом экране; на компьютере код справа.
          Выключатель — вплотную к коду, над ними — подсказка, что он делает. */}
      <div className="relative grid items-center gap-x-10 gap-y-8 p-6 sm:p-10 lg:grid-cols-[1.25fr_1fr] lg:grid-rows-[auto_auto] lg:p-14">
        <div className="min-w-0 lg:self-end">
          <p className="inline-flex items-center gap-2 rounded-full border border-stage-line px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.14em] text-on-stage/70">
            <span className="x-blink h-2 w-2 rounded-full bg-accent" />
            {t.homeKicker}
          </p>
          <div className="@container mt-6 min-w-0">
            <HeroTitle a={t.homeTitleA} b={t.homeTitleB} />
          </div>
        </div>
        <div className="mx-auto w-full max-w-md lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:max-w-none">
          <p aria-live="polite" className="mb-4 flex items-center gap-2 text-sm font-medium text-on-stage/80">
            <span aria-hidden className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-bold ${reveal.open ? "bg-accent text-on-accent" : "bg-white/10 text-accent"}`}>
              {reveal.open ? "✓" : "↓"}
            </span>
            {reveal.open ? t.heroHintOn : t.heroHint}
          </p>
          <div className="flex items-center gap-3 sm:gap-5">
            <HeroSwitch t={t} open={reveal.open} toggle={reveal.toggle} />
            <div className="min-w-0 flex-1">
              <HeroCode t={t} code={<BigCode />} open={reveal.open} moving={reveal.moving} />
            </div>
          </div>
        </div>
        <div className="min-w-0 lg:self-start">
          <p className="max-w-xl text-base leading-relaxed text-on-stage/70 sm:text-lg">{t.homeLead}</p>
          <div className="mt-8 flex flex-wrap gap-2 sm:gap-3">
            <Link href="/create" className="group inline-flex min-h-13 items-center gap-3 rounded-xl bg-accent px-5 sm:px-6 font-heading text-sm font-bold text-on-accent">
              {t.homeCta}
              <span aria-hidden className="transition-transform group-hover:translate-x-1">
                →
              </span>
            </Link>
            <Link
              href="/market"
              className="inline-flex min-h-13 items-center rounded-xl border border-stage-line px-5 sm:px-6 font-heading text-sm font-bold hover:border-on-stage/60"
            >
              {t.navMarket}
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

/** Всплывающие модули на фоне главной: места и скорости заданы заранее — одинаково на сервере и в браузере. */
const FLOATERS = (() => {
  let seed = 11;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  return Array.from({ length: 16 }, (_, i) => {
    const dur = 22 + rnd() * 20;
    return { left: rnd() * 100, size: 8 + Math.round(rnd() * 14), dur, delay: -rnd() * dur, lime: i % 3 === 0 };
  });
})();

export function HomeBackdrop() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      {FLOATERS.map((f, i) => (
        <span
          key={i}
          className={`x-float ${f.lime ? "bg-accent" : "border border-ink/25 bg-ink/10"}`}
          style={{ left: `${f.left}%`, width: f.size, height: f.size, animationDuration: `${f.dur}s`, animationDelay: `${f.delay}s` }}
        />
      ))}
    </div>
  );
}

/**
 * Бегущая лента — логотипы, которые можно поставить в центр кода (владелец 09.10.2026: «вместо этих текстов пусть
 * крутятся все нижние лого»). Сначала основные значки, остальные бренды (Simple Icons) догружаются, когда браузер свободен.
 */
export function HomeTicker({ t }: { t: Dict }) {
  const [logos, setLogos] = useState<BrandLogo[]>(() => [...BASIC_LOGOS, LINKEDIN]);
  useEffect(() => {
    const load = () => import("@/lib/qr/logos").then((m) => setLogos([...m.BRAND_LOGOS, LINKEDIN, ...BASIC_LOGOS]));
    const w = window as Window & { requestIdleCallback?: (cb: () => void) => number };
    if (w.requestIdleCallback) w.requestIdleCallback(load);
    else setTimeout(load, 1500);
  }, []);
  const row = (hidden: boolean) => (
    <div className="flex shrink-0 items-center gap-3 pr-3" aria-hidden={hidden || undefined}>
      {logos.map((l) => (
        <span key={l.id} title={l.title} className="block h-10 w-10 shrink-0 rounded-[11px] shadow-[0_2px_0_rgba(0,0,0,0.25)] sm:h-12 sm:w-12 [&>svg]:h-full [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: logoSvg(l, 48) }} />
      ))}
    </div>
  );
  return (
    // Без своей подложки — логотипы едут по общему фону страницы (владелец 09.10.2026); края мягко растворяются.
    <div
      className="-mx-4 my-8 overflow-hidden py-2 [mask-image:linear-gradient(90deg,transparent,#000_8%,#000_92%,transparent)] sm:-mx-6"
      role="img"
      aria-label={t.logoQuick}
    >
      <div className="x-marquee flex w-max" style={{ animationDuration: `${logos.length * 1.4}s` }}>
        {row(false)}
        {row(true)}
      </div>
    </div>
  );
}

/** Картинки к карточкам «Больше, чем QR-код»: что внутри, понятно без слов. */
function FeatureArt({ kind }: { kind: "memory" | "price" | "market" }) {
  if (kind === "memory")
    return (
      <div className="relative h-full w-full" aria-hidden>
        <span className="absolute left-2 top-3 h-16 w-14 -rotate-6 rounded-lg border-4 border-white bg-[linear-gradient(135deg,#ffb38a,#ff6f91)] shadow-lg" />
        <span className="absolute left-12 top-1 h-16 w-14 rotate-3 rounded-lg border-4 border-white bg-[linear-gradient(135deg,#7ad7f0,#4c6ef5)] shadow-lg" />
        <span className="absolute left-24 top-5 grid h-14 w-14 rotate-6 place-items-center rounded-lg bg-accent font-heading text-xl font-extrabold text-on-accent shadow-lg">♥</span>
      </div>
    );
  if (kind === "price")
    return (
      <div className="flex h-full items-center gap-2" aria-hidden>
        <span className="rounded-md bg-accent px-2.5 py-1 font-heading text-sm font-bold text-on-accent">QR · $1</span>
        <span className="rounded-md border border-current/20 px-2.5 py-1 font-mono text-sm opacity-70">5 QR −20%</span>
      </div>
    );
  return (
      <div className="flex h-full items-center gap-2" aria-hidden>
        <span className="rounded-md bg-accent px-2.5 py-1 font-heading text-sm font-bold text-on-accent">№ 000 001</span>
        <span className="rounded-md border border-current/20 px-2.5 py-1 font-mono text-sm opacity-70">№ 777 777</span>
      </div>
    );
  return (
    <div className="flex h-full items-center gap-2" aria-hidden>
      <span className="rounded-full border border-current/20 px-3 py-1 font-mono text-xs opacity-70">3 / 50</span>
      <span className="rounded-full bg-accent px-3 py-1 font-heading text-sm font-bold text-on-accent">$15</span>
    </div>
  );
}

export function HomeFeatures({ t }: { t: Dict }) {
  const items = [
    { n: "01", art: "memory" as const, title: t.memoryPromoTitle, text: t.memoryPromoText, cta: t.memoryPromoCta, href: "/codes" },
    { n: "02", art: "price" as const, title: `${t.oneQrTitle} $1`, text: t.oneQrText, cta: t.packsKicker, href: "/market#packs-title" },
    { n: "03", art: "market" as const, title: t.marketTitle, text: t.marketHint, cta: t.homeMarketCta, href: "/market" },
  ];
  return (
    <section className="mt-16">
      <h2 className="font-heading text-2xl font-extrabold sm:text-4xl">{t.homeWhy}</h2>
      <div className="mt-6 grid gap-3 md:grid-cols-3">
        {items.map((x, i) => (
          <Link
            key={x.n}
            href={x.href}
            className={`group flex flex-col rounded-2xl border p-6 transition-all hover:-translate-y-1 ${
              i === 0 ? "border-stage bg-stage text-on-stage" : "border-line bg-card hover:border-ink"
            }`}
          >
            <div className="flex items-start justify-between">
              <span className={`font-mono text-xs ${i === 0 ? "text-on-stage/60" : "text-muted"}`}>{x.n}</span>
            </div>
            <div className="mt-4 h-24">
              <FeatureArt kind={x.art} />
            </div>
            <span className="mt-4 font-heading text-xl font-bold">{x.title}</span>
            <span className={`mt-2 flex-1 text-sm leading-relaxed ${i === 0 ? "text-on-stage/70" : "text-muted"}`}>{x.text}</span>
            <span className={`mt-6 inline-flex items-center gap-2 text-sm font-semibold ${i === 0 ? "text-accent" : "text-accent-ink"}`}>
              {x.cta}
              <span aria-hidden className="transition-transform group-hover:translate-x-1">
                →
              </span>
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
