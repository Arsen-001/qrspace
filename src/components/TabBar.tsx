"use client";
// Нижние вкладки на телефоне (владелец 10.10.2026: «полностью сосредоточимся на мобильной версии каждого экрана»):
// разделы — под большим пальцем, как в приложении; строки меню в шапке на телефоне больше нет. Вошедшему: мои QR,
// сканер, «Создать» посередине, маркет, кабинет; гостю — главная вместо моих QR и «Войти» вместо кабинета.
// Нет на странице после скана (/c, /K, /cert — там только содержимое кода), на входе и пока открыта клавиатура.
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import type { Dict, Lang } from "@/lib/i18n";
import { useMe } from "@/lib/me";
import { Avatar } from "./Avatar";

const HIDDEN = ["/c/", "/K/", "/cert/", "/login", "/codes/print", "/app/"];
const FIELD = "input:not([type=checkbox]):not([type=radio]):not([type=range]):not([type=color]):not([type=file]):not([type=button]):not([type=submit]), textarea, [contenteditable=true]";

/** Поле ввода в фокусе — значит, на телефоне открыта клавиатура: полоса не должна ехать над ней. */
function useTyping() {
  const [typing, setTyping] = useState(false);
  useEffect(() => {
    const check = () => setTyping(document.activeElement instanceof HTMLElement && document.activeElement.matches(FIELD));
    const later = () => setTimeout(check, 0);
    addEventListener("focusin", check);
    addEventListener("focusout", later);
    return () => {
      removeEventListener("focusin", check);
      removeEventListener("focusout", later);
    };
  }, []);
  return typing;
}

export function TabBar({ t, lang }: { t: Dict; lang: Lang }) {
  const path = usePathname();
  const { ready, me } = useMe();
  const typing = useTyping();
  if (HIDDEN.some((p) => path.startsWith(p))) return null;
  const tabs: { href: string; label: string; on: boolean; icon: ReactNode; main?: boolean }[] = [
    me
      ? { href: "/", label: t.tabMyQr, on: path === "/" || path.startsWith("/codes"), icon: <IconCodes /> }
      : { href: "/", label: t.tabHome, on: path === "/", icon: <IconHome /> },
    { href: "/scan", label: t.navScan, on: path === "/scan" || path === "/verify", icon: <IconScan /> },
    { href: "/create", label: t.tabCreate, on: path === "/create", icon: <IconPlus />, main: true },
    { href: "/market", label: t.navMarket, on: path.startsWith("/market"), icon: <IconMarket /> },
    me
      ? { href: "/account", label: t.accountTitle, on: path.startsWith("/account") || path.startsWith("/admin"), icon: <Avatar id={me} lang={lang} size={24} /> }
      : { href: `/login?next=${encodeURIComponent(path)}`, label: t.login, on: false, icon: <IconPerson /> },
  ];
  return (
    <nav
      aria-label={t.tabNav}
      className={`x-tabbar fixed inset-x-0 bottom-0 z-40 px-3 pb-[max(10px,env(safe-area-inset-bottom))] transition-transform duration-200 sm:hidden print:hidden ${typing ? "translate-y-full" : ""}`}
    >
      <ul className="mx-auto grid h-16 max-w-md grid-cols-5 rounded-2xl border border-stage-line bg-stage/95 px-1 text-on-stage shadow-[0_12px_32px_-8px_rgba(0,0,0,0.45)] backdrop-blur-md">
        {tabs.map((x) => (
          <li key={x.label} className="min-w-0">
            <Link
              href={x.href}
              aria-current={x.on ? "page" : undefined}
              className={`flex h-full min-w-0 flex-col items-center justify-center gap-1 rounded-xl text-[11px] font-medium leading-none transition-colors ${
                x.on ? "text-accent" : "text-on-stage/65 active:text-on-stage"
              } ${!ready && x.href.startsWith("/login") ? "invisible" : ""}`}
            >
              {x.main ? (
                <span className={`grid h-8 w-11 place-items-center rounded-xl ${x.on ? "bg-accent text-on-accent ring-2 ring-accent/40 ring-offset-2 ring-offset-stage" : "bg-accent text-on-accent"}`}>{x.icon}</span>
              ) : (
                <span className={`grid h-7 place-items-center ${x.on && me && x.href === "/account" ? "rounded-full ring-2 ring-accent" : ""}`}>{x.icon}</span>
              )}
              <span className="max-w-full truncate px-0.5">{x.label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

const Svg = ({ children }: { children: ReactNode }) => (
  <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    {children}
  </svg>
);
const IconHome = () => (
  <Svg>
    <path d="M4 10.5 12 4l8 6.5V20h-5v-6H9v6H4z" />
  </Svg>
);
const IconCodes = () => (
  <Svg>
    <rect x="4" y="4" width="6" height="6" rx="1.2" />
    <rect x="14" y="4" width="6" height="6" rx="1.2" />
    <rect x="4" y="14" width="6" height="6" rx="1.2" />
    <path d="M14 14h2v2h-2zM18 18h2v2h-2zM18 14h2M14 18v2" />
  </Svg>
);
const IconScan = () => (
  <Svg>
    <path d="M4 8V5.5A1.5 1.5 0 0 1 5.5 4H8M16 4h2.5A1.5 1.5 0 0 1 20 5.5V8M20 16v2.5a1.5 1.5 0 0 1-1.5 1.5H16M8 20H5.5A1.5 1.5 0 0 1 4 18.5V16M4 12h16" />
  </Svg>
);
const IconPlus = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden>
    <path d="M12 5v14M5 12h14" />
  </svg>
);
const IconMarket = () => (
  <Svg>
    <path d="M5 9h14l-1 11H6zM9 9V7a3 3 0 0 1 6 0v2" />
  </Svg>
);
const IconPerson = () => (
  <Svg>
    <circle cx="12" cy="8.5" r="3.5" />
    <path d="M5 20c1.2-3.6 4-5.5 7-5.5s5.8 1.9 7 5.5" />
  </Svg>
);
