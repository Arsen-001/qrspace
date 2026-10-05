"use client";
// Дизайн из маркета: примерка со своей ссылкой (с проверкой чтения), цена, тираж, покупка (демо-оплата).
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/codes";
import { useLang } from "@/lib/lang";
import { designById } from "@/lib/market";
import { useMe } from "@/lib/me";
import { checkScan } from "@/lib/qr/raster";
import { toSvg, type Drawing } from "@/lib/qr/render";
import { DEFAULT_STYLE, fromSaved, toSaved } from "@/lib/qr/style";
import { useDrawing } from "./CodeDesigner";
import { EditionNote, sampleLink, useSold } from "./MarketPage";
import { useInBrowser } from "./QrThumb";
import { Notice, Shell } from "./Shell";

export function DesignPage({ id }: { id: string }) {
  const d = designById(id);
  const { lang, t } = useLang((t) => `${t.marketTitle} — ${t.appName}`);
  const { ready, me, base } = useMe();
  const router = useRouter();
  const sold = useSold();
  const [text, setText] = useState("");
  const [state, setState] = useState<"idle" | "buying" | "error" | "soldout">("idle");

  const style = useMemo(() => fromSaved(d?.style ?? toSaved(DEFAULT_STYLE)), [d]);
  const payload = useInBrowser() ? text.trim() || sampleLink(base) : "";
  const { drawing } = useDrawing(payload, style);
  const svg = useMemo(() => (drawing ? toSvg(drawing, 480) : ""), [drawing]);

  const [checked, setChecked] = useState<{ drawing: Drawing; ok: boolean } | null>(null);
  useEffect(() => {
    if (!drawing) return;
    let live = true;
    const tm = setTimeout(() => {
      checkScan(drawing, payload).then(
        (ok) => live && setChecked({ drawing, ok }),
        () => live && setChecked({ drawing, ok: false }),
      );
    }, 300);
    return () => {
      live = false;
      clearTimeout(tm);
    };
  }, [drawing, payload]);
  const scan = !drawing ? null : checked?.drawing !== drawing ? "checking" : checked.ok ? "ok" : "bad";

  if (!d) {
    return (
      <Shell t={t} lang={lang}>
        <Notice>{t.notFound}</Notice>
      </Shell>
    );
  }

  const left = d.edition === null ? Infinity : sold ? d.edition - (sold[d.id] ?? 0) : null;
  const buy = async () => {
    setState("buying");
    try {
      const code = await api.buy(d.id);
      router.push(`/codes/${code.id}`);
    } catch (e) {
      setState((e as Error).message === "409" ? "soldout" : "error");
    }
  };

  return (
    <Shell t={t} lang={lang}>
      <Link href="/market" className="inline-flex min-h-10 items-center gap-1 text-sm font-medium text-muted hover:text-ink">
        ← {t.marketTitle}
      </Link>
      <div className="mt-2 grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start">
        <div className="min-w-0">
          <div className="mx-auto aspect-square w-full max-w-[480px] overflow-hidden rounded-2xl border border-line bg-white [&>svg]:h-full [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: svg }} />
          <p className="mt-3 text-center text-sm" aria-live="polite">
            {scan === "checking" && <span className="text-muted">{t.checking}</span>}
            {scan === "ok" && <span className="font-semibold text-ok">✓ {t.scanOk}</span>}
            {scan === "bad" && <span className="font-semibold text-warn">! {t.scanBad}</span>}
          </p>
        </div>
        <div className="space-y-5">
          <div>
            {d.drop && <span className="mb-2 inline-block rounded-full bg-accent px-3 py-1 text-xs font-semibold text-on-accent">{t.dropOfDay}</span>}
            <h1 className="font-heading text-3xl font-extrabold tracking-tight">{d.name[lang]}</h1>
            <p className="mt-1 text-sm text-muted">{t.byDesigner}</p>
            <p className="mt-3">{d.about[lang]}</p>
          </div>
          <div className="rounded-2xl border border-line bg-card p-5">
            <div className="flex items-baseline justify-between gap-3">
              <span className="font-heading text-3xl font-extrabold">${d.price}</span>
              <EditionNote t={t} d={d} sold={sold ? (sold[d.id] ?? 0) : undefined} className="text-sm" />
            </div>
            {d.edition !== null && <p className="mt-1 text-xs text-muted">{t.editionOf}: {d.edition}</p>}
            <div className="mt-4">
              {!ready ? null : !me ? (
                <Link href={`/login?next=/market/${d.id}`} className="grid min-h-12 place-items-center rounded-xl bg-accent px-5 text-sm font-semibold text-on-accent">
                  {t.loginToBuy}
                </Link>
              ) : (
                <button
                  type="button"
                  disabled={state === "buying" || left === null || left <= 0 || state === "soldout"}
                  onClick={buy}
                  className="min-h-12 w-full rounded-xl bg-accent px-5 text-sm font-semibold text-on-accent disabled:opacity-40"
                >
                  {left !== null && left <= 0 ? t.soldOut : state === "buying" ? t.buying : `${t.buy} — $${d.price}`}
                </button>
              )}
              {state === "error" && <p className="mt-2 text-sm text-warn">{t.buyError}</p>}
              {state === "soldout" && <p className="mt-2 text-sm text-warn">{t.soldOutError}</p>}
              <p className="mt-3 text-xs text-muted">{t.buyDemo}</p>
            </div>
          </div>
          <div className="rounded-2xl border border-line bg-card p-5">
            <label htmlFor="try-link" className="block font-heading font-bold">
              {t.tryLink}
            </label>
            <p className="mt-1 text-xs text-muted">{t.tryLinkHint}</p>
            <input
              id="try-link"
              value={text}
              maxLength={300}
              placeholder={t.tryLinkPlaceholder}
              onChange={(e) => setText(e.target.value)}
              className="mt-3 w-full rounded-xl border border-line bg-field px-3.5 py-2.5 text-base outline-none focus:border-accent"
              autoComplete="off"
              spellCheck={false}
            />
          </div>
        </div>
      </div>
    </Shell>
  );
}
