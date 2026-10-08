"use client";
// Лист наклеек: выбрать коды (или создать набор пустых меток), размер, сколько каждой — и напечатать на A4.
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { api, linkOf, type CodeView } from "@/lib/codes";
import type { Dict } from "@/lib/i18n";
import { useLang } from "@/lib/lang";
import { useMe } from "@/lib/me";
import { PRICES, tierOf } from "@/lib/pricing";
import { buildDrawing, toSvg } from "@/lib/qr/render";
import { DEFAULT_STYLE, fromSaved, toQrStyle, toSaved } from "@/lib/qr/style";
import { useInBrowser } from "./QrThumb";
import { Notice, Shell } from "./Shell";
import { Segmented, StepBadge, Select } from "./ui";

// A4 в миллиметрах; поля 10 мм, между наклейками 4 мм (место для ножниц).
const PAGE = { w: 210, h: 297, margin: 10, gap: 4 };
const SIZES = ["30", "40", "50", "70"] as const;
type Size = (typeof SIZES)[number];

function Sheets({ t, items, size, captions }: { t: Dict; items: { id: string; svg: string; title: string }[]; size: number; captions: boolean }) {
  const cellH = size + (captions ? 6 : 0);
  const cols = Math.floor((PAGE.w - 2 * PAGE.margin + PAGE.gap) / (size + PAGE.gap));
  const rows = Math.floor((PAGE.h - 2 * PAGE.margin + PAGE.gap) / (cellH + PAGE.gap));
  const per = cols * rows;
  const pages = Array.from({ length: Math.ceil(items.length / per) }, (_, i) => items.slice(i * per, (i + 1) * per));
  return (
    <div className="space-y-6 print:space-y-0">
      {pages.map((page, i) => (
        <div
          key={i}
          className="mx-auto overflow-hidden bg-white text-black shadow-lg ring-1 ring-line print:shadow-none print:ring-0"
          // Разрыв страницы — только между листами, иначе в конце печатается пустой лист.
          style={{ breakAfter: i < pages.length - 1 ? "page" : "auto", width: `${PAGE.w}mm`, height: `${PAGE.h}mm`, padding: `${PAGE.margin}mm`, display: "grid", gridTemplateColumns: `repeat(${cols}, ${size}mm)`, gridAutoRows: `${cellH}mm`, gap: `${PAGE.gap}mm`, alignContent: "start" }}
          aria-label={`${t.sheet} ${i + 1}`}
        >
          {page.map((it, j) => (
            <div key={j} className="flex flex-col items-center">
              <div style={{ width: `${size}mm`, height: `${size}mm` }} className="[&>svg]:h-full [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: it.svg }} />
              {captions && (
                <div className="w-full truncate text-center" style={{ fontSize: "2.6mm", lineHeight: "5mm" }}>
                  {it.title}
                </div>
              )}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

export function PrintPage() {
  const { lang, t } = useLang((t) => `${t.printTitle} — ${t.appName}`);
  const { ready, me, base } = useMe();
  const browser = useInBrowser();
  const [codes, setCodes] = useState<{ me: string; list: CodeView[] } | null>(null);
  const [picked, setPicked] = useState<Set<string> | null>(null);
  const [size, setSize] = useState<Size>("40");
  const [copies, setCopies] = useState(1);
  const [captions, setCaptions] = useState(true);
  const [count, setCount] = useState(10);
  const [busy, setBusy] = useState(false);
  const [bill, setBill] = useState<{ total: number; unpaid: { id: string; tier: "simple" | "styled" }[] } | null>(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    if (!me) return;
    let live = true;
    api.list().then((l) => live && setCodes({ me, list: l.mine }), () => {});
    return () => {
      live = false;
    };
  }, [me, reload]);
  const list = codes?.me === me ? codes.list : null;
  const chosen = useMemo(() => (list ? list.filter((c) => (picked ? picked.has(c.id) : true)) : []), [list, picked]);

  const items = useMemo(() => {
    if (!browser) return [];
    const one = chosen.map((c) => ({ id: c.id, title: c.title ?? "", svg: toSvg(buildDrawing(linkOf(base, c), toQrStyle(c.style ? fromSaved(c.style) : DEFAULT_STYLE)), 400) }));
    return one.flatMap((it) => Array.from({ length: copies }, () => it));
  }, [browser, chosen, base, copies]);

  const toggle = (id: string) => {
    const next = new Set(picked ?? list?.map((c) => c.id));
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setPicked(next);
  };

  // Печать = скачивание: неоплаченные коды сначала оплачиваем (демо), как в генераторе.
  const print = async () => {
    setBusy(true);
    try {
      const quotes = await Promise.all(chosen.map(async (c) => ({ c, tier: tierOf(c.style ? fromSaved(c.style) : DEFAULT_STYLE), q: await api.quote(`code:${c.id}`, tierOf(c.style ? fromSaved(c.style) : DEFAULT_STYLE)) })));
      const unpaid = quotes.filter((x) => !x.q.paid);
      if (!unpaid.length) return window.print();
      // Каждую цену сервер считает отдельно — «первый бесплатный» достаётся только одному коду из листа.
      let freeTaken = false;
      const total = unpaid.reduce((sum, x) => {
        if (x.q.free && !freeTaken) {
          freeTaken = true;
          return sum;
        }
        return sum + (x.q.free ? PRICES[x.tier] : x.q.price);
      }, 0);
      setBill({ total, unpaid: unpaid.map((x) => ({ id: x.c.id, tier: x.tier })) });
    } finally {
      setBusy(false);
    }
  };
  const payAndPrint = async () => {
    if (!bill) return;
    setBusy(true);
    try {
      // По одному: первый простой — бесплатный, остальные — по цене.
      for (const u of bill.unpaid) await api.pay(`code:${u.id}`, u.tier);
      setBill(null);
      window.print();
    } finally {
      setBusy(false);
    }
  };
  const makeSet = async () => {
    setBusy(true);
    try {
      const made = await api.batch(count, t.labelPrefix, toSaved(DEFAULT_STYLE));
      setPicked(new Set(made.map((c) => c.id)));
      setReload((n) => n + 1);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Shell t={t} lang={lang}>
      <div className="print:hidden">
        <Link href="/codes" className="inline-flex min-h-10 items-center gap-1 text-sm font-medium text-muted hover:text-ink">
          ← {t.backToCodes}
        </Link>
        <h1 className="mt-1 font-heading text-3xl font-extrabold tracking-tight">{t.printTitle}</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">{t.printHint}</p>
      </div>
      {!ready ? null : !me ? (
        <div className="mt-6 rounded-2xl border border-line bg-card p-6 text-center print:hidden">
          <Link href="/login?next=/codes/print" className="inline-grid min-h-11 place-items-center rounded-xl bg-accent px-5 text-sm font-semibold text-on-accent">
            {t.login}
          </Link>
        </div>
      ) : !list ? (
        <div className="mt-6 print:hidden">
          <Notice>{t.loading}</Notice>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[340px_minmax(0,1fr)] lg:items-start print:m-0 print:block">
          <div className="flex flex-col gap-5 print:hidden">
            {/* Набор пустых меток — дополнительная возможность: внизу, после главных шагов. */}
            <section className="order-last rounded-2xl border-2 border-dashed border-line p-5">
              <h2 className="font-heading font-bold">{t.newSet}</h2>
              <p className="mt-1 text-xs text-muted">{t.newSetHint}</p>
              <div className="mt-3 flex gap-2">
                <Select className="w-24" label={t.newSet} value={String(count)} onChange={(v) => setCount(Number(v))} options={["10", "30", "100"].map((n) => ({ id: n, label: n }))} />
                <button type="button" disabled={busy} onClick={makeSet} className="min-h-11 flex-1 rounded-xl border border-line bg-field px-4 text-sm font-semibold hover:border-muted disabled:opacity-50">
                  + {t.makeSet}
                </button>
              </div>
            </section>
            <section className="rounded-2xl border border-line bg-card p-5">
              <h2 className="flex items-center gap-3 font-heading font-bold">
                <StepBadge n={1} />
                {t.whichCodes}
              </h2>
              <ul className="mt-2 max-h-72 space-y-1 overflow-y-auto">
                {list.map((c) => (
                  <li key={c.id}>
                    <label className="flex min-h-10 cursor-pointer items-center gap-2.5 text-sm">
                      <input type="checkbox" checked={picked ? picked.has(c.id) : true} onChange={() => toggle(c.id)} className="h-4 w-4 accent-[var(--accent)]" />
                      <span className="min-w-0 truncate">{c.title}</span>
                    </label>
                  </li>
                ))}
              </ul>
            </section>
            <section className="space-y-4 rounded-2xl border border-line bg-card p-5">
              <h2 className="flex items-center gap-3 font-heading font-bold">
                <StepBadge n={2} />
                {t.printStep2}
              </h2>
              <div>
                <div className="mb-1.5 text-sm font-semibold">{t.stickerSize}</div>
                <Segmented<Size> value={size} onChange={setSize} options={SIZES.map((s) => ({ id: s, label: `${Number(s) / 10} ${t.cm}` }))} />
              </div>
              <label className="block">
                <span className="mb-1.5 block text-sm font-semibold">{t.copies}</span>
                <input type="number" min={1} max={20} value={copies} onChange={(e) => setCopies(Math.max(1, Math.min(20, Number(e.target.value) || 1)))} className="min-h-11 w-24 rounded-xl border border-line bg-field px-3 text-base" />
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input type="checkbox" checked={captions} onChange={(e) => setCaptions(e.target.checked)} className="h-4 w-4 accent-[var(--accent)]" />
                {t.captions}
              </label>
              <p className="text-xs text-muted">
                {t.stickersTotal}: {items.length}
              </p>
              {bill ? (
                <div className="rounded-xl border border-accent/40 bg-field p-4">
                  <p className="text-sm font-semibold">
                    {t.payTitle}: ${bill.total}
                  </p>
                  <p className="mt-1 text-xs text-muted">{t.buyDemo}</p>
                  <div className="mt-3 flex gap-2">
                    <button type="button" disabled={busy} onClick={payAndPrint} className="min-h-11 flex-1 rounded-xl bg-accent px-4 text-sm font-semibold text-on-accent disabled:opacity-50">
                      {t.payAndPrint}
                    </button>
                    <button type="button" onClick={() => setBill(null)} className="min-h-11 rounded-xl px-3 text-sm font-medium text-muted hover:text-ink">
                      {t.cancel}
                    </button>
                  </div>
                </div>
              ) : (
                <button type="button" disabled={busy || !items.length} onClick={print} className="min-h-12 w-full rounded-xl bg-accent px-4 text-sm font-semibold text-on-accent disabled:opacity-40">
                  🖨 {t.print}
                </button>
              )}
              <p className="text-xs text-muted">{t.printTip}</p>
            </section>
          </div>
          <div className="min-w-0 overflow-x-auto print:overflow-visible">
            {items.length ? <Sheets t={t} items={items} size={Number(size)} captions={captions} /> : <Notice>{t.nothingToPrint}</Notice>}
          </div>
        </div>
      )}
    </Shell>
  );
}
