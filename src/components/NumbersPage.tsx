"use client";
// Номерные коды: миллион номеров, у каждого один хозяин. Поиск номера, красивые номера, недавно купленные.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { fmtDateTime } from "@/lib/format";
import { fill, type Dict } from "@/lib/i18n";
import { useLang } from "@/lib/lang";
import { useMe } from "@/lib/me";
import { fmtNumber, NUMBERS_MAX, type NumberTier } from "@/lib/numbers";
import { personName } from "./Avatar";
import { Shell } from "./Shell";

type Check = { n: number; tier: NumberTier; price: number; free: boolean; owner: string | null; code: string | null };
type Showcase = { recent: { n: number; at: string; owner: string; code: string }[]; showcase: { n: number; tier: NumberTier; price: number; free: boolean }[]; sold: number; max: number };

const TIER_STYLE: Record<NumberTier, string> = {
  legend: "bg-[#11131a] text-[#ffd36b]",
  rare: "bg-[#2e1a5e] text-[#c9b8ff]",
  special: "bg-accent text-on-accent",
  nice: "bg-field text-ink",
  common: "bg-field text-muted",
};

function TierBadge({ t, tier }: { t: Dict; tier: NumberTier }) {
  return <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${TIER_STYLE[tier]}`}>{t[`tier.${tier}`]}</span>;
}

export function NumbersPage() {
  const { lang, t } = useLang((t) => `${t.numbersTitle} — ${t.appName}`);
  const { ready, me } = useMe();
  const router = useRouter();
  const [data, setData] = useState<Showcase | null>(null);
  const [q, setQ] = useState("");
  const [check, setCheck] = useState<Check | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    let live = true;
    fetch("/api/numbers", { cache: "no-store" })
      .then((r) => r.json() as Promise<Showcase>)
      .then((d) => live && setData(d), () => {});
    return () => {
      live = false;
    };
  }, []);

  const look = async (n: number) => {
    setError(false);
    setQ(String(n));
    const r = await fetch(`/api/numbers?n=${n}`, { cache: "no-store" });
    setCheck(r.ok ? ((await r.json()) as Check) : null);
  };
  const buy = async (n: number) => {
    setBusy(true);
    setError(false);
    try {
      const r = await fetch("/api/numbers", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ n }) });
      if (!r.ok) throw new Error(String(r.status));
      const code = (await r.json()) as { id: string };
      router.push(`/codes/${code.id}`);
    } catch {
      setError(true);
      setBusy(false);
      look(n);
    }
  };
  const n = Number(q);
  const valid = Number.isInteger(n) && n >= 1 && n <= NUMBERS_MAX;

  return (
    <Shell t={t} lang={lang}>
      <section className="rounded-3xl bg-[#11131a] p-6 text-white sm:p-10">
        <div className="font-mono text-xs uppercase tracking-[0.2em] text-white/60">QR Studio</div>
        <h1 className="mt-3 max-w-2xl font-heading text-3xl font-extrabold leading-tight text-balance sm:text-5xl">{t.numbersTitle}</h1>
        <p className="mt-3 max-w-xl text-sm text-white/80">{t.numbersHint}</p>
        {data && <p className="mt-3 text-sm font-semibold text-[#9aa6ff]">{fill(t.numbersSold, { sold: fmtNumber(data.sold), max: fmtNumber(data.max) })}</p>}
        <form
          className="mt-6 flex max-w-md gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (valid) look(n);
          }}
        >
          <span className="grid min-h-12 place-items-center px-1 font-heading text-2xl font-extrabold text-white/60">№</span>
          <input
            inputMode="numeric"
            value={q}
            onChange={(e) => setQ(e.target.value.replace(/\D/g, "").slice(0, 7))}
            placeholder="777"
            aria-label={t.numberSearch}
            className="min-h-12 min-w-0 flex-1 rounded-xl border border-white/20 bg-white/10 px-4 font-heading text-2xl font-bold text-white outline-none placeholder:text-white/30 focus:border-white/60"
          />
          <button type="submit" disabled={!valid} className="min-h-12 rounded-xl bg-white px-5 text-sm font-semibold text-[#11131a] disabled:opacity-40">
            {t.numberCheck}
          </button>
        </form>
        {check && (
          <div className="mt-4 max-w-md rounded-2xl bg-white/10 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-heading text-3xl font-extrabold">№ {fmtNumber(check.n)}</span>
              <TierBadge t={t} tier={check.tier} />
            </div>
            {check.free ? (
              <>
                <p className="mt-2 text-sm text-white/80">{t.numberFree}</p>
                {!ready ? null : me ? (
                  <button type="button" disabled={busy} onClick={() => buy(check.n)} className="mt-3 min-h-12 w-full rounded-xl bg-[#ffd36b] px-5 text-sm font-bold text-[#11131a] disabled:opacity-50">
                    {t.buy} — ${check.price}
                  </button>
                ) : (
                  <Link href="/login?next=/numbers" className="mt-3 grid min-h-12 place-items-center rounded-xl bg-[#ffd36b] px-5 text-sm font-bold text-[#11131a]">
                    {t.loginToBuy}
                  </Link>
                )}
                <p className="mt-2 text-xs text-white/60">{t.buyDemo}</p>
              </>
            ) : check.owner === me ? (
              <p className="mt-2 text-sm font-semibold text-[#ffd36b]">
                ✓ {t.numberYours}{" "}
                <Link href={`/codes/${check.code}`} className="underline underline-offset-2">
                  {t.editCode}
                </Link>
              </p>
            ) : (
              <p className="mt-2 text-sm text-white/80">
                {fill(t.numberTaken, { who: check.owner ? personName(check.owner, lang) : "—" })}{" "}
                <Link href="/market" className="font-semibold text-[#9aa6ff] underline underline-offset-2">
                  {t.resaleTitle}
                </Link>
              </p>
            )}
            {error && <p className="mt-2 text-sm text-[#ffb4a8]">{t.numberGone}</p>}
          </div>
        )}
      </section>

      {data && (
        <section className="mt-8">
          <h2 className="font-heading text-xl font-bold">{t.numbersShowcase}</h2>
          <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {data.showcase.map((s) => (
              <li key={s.n}>
                <button
                  type="button"
                  onClick={() => look(s.n)}
                  className={`flex h-full w-full flex-col items-start gap-2 rounded-2xl border border-line bg-card p-4 text-left transition-colors hover:border-muted ${s.free ? "" : "opacity-60"}`}
                >
                  {/* Длинный номер («1 000 000») — мельче, чтобы не переносился. */}
                  <span className={`whitespace-nowrap font-heading font-extrabold ${fmtNumber(s.n).length > 7 ? "text-lg" : "text-2xl"}`}>№ {fmtNumber(s.n)}</span>
                  <TierBadge t={t} tier={s.tier} />
                  <span className="text-sm font-semibold">{s.free ? `$${s.price}` : t.numberTakenShort}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {data && data.recent.length > 0 && (
        <section className="mt-8">
          <h2 className="font-heading text-xl font-bold">{t.numbersRecent}</h2>
          <ul className="mt-3 divide-y divide-line rounded-2xl border border-line bg-card">
            {data.recent.map((r) => (
              <li key={r.code} className="flex items-center gap-3 p-4 text-sm">
                <span className="font-heading text-lg font-extrabold">№ {fmtNumber(r.n)}</span>
                <span className="min-w-0 flex-1 truncate text-muted">{personName(r.owner, lang)}</span>
                <span className="text-xs text-muted">{fmtDateTime(r.at, lang)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-8 grid gap-3 text-sm sm:grid-cols-3">
        {[t.numbersWhy1, t.numbersWhy2, t.numbersWhy3].map((s, i) => (
          <p key={i} className="rounded-2xl border border-line bg-card p-4">
            {s}
          </p>
        ))}
      </section>
    </Shell>
  );
}
