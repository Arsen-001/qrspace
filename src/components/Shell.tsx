"use client";
// Каркас страниц кроме генератора: шапка и колонка нужной ширины.
import type { ReactNode } from "react";
import type { Dict, Lang } from "@/lib/i18n";
import { SiteHeader } from "./SiteHeader";

export function Shell({ t, lang, narrow, children }: { t: Dict; lang: Lang; narrow?: boolean; children: ReactNode }) {
  return (
    <div className={`mx-auto w-full px-4 pb-16 sm:px-6 ${narrow ? "max-w-2xl" : "max-w-6xl"}`}>
      <SiteHeader t={t} lang={lang} />
      <main className="pt-4 sm:pt-6">{children}</main>
      <p className="mt-12 text-center text-xs text-muted">{t.trademark}</p>
    </div>
  );
}

export function Notice({ children }: { children: ReactNode }) {
  return <p className="rounded-2xl border border-line bg-card p-6 text-center text-sm text-muted">{children}</p>;
}
