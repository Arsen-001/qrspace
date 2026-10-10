"use client";
// Кабинет администратора — «Покупки»: оборот по источникам (сайт — пока демо, App Store, Google Play), перепродажи
// и наша комиссия, проверочные покупки магазинов; последние оплаты списком.
import Link from "next/link";
import { useEffect, useState } from "react";
import { adminApi, type AdminBuy, type AdminPurchases as Data } from "@/lib/admin";
import { fmtDateTime } from "@/lib/format";
import type { Dict, Lang } from "@/lib/i18n";
import { Notice } from "../Shell";
import { AdminSection, Empty, money, Pill, Tile } from "./parts";

/** Одна оплата: что купили, кто, сколько, где (сайт / App Store / Google Play), проверочная ли. */
export function BuyRow({ t, lang, b, onPerson }: { t: Dict; lang: Lang; b: AdminBuy; onPerson?: (id: string) => void }) {
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1 p-3 text-sm">
      <span className="min-w-0 flex-1 basis-56">
        <span className="flex flex-wrap items-center gap-2">
          <span className="font-semibold">{t[`adminKind.${b.kind}` as keyof Dict]}</span>
          {b.store && <Pill tone="dark">{b.store === "apple" ? "App Store" : "Google Play"}</Pill>}
          {!b.store && b.price > 0 && <Pill>{t.adminDemoMoney}</Pill>}
          {b.test && <Pill tone="warn">{t.adminTestMark}</Pill>}
        </span>
        <span className="mt-0.5 block truncate text-xs text-muted">
          {b.code ? (
            <Link href={`/c/${b.code}`} className="underline underline-offset-2">
              {b.title}
            </Link>
          ) : (
            b.title
          )}
          {b.title ? " · " : ""}
          {fmtDateTime(b.at, lang)}
        </span>
      </span>
      {onPerson ? (
        <button type="button" onClick={() => onPerson(b.person.id)} className="min-h-10 max-w-40 truncate rounded-lg px-2 text-left text-sm text-muted underline-offset-2 hover:text-ink hover:underline">
          {b.person.name}
        </button>
      ) : null}
      <span className={`font-heading font-extrabold ${b.test ? "text-muted line-through" : ""}`}>{b.price > 0 ? money(b.price) : t.free}</span>
    </li>
  );
}

export function AdminPurchases({ t, lang, onPerson }: { t: Dict; lang: Lang; onPerson: (id: string) => void }) {
  const [data, setData] = useState<Data | null>(null);
  useEffect(() => {
    let live = true;
    adminApi.purchases().then((d) => live && setData(d), () => {});
    return () => {
      live = false;
    };
  }, []);
  if (!data) return <Notice>{t.loading}</Notice>;
  const s = data.totals;
  return (
    <div className="space-y-8">
      <section>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          <Tile label={t.adminRevenue} value={money(s.revenue)} main />
          <Tile label={t.adminBySite} value={money(s.site)} />
          <Tile label="App Store" value={money(s.apple)} />
          <Tile label="Google Play" value={money(s.google)} />
          <Tile label={t.adminBuysCount} value={s.count} />
          <Tile label={t.adminBuyers} value={s.buyers} />
          <Tile label={t.adminFees} value={money(s.fees)} />
          <Tile label={t.adminTests} value={s.test} />
        </div>
        <p className="mt-3 text-xs text-muted">{t.adminPurchasesNote}</p>
      </section>
      <AdminSection title={t.adminRecent}>
        {!data.rows.length ? (
          <Empty>{t.adminNoPurchases}</Empty>
        ) : (
          <ul className="divide-y divide-line rounded-2xl border border-line bg-card">
            {data.rows.map((b, i) => (
              <BuyRow key={`${b.at}-${i}`} t={t} lang={lang} b={b} onPerson={onPerson} />
            ))}
          </ul>
        )}
      </AdminSection>
    </div>
  );
}
