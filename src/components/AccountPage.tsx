"use client";
// Кабинет после входа (владелец 09.10.2026): кто я, цифры по моим кодам, коды, покупки, пакеты, продажи, настройки.
// Разделы — вкладки с адресом (?tab=…), чтобы из меню под аватаркой и из писем открывался нужный.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { ACC_TABS, type AccTab } from "@/lib/account";
import { api, fmtBytes, linkOf, type CodeList } from "@/lib/codes";
import { fmtDateTime } from "@/lib/format";
import { fill, LANGS, type Dict, type Lang } from "@/lib/i18n";
import { saveLang, useLang } from "@/lib/lang";
import { refreshPeople, signIn, useMe } from "@/lib/me";
import type { Pack } from "@/lib/packs";
import type { Purchase } from "@/lib/pricing";
import { Avatar } from "./Avatar";
import { CodePacks, MiniQr } from "./CodePacks";
import { Upcoming } from "./CodesPage";
import { MyCodesGrid } from "./MyCodesGrid";
import { QrThumb } from "./QrThumb";
import { Notice, Shell } from "./Shell";
import { Info, Select } from "./ui";

type LotRow = {
  id: string;
  code: string;
  title: string;
  mode: "fixed" | "auction";
  price: number;
  status: "open" | "sold" | "expired" | "cancelled";
  final: number | null;
  bids: number;
  endsAt: string | null;
  createdAt: string;
};
type Profile = {
  id: string;
  name: string;
  email: string;
  provider: "google" | "apple" | "demo";
  designer: boolean;
  since: string | null;
  codes: number;
  stats: {
    scans30: number;
    scans: number;
    used: number;
    quota: number;
    paidSpace: number;
    packsLeft: number;
    spent: number;
    earned: number;
  };
  purchases: Purchase[];
  packs: Pack[];
  lots: LotRow[];
};

export const tabLabel = (t: Dict, tab: AccTab) =>
  ({
    overview: t.accOverview,
    codes: t.navCodes,
    purchases: t.accPurchases,
    packs: t.accPacks,
    sales: t.accSales,
    settings: t.settingsTitle,
  })[tab];

/** Значки вкладок — тонкие линии, как в «Тонкой настройке». */
export function TabIcon({ tab, className = "h-4 w-4" }: { tab: AccTab; className?: string }) {
  const d = {
    overview: "M4 13h6V4H4zM14 20h6v-9h-6zM14 8h6V4h-6zM4 20h6v-4H4z",
    codes: "M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2v2h-2zM18 18h2v2h-2zM14 18h2",
    purchases: "M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6",
    packs: "M12 3 4 7v10l8 4 8-4V7zM4 7l8 4 8-4M12 11v10",
    sales: "M20 12 12 20l-8-8V4h8zM8.5 8.5h.01",
    settings:
      "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1-2 3.4-.2-.1a1.7 1.7 0 0 0-2 .3 1.7 1.7 0 0 0-.8 1.5H9.2a1.7 1.7 0 0 0-.8-1.5 1.7 1.7 0 0 0-2-.3l-.2.1-2-3.4.1-.1a1.7 1.7 0 0 0 .3-1.8A1.7 1.7 0 0 0 3 14V10a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1 2-3.4.2.1a1.7 1.7 0 0 0 2-.3A1.7 1.7 0 0 0 9.2 2h5.6a1.7 1.7 0 0 0 .8 1.5 1.7 1.7 0 0 0 2 .3l.2-.1 2 3.4-.1.1a1.7 1.7 0 0 0-.3 1.8A1.7 1.7 0 0 0 21 10v4a1.7 1.7 0 0 0-1.6 1z",
  }[tab];
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}

const money = (n: number) => `$${Math.round(n * 100) / 100}`;

