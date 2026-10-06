// Первый экран, бегущая строка и «больше, чем QR-код» на главной (новый вид, .x-home).
import Link from "next/link";
import type { Dict } from "@/lib/i18n";

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
  return (
    <section className="relative overflow-hidden rounded-3xl border border-stage-line bg-stage text-on-stage">
      <div className="grid items-center gap-10 p-6 sm:p-10 lg:grid-cols-[1.25fr_1fr] lg:p-14">
        <div className="min-w-0">
          <p className="inline-flex items-center gap-2 rounded-full border border-stage-line px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.14em] text-on-stage/70">
            <span className="x-blink h-2 w-2 rounded-full bg-accent" />
            {t.homeKicker}
          </p>
          <h1 className="mt-6 font-heading text-[2.5rem] leading-[1.1] font-extrabold text-balance sm:text-6xl lg:text-[4.25rem]">
            {t.homeTitleA} <span className="box-decoration-clone rounded-md bg-accent px-2 text-on-accent">{t.homeTitleB}</span>
          </h1>
          <p className="mt-6 max-w-xl text-base leading-relaxed text-on-stage/70 sm:text-lg">{t.homeLead}</p>
          <div className="mt-8 flex flex-wrap gap-2 sm:gap-3">
            <a href="#make" className="group inline-flex min-h-13 items-center gap-3 rounded-xl bg-accent px-5 sm:px-6 font-heading text-sm font-bold text-on-accent">
              {t.homeCta}
              <span aria-hidden className="transition-transform group-hover:translate-x-1">
                →
              </span>
            </a>
            <Link
              href="/market"
              className="inline-flex min-h-13 items-center rounded-xl border border-stage-line px-5 sm:px-6 font-heading text-sm font-bold hover:border-on-stage/60"
            >
              {t.navMarket}
            </Link>
          </div>
        </div>
        <div className="relative mx-auto w-full max-w-sm lg:max-w-none">
          <div className="aspect-square rounded-2xl border border-stage-line p-5 sm:p-7">
            <BigCode />
          </div>
          <span className="absolute -top-3 right-6 rounded-md bg-accent px-2.5 py-1 font-heading text-xs font-bold text-on-accent">№ 000 777</span>
          <span className="absolute -bottom-3 left-6 rounded-md border border-stage-line bg-stage px-2.5 py-1 font-mono text-xs text-on-stage/80">
            {t.numbersTitle}
          </span>
        </div>
      </div>
    </section>
  );
}

export function HomeTicker({ t }: { t: Dict }) {
  const items = t.homeTicker.split(" · ");
  const row = (hidden: boolean) => (
    <div className="flex shrink-0 items-center" aria-hidden={hidden || undefined}>
      {items.map((s, i) => (
        <span key={i} className="flex items-center whitespace-nowrap">
          <span className="px-5 font-heading text-sm font-bold uppercase sm:text-base">{s}</span>
          <span aria-hidden>✦</span>
        </span>
      ))}
    </div>
  );
  return (
    <div className="-mx-4 my-8 -rotate-1 overflow-hidden border-y border-ink bg-accent py-3 text-on-accent sm:-mx-6">
      <div className="x-marquee flex w-max">
        {row(false)}
        {row(true)}
      </div>
    </div>
  );
}

export function HomeFeatures({ t }: { t: Dict }) {
  const items = [
    {
      n: "01",
      title: t.memoryPromoTitle,
      text: t.memoryPromoText,
      cta: t.memoryPromoCta,
      href: "/codes",
    },
    {
      n: "02",
      title: t.numbersTitle,
      text: t.numbersTeaser,
      cta: t.numbersTitle,
      href: "/numbers",
    },
    {
      n: "03",
      title: t.marketTitle,
      text: t.marketHint,
      cta: t.marketTitle,
      href: "/market",
    },
  ];
  return (
    <section className="mt-16">
      <h2 className="font-heading text-2xl font-extrabold sm:text-4xl">{t.homeWhy}</h2>
      <div className="mt-6 grid gap-3 md:grid-cols-3">
        {items.map((x) => (
          <Link
            key={x.n}
            href={x.href}
            aria-label={x.cta}
            className="group flex flex-col rounded-2xl border border-line bg-card p-6 transition-colors hover:border-ink"
          >
            <span className="font-mono text-xs text-muted">{x.n}</span>
            <span className="mt-8 font-heading text-xl font-bold">{x.title}</span>
            <span className="mt-2 flex-1 text-sm leading-relaxed text-muted">{x.text}</span>
            <span
              aria-hidden
              className="mt-6 grid h-10 w-10 place-items-center rounded-full border border-line transition-colors group-hover:border-ink group-hover:bg-accent group-hover:text-on-accent"
            >
              →
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
