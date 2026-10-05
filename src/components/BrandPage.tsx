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
import { personName } from "./Avatar";
import { Notice, Shell } from "./Shell";
import { UploadButton } from "./ui";

const field = "w-full rounded-xl border border-line bg-field px-3.5 py-2.5 text-base outline-none transition-colors focus:border-accent";

export function StatusChip({ t, status }: { t: Dict; status: OrderStatus }) {
  const cls = status === "done" ? "bg-ok-soft text-ok" : status === "review" ? "bg-accent text-on-accent" : status === "new" ? "bg-warn-soft text-warn" : "bg-field text-ink";
  return <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${cls}`}>{t[`status.${status}`]}</span>;
}

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
      className="space-y-4 rounded-2xl border border-line bg-card p-5 sm:p-6"
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
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-muted">{t.brandName}</span>
          <input value={brand} maxLength={60} onChange={(e) => setBrand(e.target.value)} className={field} />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-muted">{t.brandContact}</span>
          <input value={contact} maxLength={100} onChange={(e) => setContact(e.target.value)} className={field} autoComplete="email" />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-muted">{t.brandNeed}</span>
          <select value={need} onChange={(e) => setNeed(e.target.value as Need)} className={field}>
            {NEEDS.map((n) => (
              <option key={n} value={n}>
                {t[`need.${n}`]}
              </option>
            ))}
          </select>
        </label>
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
      <div role="radiogroup" aria-label={t.packageLabel} className="grid gap-2 sm:grid-cols-2">
        {(Object.keys(PACKAGES) as Pkg[]).map((k) => (
          <button
            key={k}
            type="button"
            role="radio"
            aria-checked={pkg === k}
            onClick={() => setPkg(k)}
            className={`rounded-xl border p-4 text-left transition-colors ${pkg === k ? "border-accent bg-accent text-on-accent" : "border-line bg-field hover:border-muted"}`}
          >
            <span className="flex items-baseline justify-between gap-2">
              <span className="font-heading font-bold">{t[`pkg.${k}`]}</span>
              <span className="font-heading font-extrabold">
                {k === "pro" && `${t.fromPrice} `}${PACKAGES[k]}
              </span>
            </span>
            <span className={`mt-1 block text-xs ${pkg === k ? "opacity-85" : "text-muted"}`}>{t[`pkgHint.${k}`]}</span>
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
      <h1 className="max-w-3xl font-heading text-3xl font-extrabold tracking-tight text-balance sm:text-4xl">{designer ? t.ordersTitle : t.brandTitle}</h1>
      {!designer && <p className="mt-2 max-w-2xl text-sm text-muted">{t.brandHint}</p>}
      <Link href="/brand/auth" className="mt-5 flex max-w-2xl items-center gap-3 rounded-2xl border border-line bg-card p-4 hover:border-muted">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-ok-soft text-ok">✓</span>
        <span className="min-w-0">
          <span className="block font-semibold">{t.authTitle}</span>
          <span className="block text-xs text-muted">{t.authTeaser}</span>
        </span>
        <span className="ml-auto text-muted">→</span>
      </Link>
      <div className="mt-6 space-y-6">
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