function Stat({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <div className="min-w-0 rounded-2xl border border-stage-line bg-white/[0.04] p-4">
      <div className="min-h-[2.4em] font-mono text-[10px] uppercase leading-tight tracking-[0.12em] text-on-stage/60 sm:min-h-0">{label}</div>
      <div className="mt-1.5 truncate font-heading text-2xl font-extrabold sm:text-3xl">{value}</div>
      {sub && <div className="mt-2">{sub}</div>}
    </div>
  );
}

function Bar({ part, of, dark }: { part: number; of: number; dark?: boolean }) {
  const pct = of ? Math.min(100, Math.round((part / of) * 100)) : 0;
  return (
    <span aria-hidden className={`block h-1.5 overflow-hidden rounded-full ${dark ? "bg-white/10" : "bg-line"}`}>
      <span className={`block h-full rounded-full ${pct > 90 ? "bg-warn" : dark ? "bg-accent" : "bg-ink"}`} style={{ width: `${Math.max(pct, part ? 3 : 0)}%` }} />
    </span>
  );
}

function Section({ title, info, action, children }: { title: string; info?: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section>
      <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1">
        <h2 className="flex items-center gap-2 font-heading text-2xl font-extrabold">
          {title}
          {info && <Info text={info} label={title} />}
        </h2>
        {action && <div className="ml-auto">{action}</div>}
      </div>
      {children}
    </section>
  );
}

function Empty({ children, cta }: { children: ReactNode; cta?: ReactNode }) {
  return (
    <div className="rounded-2xl border-2 border-dashed border-line p-6 text-center text-sm text-muted sm:p-8">
      <p className="mx-auto max-w-md">{children}</p>
      {cta && <div className="mt-4">{cta}</div>}
    </div>
  );
}

const linkBtn = "inline-flex min-h-11 items-center gap-2 rounded-xl px-4 font-heading text-sm font-bold";

/** Мои коды целиком (вкладка «Мои коды»); плитка «+ Новый код» — первой. */
function MyCodes({ t, data }: { t: Dict; data: CodeList }) {
  if (!data.mine.length)
    return (
      <Link href="/create" className="group relative block overflow-hidden rounded-2xl bg-stage p-8 text-on-stage sm:p-10">
        <div aria-hidden className="x-stage-glow" />
        <span className="relative block font-heading text-2xl font-extrabold sm:text-3xl">{t.firstCodeTitle}</span>
        <span className="relative mt-2 block max-w-md text-sm text-on-stage/70">{t.firstCodeText}</span>
        <span className="relative mt-6 inline-flex min-h-12 items-center gap-2 rounded-xl bg-accent px-5 font-heading text-sm font-bold text-on-accent">
          {t.firstCodeCta} <span className="transition-transform group-hover:translate-x-1">→</span>
        </span>
      </Link>
    );
  return (
    <MyCodesGrid
      t={t}
      base={data.base}
      codes={data.mine}
      leading={
        <li>
          <Link
            href="/create"
            className="flex h-full min-h-48 flex-col items-center justify-center gap-3 rounded-3xl border-2 border-dashed border-line p-4 text-center text-sm font-semibold text-muted transition-all hover:-translate-y-1 hover:border-accent-ink hover:text-ink"
          >
            <span aria-hidden className="grid h-12 w-12 place-items-center rounded-xl bg-accent text-2xl text-on-accent">
              +
            </span>
            {t.newCode}
          </Link>
        </li>
      }
    />
  );
}

/** Одна строка истории: покупка кода или пакета. */
type Row = { at: string; title: ReactNode; price: string; note?: string };

