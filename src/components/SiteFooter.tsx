"use client";
// Подвал всех страниц: полезные ссылки, юридические страницы, товарный знак QR Code.
import Link from "next/link";
import type { Dict } from "@/lib/i18n";
import { legalFor } from "@/lib/legal";
import type { Lang } from "@/lib/i18n";

export function SiteFooter({ t, lang, lead }: { t: Dict; lang: Lang; lead?: string }) {
  const link = "font-semibold text-accent-ink";
  return (
    <footer className="mt-12 space-y-3 text-center text-xs text-muted print:hidden">
      {lead && <p className="text-sm">{lead}</p>}
      <p className="flex flex-wrap justify-center gap-x-4 gap-y-1">
        <Link href="/how" className={link}>
          {t.howTitle}
        </Link>
        <Link href="/verify" className={link}>
          {t.verifyTitle}
        </Link>
      </p>
      <p className="flex flex-wrap justify-center gap-x-4 gap-y-1">
        <Link href="/legal/terms" className="hover:text-ink">
          {legalFor(lang).terms.title}
        </Link>
        <Link href="/legal/privacy" className="hover:text-ink">
          {legalFor(lang).privacy.title}
        </Link>
        <Link href="/legal/refunds" className="hover:text-ink">
          {legalFor(lang).refunds.title}
        </Link>
        <Link href="/legal/terms#contacts" className="hover:text-ink">
          {t.legalContacts}
        </Link>
      </p>
      <p>{t.trademark}</p>
    </footer>
  );
}
