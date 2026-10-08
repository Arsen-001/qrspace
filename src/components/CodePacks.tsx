"use client";
// Пакеты кодов в маркете (владелец 08.10.2026): сколько кодов и сколько места под каждым. Цены демо.
import { useEffect, useState } from "react";
import { buyPack, fmtBytes, myPacks } from "@/lib/codes";
import type { Dict, Lang } from "@/lib/i18n";
import { useMe } from "@/lib/me";
import { CODE_PACKS, packBytes, type PackPlan } from "@/lib/packs";
import { LoginModal } from "./LoginModal";

/** Сетка «кодов в пакете»: столько клеток, сколько кодов (до 100 — мелко), — сразу видно, сколько это. */
function Cells({ n }: { n: number }) {
  const cols = n <= 5 ? 5 : 10;
  return (
    <span aria-hidden className="grid gap-[3px]" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
      {Array.from({ length: n }, (_, i) => (
        <span key={i} className="aspect-square rounded-[2px] bg-accent" />
      ))}
    </span>
  );
}

export function CodePacks({ t, lang }: { t: Dict; lang: Lang }) {
  const { me } = useMe();
  const [left, setLeft] = useState<number | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [login, setLogin] = useState<PackPlan | null>(null);
  useEffect(() => {
    if (!me) return;
    myPacks()
      .then((r) => setLeft(r.left))
      .catch(() => {});
  }, [me]);

  const buy = async (p: PackPlan, signedIn = false) => {
    if (!me && !signedIn) return setLogin(p);
    setBusy(p.id);
    try {
      const r = await buyPack(p.id);
      setLeft(r.left);
      setDone(p.id);
    } finally {
      setBusy(null);
    }
  };
  const best = "p50";
  const money = (n: number) => `$${n.toLocaleString("en", { maximumFractionDigits: 2, minimumFractionDigits: n % 1 ? 2 : 0 })}`;

  return (
    <section className="mt-12" aria-labelledby="packs-title">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">{t.packsKicker}</p>
          <h2 id="packs-title" className="mt-2 font-heading text-2xl font-extrabold text-balance [hyphens:manual] sm:text-3xl">
            {t.packsTitle}
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-muted">{t.packsHint}</p>
        </div>
        {me && left !== null && left > 0 && (
          <span className="rounded-full bg-stage px-4 py-2 font-mono text-xs text-on-stage">
            {t.packHave}: <b className="text-accent">{left}</b>
          </span>
        )}
      </div>
      <ul className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">
        {CODE_PACKS.map((p) => {
          // Все карточки тёмные, как «Популярный» (владелец 09.10.2026); у популярной — значок и свечение.
          const hot = p.id === best;
          return (
            <li
              key={p.id}
              className={`relative flex flex-col overflow-hidden rounded-[1.5rem] border p-5 transition-transform hover:-translate-y-1 ${
                hot ? "border-accent/60 bg-stage text-on-stage shadow-[0_30px_60px_-30px_rgba(198,255,46,0.5)]" : "border-stage-line bg-stage text-on-stage"
              }`}
            >
              {hot && <span className="absolute right-4 top-4 rounded-full bg-accent px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-on-accent">{t.packBest}</span>}
              <div className="flex items-baseline gap-2">
                <span className="font-heading text-5xl font-extrabold tracking-tight">{p.codes}</span>
                <span className="font-semibold text-on-stage/70">{t.packCodes}</span>
              </div>
              <div className="mt-4 w-24">
                <Cells n={p.codes} />
              </div>
              <div className="mt-5 flex items-center gap-2 rounded-xl px-3 py-2.5 bg-white/10">
                <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0 text-accent" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M4 7c0-1.7 3.6-3 8-3s8 1.3 8 3-3.6 3-8 3-8-1.3-8-3Zm0 0v10c0 1.7 3.6 3 8 3s8-1.3 8-3V7M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3" />
                </svg>
                <span className="text-sm">
                  <b className="font-heading">{fmtBytes(packBytes(p), lang)}</b> <span className="text-on-stage/70">{t.packRoom}</span>
                  <span className="block text-xs text-on-stage/70">{t.packRoomMore}</span>
                </span>
              </div>
              <div className="mt-auto flex items-end justify-between gap-2 pt-5">
                <span className="font-heading text-3xl font-extrabold text-accent">{money(p.price)}</span>
                <span className="pb-1 font-mono text-xs text-on-stage/70">
                  {money(Math.round((p.price / p.codes) * 100) / 100)} {t.packPer}
                </span>
              </div>
              <button
                type="button"
                disabled={busy === p.id}
                onClick={() => buy(p)}
                aria-label={`${t.packBuy}: ${p.codes} ${t.packCodes}, ${fmtBytes(packBytes(p), lang)}`}
                className="mt-4 min-h-12 rounded-xl bg-accent font-heading text-sm font-bold text-on-accent transition-all hover:brightness-95 disabled:opacity-60"
              >
                {t.packBuy} <span aria-hidden>→</span>
              </button>
              {done === p.id && (
                <p role="status" className="mt-3 text-xs font-semibold text-accent">
                  ✓ {t.packBought}
                </p>
              )}
            </li>
          );
        })}
      </ul>
      <p className="mt-3 text-xs text-muted">{t.buyDemo}</p>
      {login && (
        <LoginModal
          t={t}
          lang={lang}
          next="/market#packs-title"
          onClose={() => setLogin(null)}
          onDone={() => {
            const p = login;
            setLogin(null);
            void buy(p, true);
          }}
        />
      )}
    </section>
  );
}
