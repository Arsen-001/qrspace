"use client";
// Каркас страниц кроме генератора: шапка и колонка нужной ширины.
import type { ReactNode } from "react";
import type { Dict, Lang } from "@/lib/i18n";
import { SiteFooter } from "./SiteFooter";
import { SiteHeader } from "./SiteHeader";

export function Shell({ t, lang, narrow, children }: { t: Dict; lang: Lang; narrow?: boolean; children: ReactNode }) {
  return (
    // Узкая колонка — только у содержимого: шапка всегда во всю ширину, иначе на компьютере она ломается на две строки.
    <div className="mx-auto w-full max-w-6xl px-4 pb-16 sm:px-6 print:max-w-none print:p-0">
      <SiteHeader t={t} lang={lang} />
      <main className={`pt-4 sm:pt-6 print:pt-0 ${narrow ? "mx-auto max-w-2xl" : ""}`}>{children}</main>
      <SiteFooter t={t} lang={lang} />
    </div>
  );
}

export function Notice({ children }: { children: ReactNode }) {
  return <p className="rounded-2xl border border-line bg-card p-6 text-center text-sm text-muted">{children}</p>;
}
