"use client";
// Каркас страниц кроме генератора: шапка и колонка нужной ширины.
import Link from "next/link";
import type { ReactNode } from "react";
import type { Dict, Lang } from "@/lib/i18n";
import { SiteHeader } from "./SiteHeader";

export function Shell({ t, lang, narrow, children }: { t: Dict; lang: Lang; narrow?: boolean; children: ReactNode }) {
  return (
    <div className={`mx-auto w-full px-4 pb-16 sm:px-6 print:max-w-none print:p-0 ${narrow ? "max-w-2xl" : "max-w-6xl"}`}>
      <SiteHeader t={t} lang={lang} />
      <main className="pt-4 sm:pt-6 print:pt-0">{children}</main>
      <footer className="mt-12 space-y-2 text-center text-xs text-muted print:hidden">
        <p className="flex justify-center gap-4">
          <Link href="/how" className="font-semibold text-accent">
            {t.howTitle}
          </Link>
          <Link href="/verify" className="font-semibold text-accent">
            {t.verifyTitle}
          </Link>
        </p>
        <p>{t.trademark}</p>
      </footer>
    </div>
  );
}

export function Notice({ children }: { children: ReactNode }) {
  return <p className="rounded-2xl border border-line bg-card p-6 text-center text-sm text-muted">{children}</p>;
}
