"use client";
// Готовые логотипы для центра кода: нажал — логотип встал в центр (как загруженный файл).
// Бренды (около 70) подгружаются, когда браузер свободен, — открытие страницы не тормозит.
import { useEffect, useState } from "react";
import type { Dict } from "@/lib/i18n";
import { BASIC_LOGOS, LINKEDIN, LOGO_CATS, logoSvg, QUICK_LOGOS, type BrandLogo } from "@/lib/qr/logo-art";

let brands: Promise<BrandLogo[]> | null = null;
const loadBrands = () => (brands ??= import("@/lib/qr/logos").then((m) => [...m.BRAND_LOGOS, LINKEDIN]));

function useLogos(): BrandLogo[] {
  const [list, setList] = useState<BrandLogo[]>(BASIC_LOGOS);
  useEffect(() => {
    let live = true;
    const go = () => loadBrands().then((b) => live && setList([...BASIC_LOGOS, ...b]));
    const idle = typeof requestIdleCallback === "function" ? requestIdleCallback(go, { timeout: 2500 }) : window.setTimeout(go, 1200);
    return () => {
      live = false;
      if (typeof cancelIdleCallback === "function") cancelIdleCallback(idle);
      else clearTimeout(idle);
    };
  }, []);
  return list;
}

export const logoFile = (l: BrandLogo) => new File([logoSvg(l, 256)], `${l.id}.svg`, { type: "image/svg+xml" });

function Tile({ l, title, on, onPick }: { l: BrandLogo; title: string; on: boolean; onPick: () => void }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      aria-pressed={on}
      onClick={onPick}
      className={`grid h-12 w-12 shrink-0 place-items-center rounded-xl border-2 p-1 transition-transform hover:-translate-y-0.5 ${on ? "border-accent" : "border-transparent"}`}
    >
      <span aria-hidden className="block h-9 w-9 [&>svg]:h-full [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: logoSvg(l, 36) }} />
    </button>
  );
}

export function LogoPicker({
  t,
  mode,
  picked,
  suggest,
  onPick,
  onNone,
  onMore,
}: {
  t: Dict;
  /** quick — одна строка самых нужных в шаге 2; all — все по группам. */
  mode: "quick" | "all";
  picked: string | null;
  /** Логотип под вид содержимого (Instagram → Instagram) — первым. */
  suggest?: string;
  onPick: (l: BrandLogo) => void;
  onNone: () => void;
  onMore?: () => void;
}) {
  const list = useLogos();
  const title = (l: BrandLogo) => (l.cat === "basic" ? t[`logo.${l.id}` as keyof Dict] : l.title);
  const none = (
    <button
      type="button"
      aria-label={t.logoNone}
      title={t.logoNone}
      aria-pressed={!picked}
      onClick={onNone}
      className={`grid h-12 w-12 shrink-0 place-items-center rounded-xl border-2 ${!picked ? "border-accent" : "border-transparent"}`}
    >
      <span aria-hidden className="grid h-9 w-9 place-items-center rounded-lg border border-dashed border-line text-muted">
        ∅
      </span>
    </button>
  );

  if (mode === "quick") {
    const ids = [...new Set([suggest, picked, ...QUICK_LOGOS].filter((x): x is string => !!x))];
    const shown = ids.map((id) => list.find((l) => l.id === id)).filter((l): l is BrandLogo => !!l).slice(0, 9);
    return (
      <div className="x-noscrollbar -mx-1 flex items-center gap-1 overflow-x-auto px-1 pb-1">
        {none}
        {shown.map((l) => (
          <Tile key={l.id} l={l} title={title(l)} on={picked === l.id} onPick={() => onPick(l)} />
        ))}
        {onMore && (
          <button type="button" onClick={onMore} className="ml-1 min-h-10 shrink-0 rounded-xl border border-line bg-field px-3 text-sm font-semibold hover:border-muted">
            {t.logoAll} →
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {LOGO_CATS.map((cat) => {
        const items = list.filter((l) => l.cat === cat);
        if (!items.length) return null;
        return (
          <div key={cat}>
            <div className="mb-1.5 font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">{t[`logoCat.${cat}`]}</div>
            <div className="flex flex-wrap gap-1">
              {cat === "basic" && none}
              {items.map((l) => (
                <Tile key={l.id} l={l} title={title(l)} on={picked === l.id} onPick={() => onPick(l)} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
