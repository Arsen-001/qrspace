"use client";
// Товары с моим кодом: выбрать код — все товары сразу показываются с ним; заказ с адресом, оплата — демо.
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { api, codeLink, type CodeView } from "@/lib/codes";
import { fmtDateTime } from "@/lib/format";
import type { Dict } from "@/lib/i18n";
import { useLang } from "@/lib/lang";
import { useMe } from "@/lib/me";
import { PRODUCT_IDS, PRODUCTS, priceOf, type ProductId, type ShopOrder } from "@/lib/shop";
import type { SavedStyle } from "@/lib/qr/style";
import { sampleLink } from "./MarketPage";
import { QrThumb } from "./QrThumb";
import { Notice, Shell } from "./Shell";
import { Segmented } from "./ui";

const field = "w-full rounded-xl border border-line bg-field px-3.5 py-2.5 text-base outline-none transition-colors focus:border-accent";

/** Как выглядит товар с этим кодом (рисунок, не фото). */
function Mockup({ product, variant, qr }: { product: ProductId; variant: string; qr: ReactNode }) {
  if (product === "stickers")
    return (
      <div className="relative grid aspect-square place-items-center bg-[#e9e6df]">
        <div className="absolute left-[18%] top-[16%] w-[46%] -rotate-6 rounded-xl bg-white p-2 shadow-md">{qr}</div>
        <div className="w-[52%] rotate-3 rounded-xl bg-white p-2 shadow-lg">{qr}</div>
      </div>
    );
  if (product === "keychain") {
    const dark = variant === "black";
    return (
      <div className="grid aspect-square place-items-center bg-[#dfe3ea]">
        <div className="relative w-[52%]">
          <div className="absolute -top-[22%] left-1/2 h-[30%] w-[30%] -translate-x-1/2 rounded-full border-[6px] border-[#9aa3b2]" />
          <div className={`relative rounded-2xl p-3 shadow-lg ${dark ? "bg-gradient-to-br from-[#2b2f38] to-[#0f1115]" : "bg-gradient-to-br from-[#f2f4f7] to-[#aab2c0]"}`}>
            <div className="mx-auto mb-2 h-3 w-3 rounded-full bg-[#dfe3ea] ring-2 ring-black/10" />
            <div className="rounded-lg bg-white p-1.5">{qr}</div>
          </div>
        </div>
      </div>
    );
  }
  if (product === "pettag")
    return (
      <div className="grid aspect-square place-items-center bg-[#f3eadb]">
        <div className={`grid place-items-center bg-gradient-to-br from-[#f6d47a] to-[#b8862d] shadow-lg ${variant === "bone" ? "aspect-[1.6] w-[66%] rounded-[40%]" : "aspect-square w-[52%] rounded-full"}`}>
          <div className="w-[52%] rounded-md bg-white p-1">{qr}</div>
        </div>
      </div>
    );
  return (
    <div className="grid aspect-square place-items-center bg-[#e8eef3]">
      <div className="relative w-[78%]">
        <svg viewBox="0 0 200 200" className="w-full drop-shadow-md" aria-hidden>
          <path d="M70 18c8 10 52 10 60 0l42 18 22 40-30 14-10-14v116H46V76L36 90 6 76l22-40z" fill="#fafafa" stroke="#d7dce2" strokeWidth="2" />
        </svg>
        <div className="absolute left-1/2 top-[34%] w-[26%] -translate-x-1/2">{qr}</div>
      </div>
    </div>
  );
}

function OrderForm({ t, product, code, onDone }: { t: Dict; product: ProductId; code: CodeView; onDone: (o: ShopOrder) => void }) {
  const variants = PRODUCTS[product].variants as readonly string[];
  const [variant, setVariant] = useState<string>(variants[product === "tshirt" ? 1 : 0]);
  const [qty, setQty] = useState(1);
  const [address, setAddress] = useState({ name: "", phone: "", city: "", street: "" });
  const [busy, setBusy] = useState(false);
  const ready = address.name.trim() && address.phone.trim() && address.city.trim() && address.street.trim();
  const set = (k: keyof typeof address) => (e: React.ChangeEvent<HTMLInputElement>) => setAddress((a) => ({ ...a, [k]: e.target.value }));
  return (
    <form
      className="space-y-3"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!ready) return;
        setBusy(true);
        try {
          onDone(await api.shopOrder({ product, variant, code: code.id, qty, address }));
        } finally {
          setBusy(false);
        }
      }}
    >
      <Segmented value={variant} onChange={setVariant} wrap options={variants.map((v) => ({ id: v, label: t[`variant.${product}.${v}` as keyof Dict] ?? v }))} />
      <label className="flex items-center gap-3 text-sm">
        <span className="font-medium text-muted">{t.qty}</span>
        <input type="number" min={1} max={50} value={qty} onChange={(e) => setQty(Math.max(1, Math.min(50, Number(e.target.value) || 1)))} className="min-h-11 w-20 rounded-xl border border-line bg-field px-3 text-base" />
      </label>
      <div className="grid gap-2 sm:grid-cols-2">
        <input value={address.name} onChange={set("name")} placeholder={t.addrName} aria-label={t.addrName} className={field} autoComplete="name" />
        <input value={address.phone} onChange={set("phone")} placeholder={t.addrPhone} aria-label={t.addrPhone} className={field} type="tel" autoComplete="tel" />
        <input value={address.city} onChange={set("city")} placeholder={t.addrCity} aria-label={t.addrCity} className={field} autoComplete="address-level2" />
        <input value={address.street} onChange={set("street")} placeholder={t.addrStreet} aria-label={t.addrStreet} className={field} autoComplete="street-address" />
      </div>
      <button type="submit" disabled={!ready || busy} className="min-h-12 w-full rounded-xl bg-accent px-5 text-sm font-semibold text-on-accent disabled:opacity-40">
        {t.payAndOrder} — ${priceOf(product, variant, qty)}
      </button>
      <p className="text-xs text-muted">{t.shopDemo}</p>
    </form>
  );
}