function rowsOf(t: Dict, p: Profile): Row[] {
  const codes: Row[] = p.purchases.map((x) => ({
    at: x.at,
    title: (
      <>
        {x.tier === "simple" ? t.tierSimple : t.tierStyled}
        {x.key.startsWith("code:") && (
          <>
            {" · "}
            <Link href={`/codes/${x.key.slice(5)}`} className="text-accent-ink underline underline-offset-2">
              {t.openCode}
            </Link>
          </>
        )}
      </>
    ),
    price: x.free ? t.free : x.pack ? t.accFromPack : money(x.price),
  }));
  const packs: Row[] = p.packs.map((x) => ({
    at: x.at,
    title: `${t.accPackItem} · ${x.codes} ${t.packCodes}`,
    price: money(x.price),
  }));
  return [...codes, ...packs].sort((a, b) => b.at.localeCompare(a.at));
}

function History({ lang, rows }: { lang: Lang; rows: Row[] }) {
  return (
    <ul className="divide-y divide-line rounded-2xl border border-line bg-card px-4 text-sm sm:px-5">
      {rows.map((x, i) => (
        <li key={i} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-3">
          <span className="min-w-0 flex-1 font-medium">{x.title}</span>
          <span className="font-heading font-bold">{x.price}</span>
          <span className="w-full text-xs text-muted sm:w-28 sm:text-right">{fmtDateTime(x.at, lang)}</span>
        </li>
      ))}
    </ul>
  );
}

