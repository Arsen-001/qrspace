"use client";
// Маркет: дроп дня, все дизайны с ценой и остатком тиража.
import Link from "next/link";
import { useEffect, useState } from "react";
import { api, type MarketState } from "@/lib/codes";
import type { Dict, Lang } from "@/lib/i18n";
import { useLang } from "@/lib/lang";
import { catalog, type Design } from "@/lib/market";
import { useMe } from "@/lib/me";
import { QrThumb } from "./QrThumb";
import { Shell } from "./Shell";

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

function DesignCard({ t, lang, d, link, sold }: { t: Dict; lang: Lang; d: Design; link: string; sold: Record<string, number> | undefined }) {
  return (
    <li>
      <Link href={`/market/${d.id}`} className="block h-full rounded-2xl border border-line bg-card p-3 transition-colors hover:border-muted">
        <QrThumb link={link} style={d.style} className="w-full" />
        <div className="mt-3 flex items-baseline justify-between gap-2 px-1">
          <span className="min-w-0 truncate font-heading font-bold">{d.name[lang]}</span>
          <span className="shrink-0 font-heading font-extrabold">${d.price}</span>
        </div>
        <div className="mt-0.5 px-1 pb-1 text-xs">
          <EditionNote t={t} d={d} sold={sold ? (sold[d.id] ?? 0) : undefined} />
        </div>
      </Link>
    </li>
  );
}

export function MarketPage() {
  const { lang, t } = useLang((t) => `${t.marketTitle} — ${t.appName}`);
  const { base } = useMe();
  const market = useMarket();
  const sold = market?.sold;
  const link = sampleLink(base);
  const { drop, rest } = catalog(market?.designs ?? []);

  return (
    <Shell t={t} lang={lang}>
      <h1 className="font-heading text-3xl font-extrabold tracking-tight sm:text-4xl">{t.marketTitle}</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted">{t.marketHint}</p>

      <Link href={`/market/${drop.id}`} className="mt-6 grid gap-5 overflow-hidden rounded-3xl bg-[#151a3d] p-5 text-white sm:grid-cols-[minmax(0,1fr)_minmax(0,280px)] sm:items-center sm:p-8">
        <div className="min-w-0">
          <span className="inline-block rounded-full bg-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-wider">{t.dropOfDay}</span>
          <div className="mt-3 font-heading text-3xl font-extrabold sm:text-5xl">{drop.name[lang]}</div>
          <p className="mt-2 max-w-md text-sm text-white/80">{drop.about[lang]}</p>
          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
            <span className="font-heading text-2xl font-extrabold">${drop.price}</span>
            <span className="text-sm text-white/80">
              {sold && drop.edition !== null ? (drop.edition - (sold[drop.id] ?? 0) > 0 ? `${t.left} ${drop.edition - (sold[drop.id] ?? 0)} ${t.of} ${drop.edition}` : t.soldOut) : " "}
            </span>
          </div>
        </div>
        <QrThumb link={link} style={drop.style} className="w-full max-w-[280px] justify-self-center shadow-2xl" />
      </Link>

      <h2 className="mt-10 font-heading text-xl font-bold">{t.allDesigns}</h2>
      <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {rest.map((d) => (
          <DesignCard key={d.id} t={t} lang={lang} d={d} link={link} sold={sold} />
        ))}
      </ul>
    </Shell>
  );
}
