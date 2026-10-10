"use client";
// Меню под аватаркой (владелец 09.10.2026): разделы кабинета и выход — в одно нажатие с любой страницы.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { Dict, Lang } from "@/lib/i18n";
import { signIn } from "@/lib/me";
import { ACC_TABS } from "@/lib/account";
import { TabIcon, tabLabel } from "./AccountPage";
import { Avatar, personName } from "./Avatar";

export function AccountMenu({ t, lang, me }: { t: Dict; lang: Lang; me: string }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const router = useRouter();
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    const key = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("pointerdown", away);
      document.removeEventListener("keydown", key);
    };
  }, [open]);
  const name = personName(me, lang);
  return (
    <div ref={box} className="relative">
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-haspopup="menu" aria-label={`${name} · ${t.accMenu}`} className="block rounded-full">
        <Avatar id={me} lang={lang} size={36} />
      </button>
      {open && (
        <div role="menu" className="x-pop absolute right-0 top-12 z-40 w-64 overflow-hidden rounded-2xl border border-stage-line bg-stage p-2 text-on-stage shadow-2xl">
          <Link href="/account" role="menuitem" onClick={() => setOpen(false)} className="flex items-center gap-3 rounded-xl p-2.5 hover:bg-white/5">
            <Avatar id={me} lang={lang} size={40} />
            <span className="min-w-0">
              <span className="block truncate font-heading font-bold">{name}</span>
              <span className="block font-mono text-[11px] uppercase tracking-[0.14em] text-accent">{t.accountTitle} →</span>
            </span>
          </Link>
          <div className="my-1.5 h-px bg-stage-line" />
          {ACC_TABS.filter((x) => x !== "overview").map((x) => (
            <Link
              key={x}
              href={`/account?tab=${x}`}
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex min-h-10 items-center gap-3 rounded-xl px-2.5 text-sm font-medium text-on-stage/85 hover:bg-white/5 hover:text-on-stage"
            >
              <TabIcon tab={x} className="h-4 w-4 text-on-stage/60" />
              {tabLabel(t, x)}
            </Link>
          ))}
          <div className="my-1.5 h-px bg-stage-line" />
          <button
            type="button"
            role="menuitem"
            onClick={() => signIn(null).then(() => (setOpen(false), router.replace("/")))}
            className="flex min-h-10 w-full items-center gap-3 rounded-xl px-2.5 text-left text-sm font-medium text-on-stage/70 hover:bg-white/5 hover:text-on-stage"
          >
            <svg viewBox="0 0 24 24" aria-hidden className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10" />
            </svg>
            {t.logout}
          </button>
        </div>
      )}
    </div>
  );
}