function Overview({ t, lang, p, codes, go, onDone }: { t: Dict; lang: Lang; p: Profile; codes: CodeList | null; go: (tab: AccTab) => void; onDone: () => void }) {
  const rows = rowsOf(t, p);
  const next = [
    { href: "/create", title: t.newCode, text: t.accNextCode, mark: "+" },
    {
      tab: "packs" as const,
      title: t.packBuy,
      text: t.accNextPacks,
      mark: "×5",
    },
    { href: "/market", title: t.navMarket, text: t.accNextMarket, mark: "★" },
  ];
  return (
    <div className="space-y-10">
      {/* Напоминания по кодам (просрочено и ближайшие 2 недели) — первыми: самое срочное сразу после входа. */}
      {codes && <Upcoming t={t} lang={lang} codes={[...codes.mine, ...codes.shared]} onDone={onDone} />}
      <Section title={t.accNext}>
        <ul className="grid gap-3 sm:grid-cols-3">
          {next.map((n) => {
            const body = (
              <>
                <span aria-hidden className="row-span-2 grid h-11 w-11 place-items-center rounded-xl bg-stage font-heading text-lg font-extrabold text-accent sm:row-span-1">
                  {n.mark}
                </span>
                <span className="block self-end font-heading text-lg font-bold sm:mt-4">{n.title}</span>
                <span className="block text-sm text-muted sm:mt-1">{n.text}</span>
              </>
            );
            const cls = "grid h-full w-full grid-cols-[auto_1fr] gap-x-4 rounded-2xl border border-line bg-card p-4 text-left transition-all hover:-translate-y-0.5 hover:border-muted sm:block sm:p-5";
            return (
              <li key={n.title}>
                {n.href ? (
                  <Link href={n.href} className={cls}>
                    {body}
                  </Link>
                ) : (
                  <button type="button" onClick={() => go(n.tab!)} className={cls}>
                    {body}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      </Section>

      <Section
        title={t.accRecentCodes}
        action={
          <button type="button" onClick={() => go("codes")} className="text-sm font-semibold text-accent-ink">
            {t.accSeeAll} →
          </button>
        }
      >
        {!codes ? (
          <Notice>{t.loading}</Notice>
        ) : !codes.mine.length ? (
          <Empty
            cta={
              <Link href="/create" className={`${linkBtn} bg-accent text-on-accent`}>
                {t.firstCodeCta} →
              </Link>
            }
          >
            {t.firstCodeText}
          </Empty>
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {codes.mine.slice(0, 4).map((c) => (
              <li key={c.id}>
                <Link href={`/codes/${c.id}`} className="group block rounded-2xl bg-stage p-3 text-on-stage transition-transform hover:-translate-y-1">
                  <span className="block rounded-xl p-2" style={{ background: c.style?.bg ?? "#ffffff" }}>
                    <QrThumb link={linkOf(codes.base, c)} style={c.style} className="aspect-square w-full rounded-md" />
                  </span>
                  <span className="mt-2.5 block truncate font-heading text-sm font-bold">{c.title}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section
        title={t.accRecentBuys}
        action={
          rows.length > 3 && (
            <button type="button" onClick={() => go("purchases")} className="text-sm font-semibold text-accent-ink">
              {t.accSeeAll} →
            </button>
          )
        }
      >
        {rows.length ? <History lang={lang} rows={rows.slice(0, 3)} /> : <Empty>{t.noPurchases}</Empty>}
      </Section>
    </div>
  );
}

function Purchases({ t, lang, p }: { t: Dict; lang: Lang; p: Profile }) {
  const rows = rowsOf(t, p);
  return (
    <Section
      title={t.accPurchases}
      info={t.infoPurchases}
      action={
        <span className="text-sm text-muted">
          {t.accSpent}: <b className="font-heading text-ink">{money(p.stats.spent)}</b>
        </span>
      }
    >
      {rows.length ? (
        <History lang={lang} rows={rows} />
      ) : (
        <Empty
          cta={
            <Link href="/create" className={`${linkBtn} bg-accent text-on-accent`}>
              {t.newCode} →
            </Link>
          }
        >
          {t.noPurchases}
        </Empty>
      )}
    </Section>
  );
}

function Packs({ t, lang, p, onBought }: { t: Dict; lang: Lang; p: Profile; onBought: () => void }) {
  // Купили пакет внизу — перечитываем цифры кабинета (CodePacks сам говорит только о себе).
  useEffect(() => {
    const on = () => onBought();
    window.addEventListener("qrspace:packs", on);
    return () => window.removeEventListener("qrspace:packs", on);
  }, [onBought]);
  return (
    <div className="space-y-10">
      <Section title={t.accPacks} info={t.infoPacks}>
        {p.packs.length ? (
          <ul className="grid gap-3 sm:grid-cols-2">
            {p.packs.map((x) => (
              <li key={x.id} className="flex gap-4 rounded-2xl bg-stage p-4 text-on-stage">
                <span className="h-16 w-16 shrink-0 rounded-xl bg-white/[0.06] p-2.5">
                  <MiniQr seed={x.codes} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-heading text-xl font-extrabold">
                      {x.codes} <span className="text-accent">{t.packCodes}</span>
                    </span>
                    <span className="text-xs text-on-stage/60">{fmtDateTime(x.at, lang)}</span>
                  </div>
                  <div className="mt-1 text-sm text-on-stage/70">{fill(t.accPackUsed, { used: x.used, codes: x.codes })}</div>
                  <div className="mt-2.5">
                    <Bar part={x.used} of={x.codes} dark />
                  </div>
                  <div className="mt-2 font-mono text-[11px] text-on-stage/60">
                    {fmtBytes(x.bytes, lang)} {t.packRoom} · {money(x.price)}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <Empty>{t.accNoPacks}</Empty>
        )}
      </Section>
      <CodePacks t={t} lang={lang} />
    </div>
  );
}

function Sales({ t, lang, p }: { t: Dict; lang: Lang; p: Profile }) {
  const badge = {
    open: "bg-accent text-on-accent",
    sold: "bg-ink text-bg",
    expired: "bg-line text-muted",
    cancelled: "bg-line text-muted",
  };
  const status = {
    open: t.accLotOpen,
    sold: t.accLotSold,
    expired: t.accLotExpired,
    cancelled: t.accLotCancelled,
  };
  return (
    <Section
      title={t.accSales}
      info={t.infoResale}
      action={
        <span className="text-sm text-muted">
          {t.accEarned}: <b className="font-heading text-ink">{money(p.stats.earned)}</b>
        </span>
      }
    >
      {p.lots.length ? (
        <ul className="divide-y divide-line rounded-2xl border border-line bg-card px-4 text-sm sm:px-5">
          {p.lots.map((l) => (
            <li key={l.id}>
              <Link href={`/market/lot/${l.id}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-3 hover:text-accent-ink">
                <span className="min-w-0 flex-1 truncate font-medium">{l.title}</span>
                <span className="text-xs text-muted">{l.mode === "auction" ? `${t.auction} · ${t.bids}: ${l.bids}` : t.fixedPrice}</span>
                <span className="font-heading font-bold">{money(l.final ?? l.price)}</span>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${badge[l.status]}`}>{status[l.status]}</span>
                <span className="w-full text-xs text-muted sm:w-28 sm:text-right">{fmtDateTime(l.createdAt, lang)}</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <Empty
          cta={
            <Link href="/market" className={`${linkBtn} border border-line bg-card`}>
              {t.navMarket} →
            </Link>
          }
        >
          {t.accNoSales}
        </Empty>
      )}
    </Section>
  );
}

function Settings({ t, lang, p, onName }: { t: Dict; lang: Lang; p: Profile; onName: () => void }) {
  const router = useRouter();
  const [name, setName] = useState(p.name);
  const [saved, setSaved] = useState(false);
  const [sure, setSure] = useState(false);
  const [error, setError] = useState(false);
  const saveName = async () => {
    const r = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (r.ok) {
      await refreshPeople();
      onName();
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    }
  };
  const remove = async () => {
    setError(false);
    const r = await fetch("/api/profile", { method: "DELETE" });
    if (!r.ok) return setError(true);
    await signIn(null).catch(() => {});
    router.replace("/");
  };
  return (
    <Section title={t.settingsTitle}>
      <div className="grid gap-5 lg:grid-cols-2 lg:items-start">
        <section className="rounded-2xl border border-line bg-card p-5">
          <label htmlFor="pname" className="mb-1.5 block text-sm font-medium text-muted">
            {t.yourName}
          </label>
          <div className="flex gap-2">
            <input
              id="pname"
              value={name}
              maxLength={60}
              onChange={(e) => setName(e.target.value)}
              className="min-h-11 min-w-0 flex-1 rounded-xl border border-line bg-field px-3.5 text-base outline-none focus:border-accent"
            />
            <button
              type="button"
              disabled={!name.trim() || name.trim() === p.name}
              onClick={saveName}
              className="min-h-11 rounded-xl bg-accent px-4 text-sm font-semibold text-on-accent disabled:opacity-40"
            >
              {saved ? t.saved : t.save}
            </button>
          </div>
          <p className="mt-2 text-xs text-muted">{t.yourNameHint}</p>
        </section>

        <section className="rounded-2xl border border-line bg-card p-5">
          <div className="mb-1.5 text-sm font-medium text-muted">{t.accSignedWith}</div>
          <div className="font-semibold">{p.provider === "demo" ? t.demoAccount : `${p.provider === "google" ? "Google" : "Apple"} · ${p.email}`}</div>
          <div className="mb-1.5 mt-4 text-sm font-medium text-muted">{t.accLanguage}</div>
          <Select className="w-full sm:w-56" label={t.accLanguage} value={lang} onChange={(v) => saveLang(v)} options={LANGS.map((l) => ({ id: l.id, label: l.name }))} />
        </section>

        <section className="space-y-3 rounded-2xl border border-line bg-card p-5">
          <button
            type="button"
            onClick={() => signIn(null).then(() => router.replace("/"))}
            className="min-h-11 w-full rounded-xl border border-line bg-field px-4 text-sm font-semibold hover:border-muted"
          >
            {t.logout}
          </button>
          {p.provider !== "demo" &&
            (sure ? (
              <div className="rounded-xl bg-warn-soft p-4">
                <p className="text-sm font-semibold text-warn">{t.deleteAccountSure}</p>
                <div className="mt-3 flex gap-2">
                  <button type="button" onClick={remove} className="min-h-11 flex-1 rounded-xl bg-warn px-4 text-sm font-semibold text-on-warn">
                    {t.deleteAccountYes}
                  </button>
                  <button type="button" onClick={() => setSure(false)} className="min-h-11 rounded-xl px-3 text-sm font-medium text-muted hover:text-ink">
                    {t.cancel}
                  </button>
                </div>
                {error && <p className="mt-2 text-sm text-warn">{t.saveError}</p>}
              </div>
            ) : (
              <button type="button" onClick={() => setSure(true)} className="min-h-11 w-full rounded-xl px-4 text-sm font-medium text-muted hover:text-warn">
                {t.deleteAccount}
              </button>
            ))}
        </section>
      </div>
    </Section>
  );
}

export function AccountPage({ tab: first }: { tab: AccTab }) {
  const { lang, t } = useLang((t) => `${t.accountTitle} — ${t.appName}`);
  const { ready, me } = useMe();
  const router = useRouter();
  const [tab, setTab] = useState<AccTab>(first);
  const [p, setP] = useState<{ me: string; profile: Profile } | null>(null);
  const [codes, setCodes] = useState<{ me: string; data: CodeList } | null>(null);
  const [tick, setTick] = useState(0);
  const reload = () => setTick((n) => n + 1);

  useEffect(() => {
    if (!me) return;
    let live = true;
    fetch("/api/profile", { cache: "no-store" })
      .then((r) => r.json() as Promise<Profile>)
      .then(
        (profile) => live && setP({ me, profile }),
        () => {},
      );
    api.list().then(
      (data) => live && setCodes({ me, data }),
      () => {},
    );
    return () => {
      live = false;
    };
  }, [me, tick]);
  const profile = p?.me === me ? p.profile : null;
  const list = codes?.me === me ? codes.data : null;

  const go = (next: AccTab) => {
    setTab(next);
    router.replace(next === "overview" ? "/account" : `/account?tab=${next}`, {
      scroll: false,
    });
  };

  if (ready && !me)
    return (
      <Shell t={t} lang={lang}>
        <div className="mx-auto mt-6 max-w-md rounded-2xl border border-line bg-card p-6 text-center">
          <h1 className="font-heading text-2xl font-extrabold">{t.accountTitle}</h1>
          <p className="mt-2 text-sm text-muted">{t.accLoginText}</p>
          <Link
            href={`/login?next=${encodeURIComponent(tab === "overview" ? "/account" : `/account?tab=${tab}`)}`}
            className="mt-5 inline-grid min-h-11 place-items-center rounded-xl bg-accent px-5 text-sm font-semibold text-on-accent"
          >
            {t.login}
          </Link>
        </div>
      </Shell>
    );

  return (
    <Shell t={t} lang={lang}>
      {!profile ? (
        <div className="mt-6">
          <Notice>{t.loading}</Notice>
        </div>
      ) : (
        <div className="space-y-8">
          <section className="relative overflow-hidden rounded-3xl bg-stage p-5 text-on-stage sm:p-7">
            <div aria-hidden className="x-stage-glow" />
            <div className="relative flex flex-wrap items-center gap-4">
              <Avatar id={profile.id} lang={lang} size={64} />
              <div className="min-w-0 flex-1 basis-48">
                <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.14em] text-accent">
                  {t.accountTitle}
                  <Info text={t.infoAccount} label={t.accountTitle} dark />
                </div>
                <h1 className="truncate font-heading text-2xl font-extrabold sm:text-3xl">{profile.name}</h1>
                <div className="truncate text-sm text-on-stage/70">
                  {profile.provider === "demo" ? t.demoAccount : `${profile.provider === "google" ? "Google" : "Apple"} · ${profile.email}`}
                  {profile.designer && ` · ${t.designerRole}`}
                  {profile.since && ` · ${t.accSince} ${fmtDateTime(profile.since, lang).split(",")[0]}`}
                </div>
              </div>
              <Link href="/create" className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-accent px-5 font-heading text-sm font-bold text-on-accent sm:w-auto">
                + {t.newCode}
              </Link>
            </div>
            <div className="relative mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Stat label={t.navCodes} value={profile.codes} />
              <Stat label={t.accScans30} value={profile.stats.scans30} sub={<span className="text-xs text-on-stage/60">{fill(t.accScansAll, { n: profile.stats.scans })}</span>} />
              <Stat
                label={t.accSpace}
                value={<span className="text-xl sm:text-2xl">{profile.stats.quota ? fmtBytes(profile.stats.used, lang) : "—"}</span>}
                sub={
                  profile.stats.quota > 0 && (
                    <>
                      <Bar part={profile.stats.used} of={profile.stats.quota} dark />
                      <span className="mt-1.5 block truncate text-xs text-on-stage/60">
                        {t.accOf} {fmtBytes(profile.stats.quota, lang)}
                      </span>
                    </>
                  )
                }
              />
              <Stat label={t.accPacksLeft} value={<span className={profile.stats.packsLeft ? "text-accent" : ""}>{profile.stats.packsLeft}</span>} />
            </div>
          </section>

          <div className="lg:grid lg:grid-cols-[13rem_1fr] lg:gap-8">
            {/* Разделы: на телефоне — строка с прокруткой, на компьютере — колонка слева. */}
            <nav aria-label={t.accountTitle} className="mb-6 grid grid-cols-3 gap-1.5 sm:grid-cols-6 lg:sticky lg:top-4 lg:mb-0 lg:flex lg:flex-col lg:self-start">
              {ACC_TABS.map((x) => (
                <button
                  key={x}
                  type="button"
                  onClick={() => go(x)}
                  aria-current={tab === x ? "page" : undefined}
                  className={`relative flex min-h-16 flex-col items-center justify-center gap-1.5 rounded-xl px-1 text-center text-xs font-semibold transition-colors lg:min-h-11 lg:flex-row lg:justify-start lg:gap-2.5 lg:px-3.5 lg:text-left lg:text-sm ${
                    tab === x ? "bg-stage text-on-stage" : "border border-line bg-card text-muted hover:text-ink lg:border-transparent lg:bg-transparent lg:hover:bg-card"
                  }`}
                >
                  <TabIcon tab={x} className={`h-5 w-5 lg:h-4 lg:w-4 ${tab === x ? "text-accent" : ""}`} />
                  {tabLabel(t, x)}
                  {x === "packs" && profile.stats.packsLeft > 0 && <span className="absolute right-1.5 top-1.5 rounded-full bg-accent px-1.5 font-mono text-[10px] text-on-accent lg:static lg:ml-auto">{profile.stats.packsLeft}</span>}
                </button>
              ))}
            </nav>

            <div className="min-w-0">
              {tab === "overview" && <Overview t={t} lang={lang} p={profile} codes={list} go={go} onDone={reload} />}
              {tab === "codes" && (
                <Section
                  title={t.navCodes}
                  info={t.infoMyCodes}
                  action={
                    <Link href="/codes" className="text-sm font-semibold text-accent-ink">
                      {t.allCodes} →
                    </Link>
                  }
                >
                  {list ? <MyCodes t={t} data={list} /> : <Notice>{t.loading}</Notice>}
                </Section>
              )}
              {tab === "purchases" && <Purchases t={t} lang={lang} p={profile} />}
              {tab === "packs" && <Packs t={t} lang={lang} p={profile} onBought={reload} />}
              {tab === "sales" && <Sales t={t} lang={lang} p={profile} />}
              {tab === "settings" && <Settings t={t} lang={lang} p={profile} onName={reload} />}
            </div>
          </div>
        </div>
      )}
    </Shell>
  );
}
