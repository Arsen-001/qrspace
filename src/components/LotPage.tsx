"use client";
// Лот: код с номером, владельцы, цена или аукцион со ставками; продавцу — снять / завершить (демо).
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { api, type Lot } from "@/lib/codes";
import { fmtDateTime, fmtUntil } from "@/lib/format";
import { useLang } from "@/lib/lang";
import { minBid, sellerGets } from "@/lib/listings";
import { useMe } from "@/lib/me";
import { toSvg } from "@/lib/qr/render";
import { DEFAULT_STYLE, fromSaved } from "@/lib/qr/style";
import { Avatar, personName } from "./Avatar";
import { useDrawing } from "./CodeDesigner";
import { editionLabel, lotName, LotPrice } from "./Lots";
import { sampleLink } from "./MarketPage";
import { useInBrowser } from "./QrThumb";
import { Notice, Shell } from "./Shell";

export function LotPage({ id }: { id: string }) {
  const { lang, t } = useLang((t) => `${t.resaleTitle} — ${t.appName}`);
  const { ready, me, base } = useMe();
  const [lot, setLot] = useState<Lot | null | undefined>();
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    let live = true;
    api.lot(id).then(
      (l) => live && setLot(l),
      () => live && setLot(null),
    );
    return () => {
      live = false;
    };
  }, [id]);

  const style = useMemo(() => (lot?.view.style ? fromSaved(lot.view.style) : DEFAULT_STYLE), [lot]);
  const { drawing } = useDrawing(useInBrowser() && lot ? sampleLink(base) : "", style);
  const svg = useMemo(() => (drawing ? toSvg(drawing, 480) : ""), [drawing]);

  const act = async (action: "buy" | "bid" | "cancel" | "finish", n?: number) => {
    setBusy(true);
    setError(false);
    try {
      setLot(await api.lotAction(id, action, n));
      setAmount("");
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  };

  if (lot === undefined || lot === null)
    return (
      <Shell t={t} lang={lang}>
        <Notice>{lot === null ? t.notFound : t.loading}</Notice>
      </Shell>
    );

  const mine = lot.seller === me;
  const next = minBid(lot);
  const open = lot.status === "open";
  const leading = lot.bids.at(-1)?.person === me;

  return (
    <Shell t={t} lang={lang}>
      <Link href="/market" className="inline-flex min-h-10 items-center gap-1 text-sm font-medium text-muted hover:text-ink">
        ← {t.marketTitle}
      </Link>
      <div className="mt-2 grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start">
        <div className="mx-auto aspect-square w-full max-w-[480px] overflow-hidden rounded-2xl border border-line bg-white [&>svg]:h-full [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: svg }} />
        <div className="space-y-5">
          <div>
            <span className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${lot.mode === "auction" ? "bg-accent text-on-accent" : "bg-ink text-bg"}`}>{lot.mode === "auction" ? t.auction : t.fixedPrice}</span>
            <h1 className="mt-2 font-heading text-3xl font-extrabold tracking-tight">
              {lotName(lot.view, base)} <span className="text-muted">{editionLabel(t, lot.view.edition)}</span>
            </h1>
            <p className="mt-1 flex items-center gap-1.5 text-sm text-muted">
              {t.seller}: <Avatar id={lot.seller} lang={lang} size={20} /> {mine ? t.you : personName(lot.seller, lang)}
            </p>
          </div>

          <section className="rounded-2xl border border-line bg-card p-5">
            <LotPrice t={t} lang={lang} lot={lot} />
            {open && lot.mode === "auction" && lot.endsAt && (
              <p className="mt-1 text-xs text-muted">
                {t.auctionEnds} {fmtUntil(lot.endsAt, lang)} · {fmtDateTime(lot.endsAt, lang)}
              </p>
            )}
            <div className="mt-4">
              {!open ? (
                <p className="text-sm font-semibold">
                  {lot.status === "sold" ? `${t.soldTo} ${lot.buyer === me ? t.you : personName(lot.buyer, lang)} — $${lot.final}` : t.lotClosed}
                </p>
              ) : !ready ? null : !me ? (
                <Link href={`/login?next=/market/lot/${id}`} className="grid min-h-12 place-items-center rounded-xl bg-accent px-5 text-sm font-semibold text-on-accent">
                  {t.loginToBuy}
                </Link>
              ) : mine ? (
                <div className="space-y-2">
                  <p className="text-xs text-muted">
                    {t.youGet} ${sellerGets(lot.mode === "fixed" ? lot.price : (lot.bids.at(-1)?.amount ?? lot.price))}
                  </p>
                  {!lot.bids.length && (
                    <button type="button" disabled={busy} onClick={() => act("cancel")} className="min-h-11 w-full rounded-xl border border-line bg-field px-4 text-sm font-semibold hover:border-muted">
                      {t.cancelLot}
                    </button>
                  )}
                  {lot.mode === "auction" && (
                    <button type="button" disabled={busy} onClick={() => act("finish")} className="min-h-11 w-full rounded-xl border border-line bg-field px-4 text-sm font-semibold hover:border-muted">
                      {t.finishNow}
                    </button>
                  )}
                </div>
              ) : lot.mode === "fixed" ? (
                <button type="button" disabled={busy} onClick={() => act("buy")} className="min-h-12 w-full rounded-xl bg-accent px-5 text-sm font-semibold text-on-accent disabled:opacity-50">
                  {t.buy} — ${lot.price}
                </button>
              ) : leading ? (
                <p className="text-sm font-semibold text-ok">✓ {t.youLead}</p>
              ) : (
                <form
                  className="flex gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    act("bid", Number(amount) || next);
                  }}
                >
                  <input
                    type="number"
                    min={next}
                    inputMode="numeric"
                    value={amount}
                    placeholder={`$${next}`}
                    aria-label={t.yourBid}
                    onChange={(e) => setAmount(e.target.value)}
                    className="min-h-12 w-28 rounded-xl border border-line bg-field px-3 text-base"
                  />
                  <button type="submit" disabled={busy || (!!amount && Number(amount) < next)} className="min-h-12 flex-1 rounded-xl bg-accent px-4 text-sm font-semibold text-on-accent disabled:opacity-50">
                    {t.placeBid} — ${Number(amount) >= next ? Number(amount) : next}
                  </button>
                </form>
              )}
              {error && <p className="mt-2 text-sm text-warn">{t.saveError}</p>}
              {open && !mine && <p className="mt-3 text-xs text-muted">{t.buyDemo} {t.cleanTransfer}</p>}
            </div>
          </section>

          {lot.mode === "auction" && lot.bids.length > 0 && (
            <section className="rounded-2xl border border-line bg-card p-5">
              <h2 className="font-heading font-bold">{t.bids}</h2>
              <ul className="mt-2 divide-y divide-line">
                {[...lot.bids].reverse().map((b, i) => (
                  <li key={i} className="flex items-center gap-2.5 py-2 text-sm">
                    <Avatar id={b.person} lang={lang} size={24} />
                    <span className="min-w-0 flex-1">{b.person === me ? t.you : personName(b.person, lang)}</span>
                    <span className="font-semibold">${b.amount}</span>
                    <span className="text-xs text-muted">{fmtDateTime(b.at, lang)}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {(lot.view.owners?.length ?? 0) > 0 && (
            <section className="rounded-2xl border border-line bg-card p-5">
              <h2 className="font-heading font-bold">{t.owners}</h2>
              <ol className="mt-2 space-y-1.5 text-sm">
                {lot.view.owners!.map((o, i) => (
                  <li key={i} className="flex items-center gap-2.5">
                    <Avatar id={o.person} lang={lang} size={22} />
                    <span className="min-w-0 flex-1">{o.person === me ? t.you : personName(o.person, lang)}</span>
                    {o.price !== null && <span className="font-medium">${o.price}</span>}
                    <span className="text-xs text-muted">{fmtDateTime(o.at, lang)}</span>
                  </li>
                ))}
              </ol>
            </section>
          )}
        </div>
      </div>
    </Shell>
  );
}