export function ShopPage() {
  const { lang, t } = useLang((t) => `${t.shopTitle} — ${t.appName}`);
  const { ready, me, base } = useMe();
  const [data, setData] = useState<{ me: string; codes: CodeView[]; orders: ShopOrder[] } | null>(null);
  const [codeId, setCodeId] = useState<string | null>(null);
  const [open, setOpen] = useState<ProductId | null>(null);
  const [done, setDone] = useState<ShopOrder | null>(null);

  useEffect(() => {
    if (!me) return;
    let live = true;
    Promise.all([api.list(), api.shopOrders()]).then(([l, orders]) => live && setData({ me, codes: l.mine, orders }), () => {});
    return () => {
      live = false;
    };
  }, [me]);
  const mine = data?.me === me ? data : null;
  const code = mine?.codes.find((c) => c.id === codeId) ?? mine?.codes[0] ?? null;
  const link = code ? codeLink(base, code.id) : sampleLink(base);
  const style: SavedStyle | null = code?.style ?? null;
  const qr = <QrThumb link={link} style={style} />;

  return (
    <Shell t={t} lang={lang}>
      <h1 className="font-heading text-3xl font-extrabold tracking-tight sm:text-4xl">{t.shopTitle}</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted">{t.shopHint}</p>
      {mine && mine.codes.length > 0 && (
        <label className="mt-5 flex max-w-md flex-col gap-1.5">
          <span className="text-sm font-semibold">{t.whichCode}</span>
          <select value={code?.id} onChange={(e) => setCodeId(e.target.value)} className="min-h-11 rounded-xl border border-line bg-card px-3 text-base">
            {mine.codes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
        </label>
      )}
      {done && (
        <p className="mt-5 rounded-2xl bg-ok-soft p-4 text-sm font-semibold text-ok">
          ✓ {t.shopOrdered} — {t[`product.${done.product}`]}, ${done.total}
        </p>
      )}
      <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {PRODUCT_IDS.map((p) => (
          <li key={p} className="overflow-hidden rounded-2xl border border-line bg-card">
            <Mockup product={p} variant={PRODUCTS[p].variants[0]} qr={qr} />
            <div className="p-4">
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-heading font-bold">{t[`product.${p}`]}</span>
                <span className="shrink-0 font-heading font-extrabold">
                  {PRODUCTS[p].prices && `${t.fromPrice} `}${PRODUCTS[p].price}
                </span>
              </div>
              <p className="mt-1 text-xs text-muted">{t[`productHint.${p}`]}</p>
              {open === p && code ? (
                <div className="mt-4">
                  <OrderForm
                    key={code.id}
                    t={t}
                    product={p}
                    code={code}
                    onDone={(o) => {
                      setDone(o);
                      setOpen(null);
                      if (mine && me) setData({ ...mine, orders: [o, ...mine.orders] });
                    }}
                  />
                </div>
              ) : !ready ? null : !me ? (
                <Link href="/login?next=/shop" className="mt-3 grid min-h-11 place-items-center rounded-xl border border-line bg-field px-4 text-sm font-semibold hover:border-muted">
                  {t.loginToOrder}
                </Link>
              ) : mine && !mine.codes.length ? (
                <Link href="/codes" className="mt-3 grid min-h-11 place-items-center rounded-xl border border-line bg-field px-4 text-sm font-semibold hover:border-muted">
                  {t.newCode}
                </Link>
              ) : (
                <button type="button" disabled={!code} onClick={() => setOpen(p)} className="mt-3 min-h-11 w-full rounded-xl bg-accent px-4 text-sm font-semibold text-on-accent disabled:opacity-40">
                  {t.orderThis}
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
      {mine && mine.orders.length > 0 && (
        <section className="mt-10">
          <h2 className="font-heading text-xl font-bold">{t.myShopOrders}</h2>
          <ul className="mt-3 divide-y divide-line rounded-2xl border border-line bg-card">
            {mine.orders.map((o) => (
              <li key={o.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 p-4 text-sm">
                <span className="min-w-0 flex-1 basis-48">
                  <span className="font-semibold">
                    {t[`product.${o.product}`]} · {t[`variant.${o.product}.${o.variant}` as keyof Dict] ?? o.variant} × {o.qty}
                  </span>
                  <span className="block text-xs text-muted">
                    {mine.codes.find((c) => c.id === o.code)?.title} · {o.address.city} · {fmtDateTime(o.createdAt, lang)}
                  </span>
                </span>
                <span className="font-semibold">${o.total}</span>
                <span className="rounded-full bg-ok-soft px-2.5 py-1 text-xs font-semibold text-ok">{t[`shopStatus.${o.status}`]}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
      {mine === null && me && <div className="mt-6"><Notice>{t.loading}</Notice></div>}
    </Shell>
  );
}
