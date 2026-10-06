"use client";
// Шапка всех страниц: знак, разделы, язык, кем вошли.
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LANGS, type Dict, type Lang } from "@/lib/i18n";
import { saveLang } from "@/lib/lang";
import { useMe } from "@/lib/me";
import { Avatar, personName } from "./Avatar";
import { Bell } from "./Bell";

export function Logo() {
  return (
    <svg viewBox="0 0 24 24" className="h-8 w-8 text-accent" aria-hidden>
      <rect x="2" y="2" width="8" height="8" rx="2" fill="none" stroke="currentColor" strokeWidth="2" />
      <rect x="14" y="2" width="8" height="8" rx="2" fill="none" stroke="currentColor" strokeWidth="2" />
      <rect x="2" y="14" width="8" height="8" rx="2" fill="none" stroke="currentColor" strokeWidth="2" />
      <circle cx="16" cy="16" r="1.6" fill="currentColor" />
      <circle cx="20.5" cy="16" r="1.6" fill="currentColor" />
      <circle cx="16" cy="20.5" r="1.6" fill="currentColor" />
      <circle cx="20.5" cy="20.5" r="1.6" fill="currentColor" />
    </svg>
  );
}

export function SiteHeader({ t, lang }: { t: Dict; lang: Lang }) {
  const path = usePathname();
  const { ready, me, admin } = useMe();
  const nav = [
    { href: "/", label: t.navGenerator, on: path === "/" },
    { href: "/market", label: t.navMarket, on: path.startsWith("/market") },
    { href: "/codes", label: t.navCodes, on: path.startsWith("/codes") },
    { href: "/shop", label: t.navShop, on: path.startsWith("/shop") },
    { href: "/brand", label: t.navBrand, on: path.startsWith("/brand") },
    ...(admin ? [{ href: "/admin", label: t.navAdmin, on: path.startsWith("/admin") }] : []),
  ];
  return (
    <header className="flex flex-wrap items-center gap-x-3 gap-y-2 py-4 print:hidden">
      <Link href="/" className="flex items-center gap-2.5" aria-label={t.appName}>
        <Logo />
        <span className="hidden font-heading text-lg font-extrabold sm:inline">{t.appName}</span>
      </Link>
      {/* На телефоне разделы — отдельной строкой с прокруткой, чтобы шапка не вылезала за экран. */}
      <nav className="order-last -mx-1 flex w-full gap-1 overflow-x-auto px-1 sm:order-none sm:mx-0 sm:w-auto sm:px-0">
        {nav.map((n) => (
          <Link
            key={n.href}
            href={n.href}
            aria-current={n.on ? "page" : undefined}
            className={`grid min-h-10 shrink-0 place-items-center rounded-xl px-3 text-sm font-medium ${n.on ? "bg-card text-ink shadow-sm" : "text-muted hover:text-ink"}`}
          >
            {n.label}
          </Link>
        ))}
      </nav>
      <div className="ml-auto flex items-center gap-2">
        {/* Языков семь — выпадающий список, чтобы шапка помещалась на телефоне. */}
        <label className="relative">
          <span className="sr-only">Language</span>
          <select
            value={lang}
            onChange={(e) => saveLang(e.target.value as Lang)}
            aria-label="Language"
            className="min-h-10 cursor-pointer appearance-none rounded-xl border border-line bg-card py-1 pl-3 pr-8 text-sm font-medium hover:border-muted"
          >
            {LANGS.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
          <svg viewBox="0 0 24 24" className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <path d="m6 9 6 6 6-6" />
          </svg>
        </label>
        {ready && me && <Bell t={t} lang={lang} />}
        {ready &&
          (me ? (
            <Link href="/profile" title={`${personName(me, lang)} · ${t.profileTitle}`} className="rounded-full">
              <Avatar id={me} lang={lang} size={36} />
            </Link>
          ) : (
            <Link href={`/login?next=${encodeURIComponent(path)}`} className="grid min-h-10 place-items-center rounded-xl bg-accent px-3 text-sm font-semibold text-on-accent">
              {t.login}
            </Link>
          ))}
      </div>
    </header>
  );
}
