"use client";
// Заказ под бренд: этапы, детали, переписка; дизайнер собирает и отправляет дизайн, клиент создаёт по нему коды.
import Link from "next/link";
import { useEffect, useState } from "react";
import { api, type CodeView } from "@/lib/codes";
import { fmtDate, fmtDateTime } from "@/lib/format";
import type { Dict, Lang } from "@/lib/i18n";
import { useLang } from "@/lib/lang";
import { useMe } from "@/lib/me";
import { STATUSES, type Order, type OrderStatus } from "@/lib/orders";
import { isDesigner } from "@/lib/people";
import { checkScan } from "@/lib/qr/raster";
import { buildDrawing } from "@/lib/qr/render";
import { DEFAULT_STYLE, toQrStyle, toSaved } from "@/lib/qr/style";
import { Avatar, personName } from "./Avatar";
import { StatusChip } from "./BrandPage";
import { CodeDesigner } from "./CodeDesigner";
import { sampleLink } from "./MarketPage";
import { QrThumb } from "./QrThumb";
import { Notice, Shell } from "./Shell";
import type { StyleState } from "./StylePanel";

const field = "w-full rounded-xl border border-line bg-field px-3.5 py-2.5 text-base outline-none transition-colors focus:border-accent";

function Steps({ t, status }: { t: Dict; status: OrderStatus }) {
  const at = STATUSES.indexOf(status);
  return (
    <ol className="grid grid-cols-4 gap-1.5">
      {STATUSES.map((s, i) => (
        <li key={s} className="min-w-0">
          <div className={`h-1.5 rounded-full ${i <= at ? "bg-accent" : "bg-line"}`} />
          <div className={`mt-1.5 truncate text-xs ${i === at ? "font-semibold" : "text-muted"}`}>{t[`status.${s}`]}</div>
        </li>
      ))}
    </ol>
  );
}

