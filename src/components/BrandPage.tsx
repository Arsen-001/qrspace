"use client";
// «Для брендов»: пакеты, заявка с логотипом и оплатой (демо), список заказов (дизайнеру — все).
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/lib/codes";
import { fmtDateTime } from "@/lib/format";
import type { Dict, Lang } from "@/lib/i18n";
import { useLang } from "@/lib/lang";
import { useMe } from "@/lib/me";
import { NEEDS, PACKAGES, type Need, type Order, type OrderStatus, type Pkg } from "@/lib/orders";
import { isDesigner } from "@/lib/people";
import { prepareImage } from "@/lib/qr/raster";
import { DEFAULT_STYLE, toSaved } from "@/lib/qr/style";
import { QrThumb } from "./QrThumb";
import { personName } from "./Avatar";
import { Notice, Shell } from "./Shell";
import { UploadButton, StepBadge, Select } from "./ui";

const field = "w-full rounded-xl border border-line bg-field px-3.5 py-2.5 text-base outline-none transition-colors focus:border-accent";

// Примеры кодов «под бренд» для витрины: пекарня (крафт), мода (чёрный), косметика (пудровый).
const BRAND_SAMPLES = [
  { fg: "#3a2414", bg: "#e9d3ad", dot: "rounded", eye: "leaf", tag: "BAKERY" },
  { fg: "#f3f2ec", bg: "#0b0b0c", dot: "dots", eye: "circle", tag: "STREETWEAR" },
  { fg: "#7a1f2b", bg: "#fbe9ea", dot: "liquid", eye: "rounded", tag: "BEAUTY" },
] as const;
const sampleStyle = (x: (typeof BRAND_SAMPLES)[number]) => ({ ...toSaved(DEFAULT_STYLE), fg: x.fg, bg: x.bg, eyeColor: x.fg, eyeBallColor: x.fg, dot: x.dot, eye: x.eye });

/** Лендинг для бизнеса: ценность на сцене, три шага, дальше заявка с тарифами. */
function BrandHero({ t }: { t: Dict }) {
  return (
    <>
      <section className="relative mt-8 overflow-hidden rounded-[2rem] bg-stage text-on-stage">
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div className="x-stage-grid" />
        </div>
        <div className="relative grid items-center gap-10 p-6 sm:p-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:p-12">
          <div className="min-w-0">
            <h2 className="font-heading text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl">{t.brandHeroTitle}</h2>
            <ul className="mt-6 space-y-3 text-sm">
              {[t.brandValue1, t.brandValue2, t.brandValue3].map((x) => (
                <li key={x} className="flex items-start gap-3">
                  <span aria-hidden className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md bg-accent text-[11px] font-bold text-on-accent">
                    ✓
                  </span>
                  <span className="text-on-stage/80">{x}</span>
                </li>
              ))}
            </ul>
            <div className="mt-7 flex flex-wrap gap-3">
              <a href="#order" className="inline-flex min-h-13 items-center gap-3 rounded-xl bg-accent px-6 font-heading text-base font-bold text-on-accent hover:brightness-95">
                {t.brandCta} <span aria-hidden>→</span>
              </a>
              <Link href="/brand/auth" className="inline-flex min-h-13 items-center rounded-xl border border-stage-line px-6 font-heading text-sm font-bold hover:border-on-stage/60">
                {t.authTitle}
              </Link>
            </div>
          </div>
          {/* Три кода «под бренд» веером — сразу видно, что это не просто чёрный квадрат. */}
          <div aria-hidden className="relative mx-auto h-64 w-full max-w-[360px] sm:h-80">
            <div className="x-ring" />
            {BRAND_SAMPLES.map((x, i) => (
              <div
                key={x.tag}
                className={`absolute top-1/2 w-[46%] -translate-y-1/2 rounded-2xl p-2.5 shadow-[0_24px_50px_-20px_rgba(0,0,0,0.6)] ${["left-0 -rotate-12", "left-1/2 z-10 -translate-x-1/2 scale-110", "right-0 rotate-12"][i]}`}
                style={{ background: x.bg }}
              >
                <QrThumb link="HTTPS://QRSPACE.CO/K/BRAND1" style={sampleStyle(x)} className="w-full rounded-lg" />
                <div className="mt-1.5 truncate px-0.5 font-mono text-[9px] font-bold tracking-wider" style={{ color: x.fg }}>
                  {x.tag}
                </div>
                {i === 1 && <span className="absolute -right-2 -top-2 rounded-md bg-accent px-1.5 py-0.5 font-mono text-[9px] font-bold text-on-accent shadow">✓ ORIGINAL</span>}
              </div>
            ))}
          </div>
        </div>
      </section>
      <section className="mt-8">
        <h2 className="font-heading text-2xl font-extrabold">{t.brandHowTitle}</h2>
        <ol className="mt-4 grid gap-3 sm:grid-cols-3">
          {[t.brandHow1, t.brandHow2, t.brandHow3].map((x, i) => (
            <li key={x} className="rounded-3xl border border-line bg-card p-5">
              <StepBadge n={i + 1} />
              <p className="mt-3 text-sm">{x}</p>
            </li>
          ))}
        </ol>
      </section>
    </>
  );
}

