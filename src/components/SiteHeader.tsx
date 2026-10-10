"use client";
// Шапка всех страниц: знак, разделы, язык, кем вошли. На телефоне разделы и вход — в нижних вкладках (TabBar).
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LANGS, type Dict, type Lang } from "@/lib/i18n";
import { saveLang } from "@/lib/lang";
import { useMe } from "@/lib/me";
import { AccountMenu } from "./AccountMenu";
import { Bell } from "./Bell";
import { TabBar } from "./TabBar";
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
    { href: "/create", label: t.navGenerator, on: path === "/create" },
    { href: "/market", label: t.navMarket, on: path.startsWith("/market") },
    { href: "/scan", label: t.navScan, on: path === "/scan" },
    { href: "/codes", label: t.navCodes, on: path.startsWith("/codes") },
    ...(admin ? [{ href: "/admin", label: t.navAdmin, on: path.startsWith("/admin") }] : []),
  ];
  return (
    <>
      {ready && demo && (
        // Пока сайт — демо (DEMO_LOGIN не выключен): честно говорим, что покупки ненастоящие.
        <p className="mx-[calc(50%-50vw)] bg-stage px-4 py-2 text-center text-xs font-medium text-on-stage print:hidden">
          <span className="mr-2 rounded-sm bg-accent px-1.5 py-0.5 font-mono text-[11px] font-bold uppercase text-on-accent">Demo</span>
          {t.demoBanner}
        </p>
      )}
      <header className="flex flex-wrap items-center gap-x-3 gap-y-2 py-4 print:hidden">
        <Link href="/" className="flex min-h-11 min-w-11 items-center gap-2.5" aria-label={t.appName}>
          <Logo />
          {/* Самые узкие экраны (меньше 360px) — только знак, иначе шапка не помещается в строку. */}
          <span className="font-heading text-base font-extrabold max-[359px]:hidden sm:text-lg">{t.appName}</span>
        </Link>
        {/* На телефоне разделы — в нижних вкладках. */}
        <nav className="hidden gap-1 sm:flex">
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
          {ready && admin && (
            // На телефоне — значок щита: слово «Админ» не помещается в шапку рядом с языком и колокольчиком.
            <Link href="/admin" aria-label={t.navAdmin} className="grid h-11 w-11 place-items-center rounded-xl text-muted hover:text-ink sm:hidden">
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M12 3 5 6v5c0 4.4 3 8.3 7 10 4-1.7 7-5.6 7-10V6z" />
                <path d="m9 12 2 2 4-4" />
              </svg>
            </Link>
          )}
          {/* Языков семь — выпадающий список; на телефоне кнопка короче: «RU». */}
          <Select compact className="w-[4.5rem] sm:hidden" label="Language" value={lang} shown={lang.toUpperCase()} onChange={(v) => saveLang(v)} options={LANGS.map((l) => ({ id: l.id, label: l.name }))} />
          <Select compact className="hidden w-32 sm:block" label="Language" value={lang} onChange={(v) => saveLang(v)} options={LANGS.map((l) => ({ id: l.id, label: l.name }))} />
          {ready && me && <Bell t={t} lang={lang} />}
          {ready &&
            (me ? (
              <div className="hidden sm:block">
                <AccountMenu t={t} lang={lang} me={me} />
              </div>
            ) : (
              <Link
                // После входа — туда же; главная после входа — своя страница с моими кодами.
                href={`/login?next=${encodeURIComponent(path)}`}
                className="hidden min-h-10 place-items-center rounded-xl bg-accent px-3 text-sm font-semibold text-on-accent sm:grid"
              >
                {t.login}
              </Link>
            ))}
        </div>
      </header>
      <TabBar t={t} lang={lang} />
    </>
  );
}