function Thread({ t, lang, me, order, onChange }: { t: Dict; lang: Lang; me: string; order: Order; onChange: (o: Order) => void }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <section className="rounded-2xl border border-line bg-card p-5">
      <h2 className="font-heading text-lg font-bold">{t.threadTitle}</h2>
      {order.thread.length === 0 ? (
        <p className="mt-2 text-sm text-muted">{t.threadEmpty}</p>
      ) : (
        <ul className="mt-3 space-y-3">
          {order.thread.map((m) => (
            <li key={m.id} className={`flex gap-2.5 ${m.from === me ? "flex-row-reverse" : ""}`}>
              <Avatar id={m.from} lang={lang} size={28} />
              <div className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 ${m.from === me ? "bg-accent text-on-accent" : "bg-field"}`}>
                <p className="whitespace-pre-wrap break-words text-sm">{m.text}</p>
                <p className={`mt-1 text-[11px] ${m.from === me ? "opacity-80" : "text-muted"}`}>
                  {m.from === me ? t.you : personName(m.from, lang)} · {fmtDateTime(m.at, lang)}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
      <form
        className="mt-4 flex gap-2"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!text.trim()) return;
          setBusy(true);
          try {
            onChange(await api.orderMessage(order.id, text));
            setText("");
          } finally {
            setBusy(false);
          }
        }}
      >
        <input value={text} maxLength={2000} placeholder={t.threadPlaceholder} aria-label={t.threadPlaceholder} onChange={(e) => setText(e.target.value)} className={`${field} min-w-0 flex-1`} />
        <button type="submit" disabled={busy || !text.trim()} className="min-h-11 rounded-xl bg-accent px-4 text-sm font-semibold text-on-accent disabled:opacity-40">
          {t.send}
        </button>
      </form>
    </section>
  );
}

/** Дизайнер собирает код тем же конструктором; перед отправкой — проверка чтения. */
function DesignerTools({ t, order, base, onChange }: { t: Dict; order: Order; base: string; onChange: (o: Order) => void }) {
  const [style, setStyle] = useState<StyleState>(() => ({ ...DEFAULT_STYLE, logo: order.logo ? { src: order.logo, scale: 0.22 } : null }));
  const [note, setNote] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "bad" | "sent">("idle");
  const link = sampleLink(base);
  const send = async () => {
    setState("busy");
    if (!(await checkScan(buildDrawing(link, toQrStyle(style)), link))) return setState("bad");
    onChange(await api.patchOrder(order.id, { design: { style: toSaved(style), note } }));
    setState("sent");
  };
  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-line bg-card p-4">
        <span className="text-sm font-semibold">{t.orderStatus}:</span>
        <select value={order.status} onChange={async (e) => onChange(await api.patchOrder(order.id, { status: e.target.value as OrderStatus }))} className="min-h-10 rounded-xl border border-line bg-field px-3 text-sm">
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {t[`status.${s}`]}
            </option>
          ))}
        </select>
      </div>
      <CodeDesigner
        t={t}
        payload={link}
        style={style}
        setStyle={setStyle}
        side={
          <section className="rounded-2xl border border-accent/40 bg-card p-5">
            <h2 className="font-heading text-base font-bold">{t.sendDesign}</h2>
            <textarea value={note} rows={2} maxLength={500} placeholder={t.designNote} aria-label={t.designNote} onChange={(e) => setNote(e.target.value)} className={`${field} mt-3 resize-y`} />
            {state === "bad" && <p className="mt-2 text-sm text-warn">{t.publishBad}</p>}
            {state === "sent" && <p className="mt-2 text-sm font-semibold text-ok">✓ {t.designSent}</p>}
            <button type="button" disabled={state === "busy"} onClick={send} className="mt-3 min-h-11 w-full rounded-xl bg-accent px-4 text-sm font-semibold text-on-accent disabled:opacity-40">
              {state === "busy" ? t.publishing : t.sendDesign}
            </button>
          </section>
        }
      />
    </section>
  );
}

function ClientDesign({ t, order, base, onChange }: { t: Dict; order: Order; base: string; onChange: (o: Order) => void }) {
  const [made, setMade] = useState<CodeView | null>(null);
  const [busy, setBusy] = useState(false);
  if (!order.design) return <Notice>{t.designWaiting}</Notice>;
  return (
    <section className="grid gap-5 rounded-2xl border border-line bg-card p-5 sm:grid-cols-[240px_minmax(0,1fr)] sm:items-start">
      <QrThumb link={sampleLink(base)} style={order.design.style} className="w-full max-w-[240px] border border-line" />
      <div className="min-w-0 space-y-3">
        <h2 className="font-heading text-xl font-bold">{t.designReady}</h2>
        {order.design.note && <p className="whitespace-pre-wrap">{order.design.note}</p>}
        <p className="text-sm text-muted">{t.designReadyHint}</p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                setMade(await api.claim(order.id));
                onChange(await api.order(order.id));
              } finally {
                setBusy(false);
              }
            }}
            className="min-h-11 rounded-xl bg-accent px-4 text-sm font-semibold text-on-accent disabled:opacity-50"
          >
            + {t.makeCode}
          </button>
          {order.status !== "done" && (
            <button type="button" onClick={async () => onChange(await api.patchOrder(order.id, { accept: true }))} className="min-h-11 rounded-xl border border-line bg-field px-4 text-sm font-semibold hover:border-muted">
              ✓ {t.acceptDesign}
            </button>
          )}
        </div>
        {made && (
          <p className="text-sm font-semibold text-ok">
            ✓ {made.title} ·{" "}
            <Link href={`/codes/${made.id}`} className="underline underline-offset-2">
              {t.editCode}
            </Link>
          </p>
        )}
        {order.codes > 0 && (
          <p className="text-xs text-muted">
            {t.codesMade}: {order.codes}
          </p>
        )}
      </div>
    </section>
  );
}

export function OrderPage({ id }: { id: string }) {
  const { lang, t } = useLang((t) => `${t.brandTitle} — ${t.appName}`);
  const { ready, me, base } = useMe();
  const [state, setState] = useState<{ me: string; order: Order | null } | null>(null);
  useEffect(() => {
    if (!me) return;
    let live = true;
    api.order(id).then(
      (order) => live && setState({ me, order }),
      () => live && setState({ me, order: null }),
    );
    return () => {
      live = false;
    };
  }, [id, me]);
  const loaded = state?.me === me ? state : null;
  const o = loaded?.order;
  const setOrder = (order: Order) => me && setState({ me, order });
  const designer = isDesigner(me);

  return (
    <Shell t={t} lang={lang}>
      <Link href="/brand" className="inline-flex min-h-10 items-center gap-1 text-sm font-medium text-muted hover:text-ink">
        ← {designer ? t.ordersTitle : t.brandTitle}
      </Link>
      {!ready ? null : !me ? (
        <div className="mt-4 rounded-2xl border border-line bg-card p-6 text-center">
          <Link href={`/login?next=/brand/${id}`} className="inline-grid min-h-11 place-items-center rounded-xl bg-accent px-5 text-sm font-semibold text-on-accent">
            {t.login}
          </Link>
        </div>
      ) : !loaded ? (
        <Notice>{t.loading}</Notice>
      ) : !o ? (
        <Notice>{t.notFound}</Notice>
      ) : (
        <div className="mt-2 space-y-5">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-heading text-3xl font-extrabold tracking-tight">{o.brand}</h1>
            <StatusChip t={t} status={o.status} />
          </div>
          <Steps t={t} status={o.status} />
          <section className="grid gap-4 rounded-2xl border border-line bg-card p-5 sm:grid-cols-[minmax(0,1fr)_auto]">
            <dl className="grid min-w-0 grid-cols-1 gap-x-4 text-sm sm:grid-cols-[minmax(0,12rem)_minmax(0,1fr)] sm:gap-y-1.5 [&>dd]:mb-2 sm:[&>dd]:mb-0 [&>dt]:text-xs sm:[&>dt]:text-sm">
              <dt className="text-muted">{t.brandNeed}</dt>
              <dd>{t[`need.${o.need}`]}</dd>
              <dt className="text-muted">{t.brandQty}</dt>
              <dd>{o.qty}</dd>
              <dt className="text-muted">{t.packageLabel}</dt>
              <dd>
                {t[`pkg.${o.pkg}`]}
              </dd>
              {o.deadline && (
                <>
                  <dt className="text-muted">{t.brandDeadline}</dt>
                  <dd>{fmtDate(o.deadline, lang)}</dd>
                </>
              )}
              <dt className="text-muted">{t.brandContact}</dt>
              <dd className="break-words">{o.contact}</dd>
              {designer && (
                <>
                  <dt className="text-muted">{t.ownerLabel}</dt>
                  <dd>{personName(o.client, lang)}</dd>
                </>
              )}
              {o.notes && (
                <>
                  <dt className="text-muted">{t.brandNotes}</dt>
                  <dd className="whitespace-pre-wrap break-words">{o.notes}</dd>
                </>
              )}
            </dl>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {o.logo && <img src={o.logo} alt={t.brandLogo} className="h-24 w-24 rounded-xl border border-line bg-white object-contain" />}
          </section>
          {designer ? <DesignerTools t={t} order={o} base={base} onChange={setOrder} /> : <ClientDesign t={t} order={o} base={base} onChange={setOrder} />}
          <Thread t={t} lang={lang} me={me} order={o} onChange={setOrder} />
        </div>
      )}
    </Shell>
  );
}
