"use client";
// Маркет: дроп дня, все дизайны с ценой и остатком тиража.
import Link from "next/link";
import { useEffect, useState } from "react";
import { api, type MarketState } from "@/lib/codes";
import { tr, type Dict, type Lang } from "@/lib/i18n";
import { useLang } from "@/lib/lang";
import { catalog, type Design } from "@/lib/market";
import { useMe } from "@/lib/me";
import { CodePacks, OneQrBanner } from "./CodePacks";
import { HeroSlider } from "./HeroSlider";
import { LotCards, useLots } from "./Lots";
import { QrThumb } from "./QrThumb";
import { Shell } from "./Shell";
import { Info } from "./ui";

export const sampleLink = (base: string) => `${base || "https://qr.studio"}/c/sample`;

/** «Осталось 9 из 30» / «Раскуплено» / «Без тиража». */
export function EditionNote({ t, d, sold, className = "" }: { t: Dict; d: Design; sold: number | undefined; className?: string }) {
  if (d.edition === null) return <span className={`text-muted ${className}`}>{t.noEdition}</span>;
  if (sold === undefined) return <span className={className}>&nbsp;</span>;
  const left = d.edition - sold;
  return left <= 0 ? (
    <span className={`font-semibold text-warn ${className}`}>{t.soldOut}</span>
  ) : (
    <span className={`font-semibold ${left <= 10 ? "text-warn" : "text-ink"} ${className}`}>
      {t.left} {left} {t.of} {d.edition}
    </span>
  );
}

/** Что выложено и сколько продано; пока не загрузилось — undefined. */
export function useMarket(): MarketState | undefined {
  const [state, setState] = useState<MarketState>();
  useEffect(() => {
    let live = true;
    api.market().then((m) => live && setState(m), () => {});
    return () => {
      live = false;
    };
  }, []);
  return state;
}

/** Редкость по тиражу: до 30 — легенда, до 100 — редкий, без тиража — открытый. */
const rarity = (d: Design): "legend" | "rare" | "open" => (d.edition === null ? "open" : d.edition <= 30 ? "legend" : "rare");

function RarityBadge({ t, d }: { t: Dict; d: Design }) {
  const r = rarity(d);
  const cls = r === "legend" ? "bg-accent text-on-accent" : r === "rare" ? "bg-stage text-on-stage" : "bg-card/90 text-ink border border-line";
  return <span className={`rounded-full px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.12em] ${cls}`}>{r === "legend" ? "★ " : ""}{t[r === "legend" ? "rarityLegend" : r === "rare" ? "rarityRare" : "rarityOpen"]}</span>;
}

/** Полоска тиража: сколько разобрали. */
function EditionBar({ d, sold, dark }: { d: Design; sold: number | undefined; dark?: boolean }) {
  if (d.edition === null || sold === undefined) return null;
  const k = Math.min(1, sold / d.edition);
  return (
    <span className={`block h-1.5 overflow-hidden rounded-full ${dark ? "bg-white/15" : "bg-line"}`}>
      <span className="block h-full rounded-full bg-accent" style={{ width: `${Math.max(4, k * 100)}%` }} />
    </span>
  );
}

