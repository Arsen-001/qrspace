"use client";
// Шапка всех страниц: знак, разделы, язык, кем вошли.
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LANGS, type Dict, type Lang } from "@/lib/i18n";
import { saveLang } from "@/lib/lang";
import { useMe } from "@/lib/me";
import { Avatar, personName } from "./Avatar";
import { Bell } from "./Bell";
import { Select } from "./ui";

export function Logo() {
  // Тот же знак, что в иконке сайта: чёрная плитка, три «глаза» с лаймом и точки.
  const eyes = [
    [8, 8],
    [56, 8],
    [8, 56],
  ];
  const dots = [
    [60, 60],
    [78, 60],
    [60, 78],
    [78, 78],
  ];
  return (
    <svg viewBox="0 0 100 100" className="h-9 w-9 shrink-0 rounded-md border border-stage-line text-on-stage" aria-hidden>
      <rect width="100" height="100" className="fill-stage" />
      <g transform="translate(8 8) scale(0.84)">
        {eyes.map(([x, y]) => (
          <g key={`${x}${y}`}>
            <rect x={x + 3} y={y + 3} width="30" height="30" rx="5" fill="none" stroke="currentColor" strokeWidth="6" />
            <rect x={x + 12} y={y + 12} width="12" height="12" rx="2" className="fill-accent" />
          </g>
        ))}
        {dots.map(([x, y]) => (
          <rect key={`${x}${y}`} x={x} y={y} width="12" height="12" rx="2.5" className={x === 78 && y === 78 ? "fill-accent" : "fill-current"} />
        ))}
      </g>
    </svg>
  );
}

export function SiteHeader({ t, lang }: { t: Dict; lang: Lang }) {
  const path = usePathname();
  const { ready, me, admin, demo } = useMe();
  const nav = [
    { href: "/", label: t.navGenerator, on: path === "/" },
    { href: "/market", label: t.navMarket, on: path.startsWith("/market") },
    { href: "/codes", label: t.navCodes, on: path.startsWith("/codes") },
    { href: "/shop", label: t.navShop, on: path.startsWith("/shop") },
    { href: "/brand", label: t.navBrand, on: path.startsWith("/brand") },
    ...(admin ? [{ href: "/admin", label: t.navAdmin, on: path.startsWith("/admin") }] : []),
  ];
  return (
    <>
      {ready && demo && (
        // Пока сайт — демо (DEMO_LOGIN не выключен): честно говорим, что покупки ненастоящие.
        <p className="mx-[calc(50%-50vw)] bg-stage px-4 py-2 text-center text-xs font-medium text-on-stage print:hidden">
          <span className="mr-2 rounded-sm bg-accent px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase text-on-accent">Demo</span>
          {t.demoBanner}
        </p>
      )}
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
          <Select compact className="w-32" label="Language" value={lang} onChange={(v) => saveLang(v)} options={LANGS.map((l) => ({ id: l.id, label: l.name }))} />
          {ready && me && <Bell t={t} lang={lang} />}
          {ready &&
            (me ? (
              <Link href="/profile" title={`${personName(me, lang)} · ${t.profileTitle}`} className="rounded-full">
                <Avatar id={me} lang={lang} size={36} />
              </Link>
            ) : (
              <Link
                // С главной после входа — в профиль с моими кодами (иначе «вошёл — как будто ничего не поменялось»).
                href={`/login?next=${encodeURIComponent(path === "/" ? "/profile" : path)}`}
                className="grid min-h-10 place-items-center rounded-xl bg-accent px-3 text-sm font-semibold text-on-accent"
              >
                {t.login}
              </Link>
            ))}
        </div>
      </header>
    </>
  );
}
