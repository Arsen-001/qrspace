"use client";
// Сертификат подлинности коллекционного кода — для показа и печати (как у коллекционных вещей). С 10.10.2026 — и NFT:
// хозяин выпускает токен (право на код в блокчейне), сертификат показывает сеть, № токена и ссылку в обозреватель блоков.
import Link from "next/link";
import { useEffect, useState } from "react";
import { fmtDate } from "@/lib/format";
import { tr, type L10n } from "@/lib/i18n";
import { useLang } from "@/lib/lang";
import { useMe } from "@/lib/me";
import type { SavedStyle } from "@/lib/qr/style";
import { personName } from "./Avatar";
import { sampleLink } from "./MarketPage";
import { QrThumb } from "./QrThumb";
import { Notice, Shell } from "./Shell";

type Cert = {
  id: string;
  style: SavedStyle | null;
  edition: { design: string; no: number; of: number | null };
  design: { name: L10n; collab: string | null; by: string | null } | null;
  owner: string;
  owners: { person: string; at: string; price: number | null }[];
  nft: { token: number; network: string; test: boolean; contract: string; holder: string; url: string | null; txUrl: string | null } | null;
  nftReady: boolean;
};

const shortHex = (h: string) => (h.length > 14 ? `${h.slice(0, 6)}…${h.slice(-4)}` : h);

