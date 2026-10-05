"use client";
// Шапка всех страниц: знак, разделы, язык, кем вошли.
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LANGS, type Dict, type Lang } from "@/lib/i18n";
import { saveLang } from "@/lib/lang";
import { useMe } from "@/lib/me";
import { Avatar, personName } from "./Avatar";

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
  const { ready, me } = useMe();
  const nav = [
    { href: "/", label: t.navGenerator, on: path === "/" },
    { href: "/market", label: t.navMarket, on: path.startsWith("/market") },
    { href: "/codes", label: t.navCodes, on: path.startsWith("/codes") },
    { href: "/brand", label: t.navBrand, on: path.startsWith("/brand") },
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
        <div className="flex rounded-xl border border-line bg-card p-1" role="radiogroup" aria-label="Language">
          {LANGS.map((l) => (
            <button
              key={l.id}
              type="button"
              role="radio"
              aria-checked={lang === l.id}
              onClick={() => saveLang(l.id)}
              className={`min-h-8 rounded-lg px-2 text-sm font-medium ${lang === l.id ? "bg-accent text-on-accent" : "text-muted hover:text-ink"}`}
            >
              {l.label}
            </button>
          ))}
        </div>
        {ready &&
          (me ? (
            <Link href={`/login?next=${encodeURIComponent(path)}`} title={`${personName(me, lang)} · ${t.switchPerson}`} className="rounded-full">
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