function DesignCard({ t, lang, d, link, sold }: { t: Dict; lang: Lang; d: Design; link: string; sold: Record<string, number> | undefined }) {
  const n = sold ? (sold[d.id] ?? 0) : undefined;
  return (
    <li>
      <Link
        href={`/market/${d.id}`}
        className="group flex h-full flex-col overflow-hidden rounded-3xl bg-stage text-on-stage shadow-[0_18px_40px_-24px_rgba(0,0,0,0.6)] transition-all duration-300 hover:-translate-y-1.5 hover:shadow-[0_30px_60px_-24px_rgba(0,0,0,0.7)]"
      >
        {/* Код — на своём цвете, как на витрине. */}
        <div className="relative p-4 sm:p-5" style={{ background: d.style.bg }}>
          <div className="absolute left-3 top-3 z-10">
            <RarityBadge t={t} d={d} />
          </div>
          <QrThumb link={link} style={d.style} className="w-full rounded-2xl shadow-[0_10px_30px_-12px_rgba(0,0,0,0.45)] transition-transform duration-300 group-hover:scale-[1.03]" />
        </div>
        <div className="flex flex-1 flex-col gap-2 p-4">
          <div className="flex items-start justify-between gap-2">
            <span className="min-w-0">
              <span className="line-clamp-2 block break-words font-heading text-sm font-bold leading-tight sm:text-base">{tr(d.name, lang)}</span>
              {d.collab && <span className="block truncate font-mono text-[11px] text-accent">QR SPACE × {d.collab.toUpperCase()}</span>}
            </span>
            <span className="shrink-0 rounded-lg bg-accent px-2 py-0.5 font-heading text-sm font-extrabold text-on-accent">${d.price}</span>
          </div>
          <div className="mt-auto space-y-1.5">
            <EditionBar d={d} sold={n} dark />
            <EditionNote t={t} d={d} sold={n} className="block text-xs !text-on-stage/70" />
          </div>
        </div>
      </Link>
    </li>
  );
}

