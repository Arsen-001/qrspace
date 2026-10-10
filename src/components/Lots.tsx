"use client";
// Перепродажа: карточки лотов в маркете и форма «Продать» у коллекционного кода.
import Link from "next/link";
import { useEffect, useState } from "react";
import { api, shownLink, type CodeView, type Lot } from "@/lib/codes";
import { fmtUntil } from "@/lib/format";
import type { Dict, Lang } from "@/lib/i18n";
import { DURATIONS, FEE, sellerGets, topBid } from "@/lib/listings";
import { QrThumb } from "./QrThumb";
import { Segmented, Select } from "./ui";

// У номерных кодов номер уже в названии («№ 777») — второй раз не пишем.
/** Как назвать лот: коллекционный — по названию, любой другой — его ссылкой «qrspace.co/K/AB12CD» (продаётся как домен). */
export const lotName = (v: Lot["view"], base: string) => v.title ?? (v.short ? shownLink(`${base || "https://qrspace.co"}/K/${v.short}`) : "QR");

export const editionLabel = (t: Dict, e: { design?: string; no: number; of: number | null } | null) =>
  !e || e.design === "number" ? "" : `${t.editionNo} ${e.no}${e.of !== null ? ` / ${e.of}` : ""}`;

/** Что сейчас по лоту: цена, ставка и сколько осталось, «продано». */
export function LotPrice({ t, lang, lot }: { t: Dict; lang: Lang; lot: Lot }) {
  if (lot.status === "sold") return <span className="text-muted">{t.soldFor} ${lot.final}</span>;
  if (lot.mode === "fixed") return <span className="font-heading text-lg font-extrabold">${lot.price}</span>;
  const top = topBid(lot);
  return (
    <span>
      <span className="font-heading text-lg font-extrabold">${top?.amount ?? lot.price}</span>
      <span className="text-xs text-muted">
        {" "}
        · {top ? t.currentBid : t.startBid} · {lot.endsAt && fmtUntil(lot.endsAt, lang)}
      </span>
    </span>
  );
}

export function useLots(): Lot[] | undefined {
  const [lots, setLots] = useState<Lot[]>();
  useEffect(() => {
    let live = true;
    api.lots().then((l) => live && setLots(l), () => {});
    return () => {
      live = false;
    };
  }, []);
  return lots;
}

export function LotCards({ t, lang, lots, link }: { t: Dict; lang: Lang; lots: Lot[]; link: string }) {
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
      {lots.map((l) => (
        <li key={l.id}>
          <Link
            href={`/market/lot/${l.id}`}
            className="group flex h-full flex-col overflow-hidden rounded-3xl bg-stage text-on-stage shadow-[0_18px_40px_-24px_rgba(0,0,0,0.6)] transition-all duration-300 hover:-translate-y-1.5"
          >
            <div className="relative p-4 sm:p-5" style={{ background: l.view.style?.bg ?? "#fff" }}>
              <span className={`absolute left-3 top-3 z-10 rounded-full px-2.5 py-1 font-mono text-[11px] font-bold uppercase tracking-[0.12em] ${l.mode === "auction" ? "bg-accent text-on-accent" : "bg-stage text-on-stage"}`}>
                {l.mode === "auction" ? t.auction : t.fixedPrice}
              </span>
              <QrThumb link={link} style={l.view.style} className="w-full rounded-2xl shadow-[0_10px_30px_-12px_rgba(0,0,0,0.45)] transition-transform duration-300 group-hover:scale-[1.03]" />
            </div>
            <div className="flex flex-1 flex-col gap-1 p-4">
              <div className="truncate font-heading font-bold">
                {lotName(l.view, link.replace(/\/K\/[^/]*$/i, ""))} <span className="font-mono text-xs text-accent">{editionLabel(t, l.view.edition)}</span>
              </div>
              <div className="mt-auto text-on-stage [&_*]:!text-inherit">
                <LotPrice t={t} lang={lang} lot={l} />
              </div>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** «Продать» у коллекционного кода (в настройках кода, только хозяину). */
export function SellBox({ t, code }: { t: Dict; code: CodeView }) {
  const lots = useLots();
  const open = lots?.find((l) => l.code === code.id && l.status === "open");
  const [mode, setMode] = useState<"fixed" | "auction">("auction");
  const [price, setPrice] = useState("20");
  const [hours, setHours] = useState<number>(72);
  const [made, setMade] = useState<Lot | null>(null);
  const [busy, setBusy] = useState(false);
  const lot = made ?? open;
  if (!code.paid || code.blocked || code.kind === "item" || !lots) return null;
  const n = Math.max(1, Math.round(Number(price) || 0));
  return (
    <section className="rounded-2xl border border-line bg-card p-4">
      {code.edition && (
        <Link href={`/cert/${code.id}`} className="mb-3 flex min-h-11 items-center justify-center rounded-xl bg-stage px-4 text-sm font-semibold text-on-stage">
          {t.certTitle} →
        </Link>
      )}
      <h2 className="font-heading text-base font-bold">{t.sellTitle}</h2>
      {lot ? (
        <p className="mt-2 text-sm">
          {t.onSale} ·{" "}
          <Link href={`/market/lot/${lot.id}`} className="font-semibold text-accent-ink underline underline-offset-2">
            {t.openLot}
          </Link>
        </p>
      ) : (
        <form
          className="mt-3 space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            try {
              setMade(await api.sell(code.id, mode, n, hours));
            } finally {
              setBusy(false);
            }
          }}
        >
          <Segmented<"fixed" | "auction">
            value={mode}
            onChange={setMode}
            options={[
              { id: "auction", label: t.auction },
              { id: "fixed", label: t.fixedPrice },
            ]}
          />
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted">{mode === "auction" ? t.startBid : t.priceLabel}</span>
            <input type="number" min={1} inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value)} className="min-h-11 w-full rounded-xl border border-line bg-field px-3 text-base" />
          </label>
          {mode === "auction" && (
            <div>
              <span className="mb-1 block text-xs font-medium text-muted">{t.auctionLength}</span>
              <Select
                label={t.auctionLength}
                value={String(hours)}
                onChange={(v) => setHours(Number(v))}
                options={DURATIONS.map((h) => ({ id: String(h), label: t[`duration.${h}` as keyof Dict] as string }))}
                className="w-full"
              />
            </div>
          )}
          <p className="text-xs text-muted">
            {t.youGet} ${sellerGets(n)} ({t.fee} {FEE * 100}%). {t.sellWarning}
          </p>
          <button type="submit" disabled={busy} className="min-h-11 w-full rounded-xl bg-accent px-4 text-sm font-semibold text-on-accent disabled:opacity-50">
            {t.putOnSale}
          </button>
        </form>
      )}
    </section>
  );
}