export function CertPage({ id }: { id: string }) {
  const { lang, t } = useLang((t) => `${t.certTitle} — ${t.appName}`);
  const { base, me } = useMe();
  const [cert, setCert] = useState<Cert | null | undefined>();
  const [tick, setTick] = useState(0);
  const [minting, setMinting] = useState<"idle" | "busy" | "bad">("idle");
  useEffect(() => {
    let live = true;
    fetch(`/api/cert/${id}`, { cache: "no-store" })
      .then((r) => (r.ok ? (r.json() as Promise<Cert>) : null))
      .then((c) => live && setCert(c), () => live && setCert(null));
    return () => {
      live = false;
    };
  }, [id, tick]);
  const mint = async () => {
    setMinting("busy");
    const r = await fetch(`/api/codes/${id}/nft`, { method: "POST" }).catch(() => null);
    setMinting(r?.ok ? "idle" : "bad");
    setTick((n) => n + 1);
  };
  const certUrl = `${base}/cert/${id}`;

  return (
    <Shell t={t} lang={lang} narrow>
      {cert === undefined ? (
        <Notice>{t.loading}</Notice>
      ) : cert === null ? (
        <Notice>{t.notFound}</Notice>
      ) : (
        <>
          <article className="overflow-hidden rounded-3xl bg-stage p-6 text-on-stage shadow-xl print:shadow-none sm:p-8">
            <div className="flex items-center justify-between gap-3 font-mono text-xs uppercase tracking-[0.2em] text-white/70">
              <span>QR Space</span>
              <span>{t.certOriginal}</span>
            </div>
            <h1 className="mt-4 font-heading text-2xl font-extrabold sm:text-3xl">{t.certTitle}</h1>
            <div className="mt-6 grid gap-6 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] sm:items-center">
              <QrThumb link={sampleLink(base)} style={cert.style} className="w-full max-w-[280px] justify-self-center" />
              <dl className="space-y-3 text-sm">
                <div>
                  <dt className="text-white/60">{t.certDesign}</dt>
                  <dd className="font-heading text-xl font-bold">{(cert.design && tr(cert.design.name, lang)) ?? (cert.edition.design === "number" ? t.numberCode : cert.edition.design)}</dd>
                  {cert.design?.collab && <dd className="text-sm font-semibold text-accent">QR Space × {cert.design.collab}</dd>}
                </div>
                <div>
                  <dt className="text-white/60">{t.editionOf}</dt>
                  <dd className="font-heading text-3xl font-extrabold text-accent">
                    {t.editionNo} {cert.edition.no}
                    {cert.edition.of !== null && <span className="text-xl text-white/70"> / {cert.edition.of.toLocaleString("ru-RU").replace(/\u00a0/g, " ")}</span>}
                  </dd>
                </div>
                <div>
                  <dt className="text-white/60">{t.certOwner}</dt>
                  <dd className="text-base font-semibold">{personName(cert.owner, lang)}</dd>
                </div>
                {cert.design?.by && (
                  <div>
                    <dt className="text-white/60">{t.designerLabel}</dt>
                    <dd>{personName(cert.design.by, lang)}</dd>
                  </div>
                )}
              </dl>
            </div>
            <div className="mt-6 border-t border-white/15 pt-4">
              <div className="text-xs uppercase tracking-wider text-white/60">{t.owners}</div>
              <ol className="mt-2 space-y-1 text-sm">
                {cert.owners.map((o, i) => (
                  <li key={i} className="flex justify-between gap-3">
                    <span>
                      {i + 1}. {personName(o.person, lang)}
                    </span>
                    <span className="text-white/70">
                      {o.price !== null && `$${o.price} · `}
                      {fmtDate(o.at.slice(0, 10), lang)}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
            {cert.nft && (
              <div className="mt-6 border-t border-white/15 pt-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs uppercase tracking-wider text-white/60">NFT</span>
                  {cert.nft.test && <span className="rounded-md bg-white/10 px-2 py-0.5 font-mono text-[11px] uppercase tracking-wider text-white/80">{t.nftTest}</span>}
                </div>
                <div className="mt-1 font-heading text-2xl font-extrabold text-accent">
                  {t.nftToken} #{cert.nft.token}
                </div>
                <dl className="mt-2 space-y-1.5 text-sm">
                  {[
                    [t.nftNetwork, cert.nft.network],
                    [t.nftContract, <span key="c" className="font-mono">{shortHex(cert.nft.contract)}</span>],
                    [t.nftHolder, <span key="h">{t.nftKept} · <span className="font-mono">{shortHex(cert.nft.holder)}</span></span>],
                  ].map(([k, v], i) => (
                    <div key={i} className="flex justify-between gap-3">
                      <dt className="shrink-0 text-white/60">{k}</dt>
                      <dd className="min-w-0 text-right">{v}</dd>
                    </div>
                  ))}
                </dl>
                {cert.nft.url && (
                  <a href={cert.nft.url} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex min-h-11 items-center rounded-xl bg-accent px-4 text-sm font-semibold text-on-accent print:hidden">
                    {t.nftView} →
                  </a>
                )}
              </div>
            )}
            <div className="mt-6 flex items-center gap-4 border-t border-white/15 pt-4">
              <QrThumb link={certUrl} style={null} className="h-20 w-20 shrink-0" />
              <p className="min-w-0 text-xs text-white/70">
                {t.certVerify}
                <span className="mt-1 block break-all font-mono text-white/90">{certUrl}</span>
              </p>
            </div>
          </article>
          {me === cert.owner && cert.nftReady && (
            <section className="mt-4 rounded-2xl border border-line bg-card p-5 print:hidden">
              <h2 className="font-heading text-lg font-bold">{t.nftMintTitle}</h2>
              <p className="mt-1 text-sm leading-relaxed text-muted">{t.nftMintText}</p>
              <button type="button" disabled={minting === "busy"} onClick={mint} className="mt-4 min-h-12 w-full rounded-xl bg-accent px-5 font-heading text-sm font-bold text-on-accent disabled:opacity-60">
                {minting === "busy" ? t.nftMinting : `◆ ${t.nftMint}`}
              </button>
              {minting === "bad" && (
                <p role="alert" className="mt-3 rounded-xl bg-warn-soft p-3 text-sm font-medium">
                  {t.nftFailed}
                </p>
              )}
            </section>
          )}
          <div className="mt-4 flex flex-wrap gap-2 print:hidden">
            <button type="button" onClick={() => window.print()} className="min-h-11 rounded-xl bg-accent px-4 text-sm font-semibold text-on-accent">
              🖨 {t.print}
            </button>
            <Link href="/market" className="grid min-h-11 place-items-center rounded-xl border border-line bg-card px-4 text-sm font-semibold">
              {t.marketTitle}
            </Link>
          </div>
        </>
      )}
    </Shell>
  );
}
