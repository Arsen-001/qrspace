"use client";
// «Как это работает» — для новых людей: что можно сделать и как поставить сайт на телефон.
import Link from "next/link";
import { useLang } from "@/lib/lang";
import { KindIcon } from "./KindIcon";
import { Shell } from "./Shell";
import { VisIcon } from "./VisBadge";

export function HowPage() {
  const { lang, t } = useLang((t) => `${t.howTitle} — ${t.appName}`);
  const steps: { icon: React.ReactNode; title: string; text: string; href: string; cta: string }[] = [
    { icon: <span className="text-xl">✦</span>, title: t.how1, text: t.how1Text, href: "/", cta: t.navGenerator },
    { icon: <KindIcon kind="memory" className="h-6 w-6" />, title: t.how2, text: t.how2Text, href: "/codes", cta: t.navCodes },
    { icon: <VisIcon v="people" className="h-6 w-6" />, title: t.how3, text: t.how3Text, href: "/codes", cta: t.navCodes },
    { icon: <KindIcon kind="car" className="h-6 w-6" />, title: t.how4, text: t.how4Text, href: "/codes", cta: t.newCode },
    { icon: <span className="text-xl">◆</span>, title: t.how5, text: t.how5Text, href: "/market", cta: t.navMarket },
    { icon: <KindIcon kind="item" className="h-6 w-6" />, title: t.how6, text: t.how6Text, href: "/brand", cta: t.navBrand },
    { icon: <span className="text-xl">🖨</span>, title: t.how7, text: t.how7Text, href: "/shop", cta: t.navShop },
  ];
  return (
    <Shell t={t} lang={lang}>
      <h1 className="max-w-3xl font-heading text-3xl font-extrabold tracking-tight text-balance sm:text-5xl">{t.howTitle}</h1>
      <p className="mt-3 max-w-2xl text-muted">{t.howLead}</p>
      <ol className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {steps.map((s, i) => (
          <li key={i} className="flex flex-col rounded-2xl border border-line bg-card p-5">
            <div className="flex items-center gap-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-accent text-on-accent">{s.icon}</span>
              <span className="font-heading text-lg font-bold leading-tight">{s.title}</span>
            </div>
            <p className="mt-3 flex-1 text-sm text-muted">{s.text}</p>
            <Link href={s.href} className="mt-4 text-sm font-semibold text-accent">
              {s.cta} →
            </Link>
          </li>
        ))}
      </ol>
      <section className="mt-10 rounded-2xl border border-line bg-card p-5 sm:p-6">
        <h2 className="font-heading text-xl font-bold">{t.installTitle}</h2>
        <div className="mt-3 grid gap-4 text-sm sm:grid-cols-2">
          <p>
            <b>iPhone:</b> {t.installIos}
          </p>
          <p>
            <b>Android:</b> {t.installAndroid}
          </p>
        </div>
      </section>
    </Shell>
  );
}
