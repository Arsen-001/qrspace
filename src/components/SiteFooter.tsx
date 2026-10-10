"use client";
// Подвал всех страниц: полезные ссылки, юридические страницы, товарный знак QR Code.
import Link from "next/link";
import type { Dict } from "@/lib/i18n";
import { legalFor } from "@/lib/legal";
import type { Lang } from "@/lib/i18n";

export function SiteFooter({ t, lang, lead }: { t: Dict; lang: Lang; lead?: string }) {
  // На телефоне у ссылок высота 44px — по ним легко попасть пальцем.
  const tap = "inline-flex min-h-11 items-center sm:min-h-0";
  const link = `${tap} font-semibold text-accent-ink`;
  return (
    <footer className="mt-12 space-y-3 text-center text-[13px] text-muted sm:text-xs print:hidden">
      {lead && <p className="text-sm">{lead}</p>}
      <p className="flex flex-wrap justify-center gap-x-4 sm:gap-y-1">
        <Link href="/how" className={link}>
          {t.howTitle}
        </Link>
        <Link href="/verify" className={link}>
          {t.verifyTitle}
        </Link>
      </p>
      <p className="flex flex-wrap justify-center gap-x-4 sm:gap-y-1">
        <Link href="/legal/terms" className={`${tap} hover:text-ink`}>
          {legalFor(lang).terms.title}
        </Link>
        <Link href="/legal/privacy" className={`${tap} hover:text-ink`}>
          {legalFor(lang).privacy.title}
        </Link>
        <Link href="/legal/refunds" className={`${tap} hover:text-ink`}>
          {legalFor(lang).refunds.title}
        </Link>
        <Link href="/legal/terms#contacts" className={`${tap} hover:text-ink`}>
          {t.legalContacts}
        </Link>
      </p>
      <p>{t.trademark}</p>
    </footer>
  );
}
