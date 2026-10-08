"use client";
// Статистика сканов: главные числа и столбики по дням за 30 дней (один ряд — один цвет, подсказка на каждом дне).
import { useState } from "react";
import type { ScanStats as Stats } from "@/lib/codes";
import { fmtDate } from "@/lib/format";
import type { Dict, Lang } from "@/lib/i18n";
import { Card } from "./ui";

const DAY = 86_400_000;
const dayOf = (i: number) => new Date((Math.floor(Date.now() / DAY) - 29 + i) * DAY).toISOString().slice(0, 10);

export function ScanStats({ t, lang, stats }: { t: Dict; lang: Lang; stats: Stats }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...stats.days);
  const W = 300;
  const H = 96;
  const bw = W / 30;
  return (
    <Card title={t.statsTitle} info={t.infoStats}>
      <dl className="grid grid-cols-3 gap-3">
        {[
          [t.statsTotal, stats.total],
          [t.statsWeek, stats.week],
          [t.statsPeople, stats.people],
        ].map(([label, n], i) => (
          <div key={label} className={`rounded-xl p-3 ${i === 0 ? "bg-stage text-on-stage" : "bg-field"}`}>
            <dt className={`text-xs ${i === 0 ? "text-on-stage/60" : "text-muted"}`}>{label}</dt>
            <dd className={`font-heading text-2xl font-extrabold ${i === 0 ? "text-accent" : ""}`}>{n}</dd>
          </div>
        ))}
      </dl>
      {/* Сканов ещё нет — вместо пустого графика подсказка, что делать. */}
      {stats.total === 0 ? (
        <div className="mt-4 flex items-start gap-3 rounded-xl border border-dashed border-line p-4">
          <svg viewBox="0 0 24 24" className="h-6 w-6 shrink-0 text-muted" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
            <path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M4 12h16" />
          </svg>
          <div className="text-sm">
            <div className="font-semibold">{t.historyEmpty}</div>
            <div className="mt-0.5 text-muted">{t.statsEmptyHint}</div>
          </div>
        </div>
      ) : (
      <>
      <div className="relative mt-4">
        <svg viewBox={`0 0 ${W} ${H + 1}`} className="h-28 w-full" role="img" aria-label={t.statsChart} onMouseLeave={() => setHover(null)}>
          <line x1="0" y1={H + 0.5} x2={W} y2={H + 0.5} className="stroke-line" strokeWidth="1" />
          {stats.days.map((n, i) => {
            const h = n ? Math.max(3, (n / max) * (H - 6)) : 0;
            return (
              <g key={i} onMouseEnter={() => setHover(i)} onFocus={() => setHover(i)} tabIndex={-1}>
                {/* Зона наведения — на всю высоту, больше самого столбика. */}
                <rect x={i * bw} y="0" width={bw} height={H} fill="transparent" />
                {h > 0 && <rect x={i * bw + 1} y={H - h} width={bw - 2} height={h} rx="2" className={hover === i ? "fill-ink" : "fill-accent"} />}
              </g>
            );
          })}
        </svg>
        {hover !== null && (
          <div className="pointer-events-none absolute -top-2 rounded-lg border border-line bg-card px-2.5 py-1.5 text-xs shadow-md" style={{ left: `clamp(0px, calc(${((hover + 0.5) / 30) * 100}% - 48px), calc(100% - 96px))` }}>
            <div className="text-muted">{fmtDate(dayOf(hover), lang)}</div>
            <div className="font-semibold">
              {t.statsScans}: {stats.days[hover]}
            </div>
          </div>
        )}
        <div className="mt-1 flex justify-between text-[11px] text-muted">
          <span>{fmtDate(dayOf(0), lang)}</span>
          <span>{fmtDate(dayOf(29), lang)}</span>
        </div>
      </div>
      <details className="mt-3 text-sm">
        <summary className="cursor-pointer text-muted">{t.statsTable}</summary>
        <table className="mt-2 w-full text-left text-xs">
          <tbody>
            {stats.days
              .map((n, i) => [dayOf(i), n] as const)
              .filter(([, n]) => n > 0)
              .reverse()
              .map(([d, n]) => (
                <tr key={d} className="border-t border-line">
                  <td className="py-1">{fmtDate(d, lang)}</td>
                  <td className="py-1 text-right font-semibold">{n}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </details>
      </>
      )}
    </Card>
  );
}
