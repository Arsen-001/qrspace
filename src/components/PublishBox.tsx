"use client";
// Панель дизайнера в генераторе: выложить код в этом оформлении в маркет (с проверкой чтения).
import Link from "next/link";
import { useState } from "react";
import { api } from "@/lib/codes";
import type { Dict } from "@/lib/i18n";
import { checkScan } from "@/lib/qr/raster";
import { buildDrawing } from "@/lib/qr/render";
import { toQrStyle, toSaved } from "@/lib/qr/style";
import { sampleLink } from "./MarketPage";
import type { StyleState } from "./StylePanel";
import { Segmented } from "./ui";

const field = "w-full rounded-xl border border-line bg-field px-3.5 py-2.5 text-base outline-none transition-colors focus:border-accent";

export function PublishBox({ t, style, base }: { t: Dict; style: StyleState; base: string }) {
  const [name, setName] = useState("");
  const [about, setAbout] = useState("");
  const [price, setPrice] = useState("5");
  const [limited, setLimited] = useState<"no" | "yes">("no");
  const [count, setCount] = useState("100");
  const [drop, setDrop] = useState(false);
  const [state, setState] = useState<"idle" | "busy" | "bad" | "error">("idle");
  const [done, setDone] = useState<string | null>(null);

  const ready = name.trim() && Number(price) >= 1 && (limited === "no" || Number(count) >= 1);
  const publish = async () => {
    setState("busy");
    try {
      // В маркете код будет с чужими ссылками — проверяем на ссылке-образце, как его увидит покупатель.
      const link = sampleLink(base);
      if (!(await checkScan(buildDrawing(link, toQrStyle(style)), link))) {
        setState("bad");
        return;
      }
      const d = await api.publish({ name, about, price: Number(price), edition: limited === "yes" ? Math.round(Number(count)) : null, drop, style: toSaved(style) });
      setDone(d.id);
      setState("idle");
      setName("");
      setAbout("");
    } catch {
      setState("error");
    }
  };

  return (
    <section className="rounded-2xl border border-accent/40 bg-card p-5">
      <h2 className="font-heading text-base font-bold">{t.publishTitle}</h2>
      <p className="mt-1 text-sm text-muted">{t.publishHint}</p>
      {done && (
        <p className="mt-3 rounded-xl bg-ok-soft p-3 text-sm font-semibold text-ok">
          ✓ {t.published} ·{" "}
          <Link href={`/market/${done}`} className="underline underline-offset-2">
            {t.openInMarket}
          </Link>
        </p>
      )}
      <form
        className="mt-4 space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (ready) publish();
        }}
      >
        <input value={name} maxLength={40} placeholder={t.designName} aria-label={t.designName} onChange={(e) => setName(e.target.value)} className={field} />
        <textarea value={about} rows={2} maxLength={300} placeholder={t.designAbout} aria-label={t.designAbout} onChange={(e) => setAbout(e.target.value)} className={`${field} resize-y`} />
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-muted">{t.priceLabel}</span>
          <input type="number" min={1} max={10000} inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value)} className={field} />
        </label>
        <Segmented<"no" | "yes">
          value={limited}
          onChange={setLimited}
          options={[
            { id: "no", label: t.noEdition },
            { id: "yes", label: t.editionLimited },
          ]}
        />
        {limited === "yes" && (
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-muted">{t.editionCount}</span>
            <input type="number" min={1} max={100000} inputMode="numeric" value={count} onChange={(e) => setCount(e.target.value)} className={field} />
          </label>
        )}
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input type="checkbox" checked={drop} onChange={(e) => setDrop(e.target.checked)} className="h-4 w-4 accent-[var(--accent)]" />
          {t.makeDrop}
        </label>
        {state === "bad" && <p className="text-sm text-warn">{t.publishBad}</p>}
        {state === "error" && <p className="text-sm text-warn">{t.saveError}</p>}
        <button type="submit" disabled={!ready || state === "busy"} className="min-h-11 w-full rounded-xl bg-accent px-4 text-sm font-semibold text-on-accent disabled:opacity-40">
          {state === "busy" ? t.publishing : t.publish}
        </button>
      </form>
    </section>
  );
}
