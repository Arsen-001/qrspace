"use client";
// Главная — витрина (владелец 09.10.2026): первый экран с кодом и выключателем, логотипы, что умеем; генератор — на /create.
import Link from "next/link";
import { useLang } from "@/lib/lang";
import { useMe } from "@/lib/me";
import { HomeDashboard } from "./HomeDashboard";
import { HomeBackdrop, HomeFeatures, HomeHero, HomeTicker } from "./HomeHero";
import { SiteFooter } from "./SiteFooter";
import { SiteHeader } from "./SiteHeader";

export function HomePage({ signedIn }: { signedIn: boolean }) {
  // Вошёл/вышел прямо на странице — переключаемся сразу, не дожидаясь сервера.
  const { ready, me } = useMe();
  if (ready ? me : signedIn) return <HomeDashboard />;
  return <Showcase />;
}

function Showcase() {
  const { lang, t } = useLang((t) => `${t.appName} — ${t.tagline}`);
  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-16 sm:px-6">
      <SiteHeader t={t} lang={lang} />
      <HomeBackdrop />
      <HomeHero t={t} />
      <HomeTicker t={t} />
      <Link href="/create" className="group mt-2 flex flex-wrap items-center gap-x-6 gap-y-4 rounded-3xl border border-line bg-card p-6 transition-colors hover:border-muted sm:p-8">
        <span className="min-w-0 flex-1 basis-72">
          <span className="block font-heading text-2xl font-extrabold sm:text-4xl">{t.homeMakeTitle}</span>
          <span className="mt-2 block text-sm text-muted sm:text-base">{t.homeMakeText}</span>
        </span>
        <span className="inline-flex min-h-13 w-full items-center justify-center gap-3 rounded-xl bg-accent px-6 font-heading text-sm font-bold text-on-accent sm:w-auto">
          {t.homeCta}
          <span aria-hidden className="transition-transform group-hover:translate-x-1">
            →
          </span>
        </span>
      </Link>
      <HomeFeatures t={t} />
      <SiteFooter t={t} lang={lang} lead={t.footer} />
    </div>
  );
}