export function StatusChip({ t, status }: { t: Dict; status: OrderStatus }) {
  const cls = status === "done" ? "bg-ok-soft text-ok" : status === "review" ? "bg-accent text-on-accent" : status === "new" ? "bg-warn-soft text-warn" : "bg-field text-ink";
  return <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${cls}`}>{t[`status.${status}`]}</span>;
}

const stepH = "flex items-center gap-3 font-heading text-base font-bold";

function OrderForm({ t }: { t: Dict }) {
  const router = useRouter();
  const [brand, setBrand] = useState("");
  const [contact, setContact] = useState("");
  const [need, setNeed] = useState<Need>("packaging");
  const [qty, setQty] = useState("100");
  const [deadline, setDeadline] = useState("");
  const [notes, setNotes] = useState("");
  const [logo, setLogo] = useState<string | null>(null);
  const [pkg, setPkg] = useState<Pkg>("start");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const ready = brand.trim() && contact.trim() && Number(qty) >= 1;

  return (
    <form
      className="space-y-5 rounded-2xl border border-line bg-card p-5 sm:p-6"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!ready) return;
        setBusy(true);
        setError(false);
        try {
          const o = await api.createOrder({ brand, contact, need, qty: Math.round(Number(qty)), pkg, deadline: deadline || null, notes, logo });
          router.push(`/brand/${o.id}`);
        } catch {
          setError(true);
          setBusy(false);
        }
      }}
    >
      <h2 className="font-heading text-xl font-bold">{t.orderFormTitle}</h2>
      <h3 className={stepH}>
        <StepBadge n={1} />
        {t.brandStep1}
      </h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-muted">{t.brandName}</span>
          <input value={brand} maxLength={60} onChange={(e) => setBrand(e.target.value)} className={field} />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-muted">{t.brandContact}</span>
          <input value={contact} maxLength={100} onChange={(e) => setContact(e.target.value)} className={field} autoComplete="email" />
        </label>
      </div>
      <h3 className={`${stepH} border-t border-line pt-5`}>
        <StepBadge n={2} />
        {t.brandStep2}
      </h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <span className="mb-1.5 block text-sm font-medium text-muted">{t.brandNeed}</span>
          <Select label={t.brandNeed} value={need} onChange={(v) => setNeed(v as Need)} options={NEEDS.map((n) => ({ id: n, label: t[`need.${n}`] }))} />
        </div>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-muted">{t.brandQty}</span>
          <input type="number" min={1} inputMode="numeric" value={qty} onChange={(e) => setQty(e.target.value)} className={field} />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-muted">{t.brandDeadline}</span>
          <input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} className={field} />
        </label>
        <div>
          <span className="mb-1.5 block text-sm font-medium text-muted">{t.brandLogo}</span>
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {logo && <img src={logo} alt="" className="h-11 w-11 rounded-lg border border-line bg-white object-contain" />}
            <UploadButton label={logo ? t.replace : t.upload} onFile={async (f) => setLogo(await prepareImage(f, { px: 512, square: false, type: "image/png" }))} />
          </div>
        </div>
      </div>
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-muted">{t.brandNotes}</span>
        <textarea value={notes} rows={3} maxLength={2000} placeholder={t.brandNotesPlaceholder} onChange={(e) => setNotes(e.target.value)} className={`${field} resize-y`} />
      </label>
      <h3 className={`${stepH} border-t border-line pt-5`}>
        <StepBadge n={3} />
        {t.brandStep3}
      </h3>
      <div role="radiogroup" aria-label={t.packageLabel} className="grid gap-2 sm:grid-cols-2">
        {(Object.keys(PACKAGES) as Pkg[]).map((k) => (
          <button
            key={k}
            type="button"
            role="radio"
            aria-checked={pkg === k}
            onClick={() => setPkg(k)}
            className={`rounded-3xl border-2 p-5 text-left transition-all ${pkg === k ? "border-accent bg-stage text-on-stage shadow-[0_18px_40px_-20px_rgba(0,0,0,0.6)]" : "border-line bg-field hover:-translate-y-0.5 hover:border-muted"}`}
          >
            <span className="flex items-baseline justify-between gap-2">
              <span className="font-heading text-lg font-bold">{t[`pkg.${k}`]}</span>
              <span className={`font-heading text-2xl font-extrabold ${pkg === k ? "text-accent" : ""}`}>
                {k === "pro" && `${t.fromPrice} `}${PACKAGES[k]}
              </span>
            </span>
            <span className={`mt-2 block text-xs leading-relaxed ${pkg === k ? "text-on-stage/70" : "text-muted"}`}>{t[`pkgHint.${k}`]}</span>
          </button>
        ))}
      </div>
      {error && <p className="text-sm text-warn">{t.saveError}</p>}
      <button type="submit" disabled={!ready || busy} className="min-h-12 w-full rounded-xl bg-accent px-5 text-sm font-semibold text-on-accent disabled:opacity-40 sm:w-auto">
        {t.orderSend} — ${PACKAGES[pkg]}
      </button>
      <p className="text-xs text-muted">{t.buyDemo}</p>
    </form>
  );
}

function OrderList({ t, lang, orders, designer }: { t: Dict; lang: Lang; orders: Order[]; designer: boolean }) {
  return (
    <ul className="divide-y divide-line rounded-2xl border border-line bg-card">
      {orders.map((o) => (
        <li key={o.id}>
          <Link href={`/brand/${o.id}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 p-4 hover:bg-field">
            <span className="min-w-0 flex-1 basis-48">
              <span className="block font-semibold">{o.brand}</span>
              <span className="block text-xs text-muted">
                {t[`need.${o.need}`]} · {o.qty} · {t[`pkg.${o.pkg}`]}
                {designer && ` · ${personName(o.client, lang)}`} · {fmtDateTime(o.createdAt, lang)}
              </span>
            </span>
            <StatusChip t={t} status={o.status} />
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function BrandPage() {
  const { lang, t } = useLang((t) => `${t.brandTitle} — ${t.appName}`);
  const { ready, me } = useMe();
  const designer = isDesigner(me);
  const [orders, setOrders] = useState<{ me: string; list: Order[] } | null>(null);
  useEffect(() => {
    if (!me) return;
    let live = true;
    api.orders().then((list) => live && setOrders({ me, list }), () => {});
    return () => {
      live = false;
    };
  }, [me]);
  const list = orders?.me === me ? orders.list : null;

  return (
    <Shell t={t} lang={lang}>
      <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">{t.brandKicker}</p>
      <h1 className="mt-2 max-w-4xl font-heading text-4xl font-extrabold tracking-tight text-balance [hyphens:manual] sm:text-6xl">{designer ? t.ordersTitle : t.brandTitle}</h1>
      {!designer && <p className="mt-3 max-w-2xl text-muted">{t.brandHint}</p>}
      {!designer && <BrandHero t={t} />}
      {designer && (
        <Link href="/brand/auth" className="mt-5 flex max-w-2xl items-center gap-3 rounded-2xl border border-line bg-card p-4 hover:border-muted">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-ok-soft text-ok">✓</span>
          <span className="min-w-0">
            <span className="block font-semibold">{t.authTitle}</span>
            <span className="block text-xs text-muted">{t.authTeaser}</span>
          </span>
          <span className="ml-auto text-muted">→</span>
        </Link>
      )}
      <div id="order" className="mt-8 scroll-mt-6 space-y-6">
        {list && list.length > 0 && (
          <section>
            {!designer && <h2 className="mb-3 font-heading text-xl font-bold">{t.myOrders}</h2>}
            <OrderList t={t} lang={lang} orders={list} designer={designer} />
          </section>
        )}
        {designer && list && !list.length && <Notice>{t.noOrders}</Notice>}
        {!ready ? null : !me ? (
          <div className="rounded-2xl border border-line bg-card p-6 text-center">
            <Link href="/login?next=/brand" className="inline-grid min-h-11 place-items-center rounded-xl bg-accent px-5 text-sm font-semibold text-on-accent">
              {t.loginToOrder}
            </Link>
          </div>
        ) : (
          !designer && <OrderForm t={t} />
        )}
      </div>
    </Shell>
  );
}
