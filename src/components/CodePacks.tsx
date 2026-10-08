"use client";
// Пакеты кодов в маркете (владелец 08.10.2026): сколько кодов и сколько места под каждым. Цены демо.
import { useEffect, useState } from "react";
import { buyPack, fmtBytes, myPacks } from "@/lib/codes";
import type { Dict, Lang } from "@/lib/i18n";
import { useMe } from "@/lib/me";
import { CODE_PACKS, packBytes, type PackPlan } from "@/lib/packs";
import { LoginModal } from "./LoginModal";

/** Маленький QR лаймом: три «глазка» по углам и точки — у каждого свой узор (по номеру). */
function MiniQr({ seed }: { seed: number }) {
  // Поле 9×9: углы заняты «глазками» 3×3, остальные клетки — точка или пусто (детерминированно от номера).
  const dots: [number, number][] = [];
  for (let y = 0; y < 9; y++)
    for (let x = 0; x < 9; x++) {
      const eye = (x < 4 && y < 4) || (x > 4 && y < 4) || (x < 4 && y > 4);
      const h = Math.imul(x * 73856093 ^ y * 19349663 ^ seed * 83492791, 2654435761) >>> 0;
      if (!eye && (h >>> 7) % 100 < 52) dots.push([x, y]);
    }
  const eye = (x: number, y: number) => (
    <g key={`${x}${y}`}>
      <rect x={x + 0.25} y={y + 0.25} width={2.5} height={2.5} rx={0.6} fill="none" stroke="currentColor" strokeWidth={0.5} />
      <rect x={x + 0.95} y={y + 0.95} width={1.1} height={1.1} rx={0.3} fill="currentColor" />
    </g>
  );
  return (
    <svg viewBox="0 0 9 9" className="block h-full w-full text-accent">
      {eye(0, 0)}
      {eye(6, 0)}
      {eye(0, 6)}
      {dots.map(([x, y]) => (
        <rect key={`${x}-${y}`} x={x + 0.12} y={y + 0.12} width={0.76} height={0.76} rx={0.22} fill="currentColor" />
      ))}
    </svg>
  );
}

/**
 * Сколько кодов — картинкой на свободное место вверху карточки (владелец 09.10.2026): каждый код — маленький QR лаймом.
 * Не крупнее 52 px (у пакета из 5 — не огромные), у больших пакетов — ровные ряды по 10.
 */
function Cells({ n }: { n: number }) {
  // Почти квадрат; у больших пакетов — ровные ряды (столбцов — делитель числа: 50 и 100 — по 10).
  const aim = Math.sqrt(n / 0.8);
  const even = Array.from({ length: n }, (_, i) => i + 1).filter((d) => n % d === 0 && d >= aim * 0.7 && d <= aim * 1.4);
  const cols = n > 20 && even.length ? even.reduce((a, b) => (Math.abs(b - aim) < Math.abs(a - aim) ? b : a)) : Math.ceil(aim);
  const gap = n > 20 ? 6 : 12;
  return (
    <span aria-hidden className="flex w-full max-w-[240px] flex-wrap justify-center" style={{ gap }}>
      {Array.from({ length: n }, (_, i) => (
        <span
          key={i}
          className="x-cell aspect-square"
          style={{ width: `min(52px, calc((100% - ${(cols - 1) * gap}px) / ${cols}))`, animationDelay: `${Math.min(i, 60) * 12}ms` }}
        >
          <MiniQr seed={i + 1} />
        </span>
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
              {/* Вверху — сколько кодов, на всё свободное место; внизу — место под кодом, цена и кнопка. */}
              <div className="flex min-h-44 flex-1 items-center justify-center py-6">
                <Cells n={p.codes} />
              </div>
              <div className="flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2.5">
                <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0 text-accent" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M4 7c0-1.7 3.6-3 8-3s8 1.3 8 3-3.6 3-8 3-8-1.3-8-3Zm0 0v10c0 1.7 3.6 3 8 3s8-1.3 8-3V7M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3" />
                </svg>
                <span className="text-sm">
                  <b className="font-heading">{fmtBytes(packBytes(p), lang)}</b> <span className="text-on-stage/70">{t.packRoom}</span>
                  <span className="block text-xs text-on-stage/70">{t.packRoomMore}</span>
                </span>
              </div>
              <div className="flex items-end justify-between gap-2 pt-4">
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
