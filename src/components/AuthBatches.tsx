"use client";
// Защита от подделок для брендов: партии вещей и бирки для печати (код + номер + секрет под стираемый слой).
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { api, linkOf, type Batch, type BatchItem } from "@/lib/codes";
import { fmtDateTime } from "@/lib/format";
import type { Dict } from "@/lib/i18n";
import { useLang } from "@/lib/lang";
import { useMe } from "@/lib/me";
import { buildDrawing, toSvg } from "@/lib/qr/render";
import { DEFAULT_STYLE, toQrStyle } from "@/lib/qr/style";
import { useInBrowser } from "./QrThumb";
import { Notice, Shell } from "./Shell";

const field = "w-full rounded-xl border border-line bg-field px-3.5 py-2.5 text-base outline-none transition-colors focus:border-accent";

function LoginFirst({ t, next }: { t: Dict; next: string }) {
  return (
    <div className="mt-6 rounded-2xl border border-line bg-card p-6 text-center">
      <Link href={`/login?next=${next}`} className="inline-grid min-h-11 place-items-center rounded-xl bg-accent px-5 text-sm font-semibold text-on-accent">
        {t.login}
      </Link>
    </div>
  );
}

export function AuthBatchesPage() {
  const { lang, t } = useLang((t) => `${t.authTitle} — ${t.appName}`);
  const { ready, me } = useMe();
  const [list, setList] = useState<{ me: string; batches: Batch[] } | null>(null);
  const [brand, setBrand] = useState("");
  const [product, setProduct] = useState("");
  const [count, setCount] = useState("50");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!me) return;
    let live = true;
    api.authBatches().then((batches) => live && setList({ me, batches }), () => {});
    return () => {
      live = false;
    };
  }, [me]);
  const batches = list?.me === me ? list.batches : null;

  return (
    <Shell t={t} lang={lang}>
      <Link href="/brand" className="inline-flex min-h-10 items-center gap-1 text-sm font-medium text-muted hover:text-ink">
        ← {t.brandTitle}
      </Link>
      <h1 className="mt-1 font-heading text-3xl font-extrabold tracking-tight">{t.authTitle}</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted">{t.authHint}</p>
      <ol className="mt-4 grid max-w-3xl gap-2 text-sm sm:grid-cols-3">
        {[t.authStep1, t.authStep2, t.authStep3].map((s, i) => (
          <li key={i} className="rounded-2xl border border-line bg-card p-4">
            <span className="mb-1 block font-heading text-lg font-extrabold text-accent-ink">{i + 1}</span>
            {s}
          </li>
        ))}
      </ol>
      {!ready ? null : !me ? (
        <LoginFirst t={t} next="/brand/auth" />
      ) : (
        <div className="mt-6 space-y-6">
          <form
            className="grid max-w-3xl gap-3 rounded-2xl border border-line bg-card p-5 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_110px_auto] sm:items-end"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              try {
                const b = await api.makeAuthBatch({ brand, product, count: Math.round(Number(count)) });
                setList((l) => l && { ...l, batches: [b, ...l.batches] });
                setProduct("");
              } finally {
                setBusy(false);
              }
            }}
          >
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-muted">{t.brandName}</span>
              <input value={brand} maxLength={60} onChange={(e) => setBrand(e.target.value)} className={field} />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-muted">{t.authProduct}</span>
              <input value={product} maxLength={80} placeholder={t.authProductPlaceholder} onChange={(e) => setProduct(e.target.value)} className={field} />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-muted">{t.authCount}</span>
              <input type="number" min={1} max={500} value={count} onChange={(e) => setCount(e.target.value)} className={field} />
            </label>
            <button type="submit" disabled={busy || !brand.trim() || !product.trim() || !(Number(count) >= 1)} className="min-h-12 rounded-xl bg-accent px-5 text-sm font-semibold text-on-accent disabled:opacity-40">
              {t.authCreate}
            </button>
          </form>
          {batches && batches.length > 0 && (
            <ul className="divide-y divide-line rounded-2xl border border-line bg-card">
              {batches.map((b) => (
                <li key={b.batch}>
                  <Link href={`/brand/auth/${b.batch}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 p-4 hover:bg-field">
                    <span className="min-w-0 flex-1 basis-48">
                      <span className="block font-semibold">
                        {b.brand} · {b.product}
                      </span>
                      <span className="block text-xs text-muted">{fmtDateTime(b.createdAt, lang)}</span>
                    </span>
                    <span className="text-sm">
                      {fill2(t.authClaimed, b.claimed, b.count)}
                    </span>
                    <span className="text-sm font-semibold text-accent-ink">{t.authLabels} →</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Shell>
  );
}

const fill2 = (s: string, a: number, b: number) => s.replace("{n}", String(a)).replace("{of}", String(b));

/** Бирки партии на A4: маленький код, номер, секрет (печатать под стираемый слой или в закрытой части бирки). */
export function AuthLabelsPage({ id }: { id: string }) {
  const { lang, t } = useLang((t) => `${t.authLabels} — ${t.appName}`);
  const { ready, me, base } = useMe();
  const browser = useInBrowser();
  const [data, setData] = useState<{ batch: Batch; items: BatchItem[] } | null | undefined>();
  useEffect(() => {
    if (!me) return;
    let live = true;
    api.authBatch(id).then(
      (d) => live && setData(d),
      () => live && setData(null),
    );
    return () => {
      live = false;
    };
  }, [id, me]);
  const svgs = useMemo(
    () => (browser && data ? data.items.map((it) => toSvg(buildDrawing(linkOf(base, { id: it.id, short: it.short, compact: true }), toQrStyle(DEFAULT_STYLE)), 300)) : []),
    [browser, data, base],
  );

  return (
    <Shell t={t} lang={lang}>
      <div className="print:hidden">
        <Link href="/brand/auth" className="inline-flex min-h-10 items-center gap-1 text-sm font-medium text-muted hover:text-ink">
          ← {t.authTitle}
        </Link>
      </div>
      {!ready ? null : !me ? (
        <LoginFirst t={t} next={`/brand/auth/${id}`} />
      ) : data === undefined ? (
        <Notice>{t.loading}</Notice>
      ) : data === null ? (
        <Notice>{t.notFound}</Notice>
      ) : (
        <>
          <div className="mt-1 flex flex-wrap items-end justify-between gap-3 print:hidden">
            <div>
              <h1 className="font-heading text-3xl font-extrabold tracking-tight">
                {data.batch.brand} · {data.batch.product}
              </h1>
              <p className="mt-1 text-sm text-muted">{fill2(t.authClaimed, data.batch.claimed, data.batch.count)}</p>
              <p className="mt-1 max-w-2xl text-xs text-muted">{t.authLabelsHint}</p>
            </div>
            <button type="button" onClick={() => window.print()} className="min-h-12 rounded-xl bg-accent px-5 text-sm font-semibold text-on-accent">
              🖨 {t.print}
            </button>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 print:grid-cols-4 print:gap-2">
            {data.items.map((it, i) => (
              <div key={it.id} className="break-inside-avoid rounded-xl border border-dashed border-line bg-white p-2 text-center text-black">
                <div className="mx-auto w-full max-w-[140px] [&>svg]:h-full [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: svgs[i] ?? "" }} />
                <div className="mt-1 text-[11px] font-semibold">
                  {data.batch.brand} · {t.editionNo} {it.serial}
                </div>
                <div className="mt-1 rounded-md bg-[#c9c9c9] px-1 py-1 font-mono text-xs font-bold tracking-widest">{it.secret}</div>
                {it.claimed && <div className="mt-1 text-[10px] font-semibold text-ok print:hidden">✓ {t.authRegistered}</div>}
              </div>
            ))}
          </div>
        </>
      )}
    </Shell>
  );
}