/** До полуночи — новый дроп. Время считаем только в браузере (на сервере — пусто, чтобы страницы совпали). */
function Countdown({ t }: { t: Dict }) {
  const [left, setLeft] = useState<string | null>(null);
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      const end = new Date(now);
      end.setHours(24, 0, 0, 0);
      const s = Math.floor((+end - +now) / 1000);
      const p = (x: number) => String(x).padStart(2, "0");
      setLeft(`${p(Math.floor(s / 3600))}:${p(Math.floor((s % 3600) / 60))}:${p(s % 60)}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <span className="inline-flex items-center gap-2 font-mono text-xs text-on-stage/70">
      {t.nextDropIn} <span className="rounded-md bg-white/10 px-2 py-0.5 text-on-stage tabular-nums">{left ?? "--:--:--"}</span>
    </span>
  );
}

type Filter = "all" | "edition" | "open" | "collab";
type Sort = "new" | "cheap" | "expensive";

export function MarketPage() {
  const { lang, t } = useLang((t) => `${t.marketTitle} — ${t.appName}`);
  const { base } = useMe();
  const market = useMarket();
  const sold = market?.sold;
  const link = sampleLink(base);
  const { drop, rest } = catalog(market?.designs ?? []);
  const lots = useLots()?.filter((l) => l.status === "open");
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<Sort>("new");
  const shown = rest
    .filter((d) => (filter === "edition" ? d.edition !== null : filter === "open" ? d.edition === null : filter === "collab" ? !!d.collab : true))
    .sort((a, b) => (sort === "cheap" ? a.price - b.price : sort === "expensive" ? b.price - a.price : 0));
  const dropSold = sold ? (sold[drop.id] ?? 0) : undefined;
  const chip = (on: boolean) => `min-h-10 shrink-0 rounded-full px-4 text-sm font-semibold transition-colors ${on ? "bg-stage text-on-stage" : "border border-line bg-card text-muted hover:text-ink"}`;

  return (
    <Shell t={t} lang={lang}>
      {/* Надпись «Коллекционные QR-коды / Маркет кодов / …» сверху убрана (владелец 09.10.2026) — заголовок только для чтения с экрана. */}
      <h1 className="sr-only">{t.marketTitle}</h1>

      {/* Верх — слайдер: «1 QR — $1» и дроп дня (владелец 09.10.2026). */}
      <HeroSlider>
        <OneQrBanner t={t} />
        {/* Дроп дня — витрина: код на подсвеченном постаменте, тираж полоской, покупка крупно. */}
        <section className="relative overflow-hidden bg-stage text-on-stage">
          <div aria-hidden className="pointer-events-none absolute inset-0">
            <div className="x-stage-grid" />
          </div>
          <div className="relative grid items-center gap-6 p-6 sm:p-8 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] lg:px-14 lg:py-10">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-3">
                <span className="inline-flex items-center gap-2 rounded-full bg-accent px-3 py-1 text-xs font-bold uppercase tracking-wider text-on-accent">
                  <span className="x-blink h-1.5 w-1.5 rounded-full bg-on-accent" />
                  {t.dropOfDay}
                </span>
                <Info text={t.infoDrop} label={t.dropOfDay} dark />
                <Countdown t={t} />
              </div>
              <h2 className="mt-4 font-heading text-5xl font-extrabold leading-[1.02] tracking-tight sm:text-6xl">{tr(drop.name, lang)}</h2>
              <p className="mt-3 max-w-md text-on-stage/70">{tr(drop.about, lang)}</p>
              {drop.edition !== null && (
                <div className="mt-5 max-w-sm space-y-2">
                  <EditionBar d={drop} sold={dropSold} dark />
                  <EditionNote t={t} d={drop} sold={dropSold} className="block font-mono text-xs !text-on-stage/80" />
                </div>
              )}
              <div className="mt-6 flex flex-wrap items-center gap-3">
                <Link href={`/market/${drop.id}`} className="inline-flex min-h-13 items-center gap-3 rounded-xl bg-accent px-6 font-heading text-base font-bold text-on-accent hover:brightness-95">
                  {t.buyFor} ${drop.price} <span aria-hidden>→</span>
                </Link>
                <Link href={`/market/${drop.id}`} className="inline-flex min-h-13 items-center rounded-xl border border-stage-line px-6 font-heading text-sm font-bold hover:border-on-stage/60">
                  {t.seeMore}
                </Link>
              </div>
            </div>
            <Link href={`/market/${drop.id}`} className="relative mx-auto block w-full max-w-[170px] sm:max-w-[260px]" aria-label={tr(drop.name, lang)}>
              <div aria-hidden className="x-ring" />
              <div className="relative rotate-[-4deg] rounded-[1.75rem] p-4 shadow-[0_40px_80px_-30px_rgba(198,255,46,0.45)] transition-transform duration-500 hover:rotate-0" style={{ background: drop.style.bg }}>
                <QrThumb link={link} style={drop.style} className="w-full rounded-2xl" />
                <div className="mt-3 flex items-center justify-between px-1 font-mono text-[11px] font-bold uppercase tracking-wider" style={{ color: drop.style.fg }}>
                  <span>QR SPACE</span>
                  <span>{drop.edition !== null ? `1 / ${drop.edition}` : "∞"}</span>
                </div>
              </div>
            </Link>
          </div>
        </section>
      </HeroSlider>

      <CodePacks t={t} lang={lang} />

      {lots && lots.length > 0 && (
        <section className="mt-12">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <h2 className="flex items-center gap-2 font-heading text-2xl font-extrabold sm:text-3xl">
              {t.resaleTitle}
              <Info text={t.infoResale} label={t.resaleTitle} />
            </h2>
          </div>
          <p className="mb-4 mt-2 max-w-2xl text-sm text-muted">{t.resaleHint}</p>
          <LotCards t={t} lang={lang} lots={lots} link={link} />
        </section>
      )}

      <section className="mt-12">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-heading text-2xl font-extrabold sm:text-3xl">{t.allDesigns}</h2>
          <div className="flex gap-1 rounded-full border border-line bg-card p-1 text-sm">
            {(["new", "cheap", "expensive"] as Sort[]).map((x) => (
              <button key={x} type="button" aria-pressed={sort === x} onClick={() => setSort(x)} className={`min-h-9 rounded-full px-3 font-semibold ${sort === x ? "bg-stage text-on-stage" : "text-muted hover:text-ink"}`}>
                {t[x === "new" ? "sortNew" : x === "cheap" ? "sortCheap" : "sortExpensive"]}
              </button>
            ))}
          </div>
        </div>
        <div className="-mx-4 mt-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
          {(["all", "edition", "open", "collab"] as Filter[]).map((x) => (
            <button key={x} type="button" aria-pressed={filter === x} onClick={() => setFilter(x)} className={chip(filter === x)}>
              {t[x === "all" ? "filterAll" : x === "edition" ? "filterEdition" : x === "open" ? "filterOpen" : "filterCollab"]}
            </button>
          ))}
        </div>
        <ul className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
          {shown.map((d) => (
            <DesignCard key={d.id} t={t} lang={lang} d={d} link={link} sold={sold} />
          ))}
        </ul>
      </section>

    </Shell>
  );
}
