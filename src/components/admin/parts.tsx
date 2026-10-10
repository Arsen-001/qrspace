"use client";
// Общие кусочки кабинета администратора: заголовок раздела, поиск с фильтрами, плашки, пустой список.
import { useEffect, useState, type ReactNode } from "react";
import type { Provider } from "@/lib/admin";
import type { Dict } from "@/lib/i18n";

export const money = (n: number) => `$${Math.round(n * 100) / 100}`;
export const providerLabel = (t: Dict, p: Provider) => (p === "google" ? "Google" : p === "apple" ? "Apple" : p === "review" ? "App Review" : t.demoAccount);

/** Кнопки кабинета: не ниже 40px (телефон), опасное действие — оранжевым. */
export const btn = "inline-flex min-h-10 shrink-0 items-center justify-center gap-1.5 rounded-xl px-3 text-sm font-semibold transition-colors disabled:opacity-50";
export const btnGhost = `${btn} border border-line bg-field hover:border-muted`;
export const btnWarn = `${btn} bg-warn text-on-warn`;
/** Первый шаг опасного действия (дальше — подтверждение сплошной оранжевой): в длинных списках не рябит. */
export const btnWarnSoft = `${btn} border border-line bg-field text-warn hover:border-warn`;
export const btnMain = `${btn} bg-stage text-on-stage hover:brightness-110`;
export const field = "block min-h-11 w-full rounded-xl border border-line bg-field px-3.5 text-base outline-none focus:border-accent";

export function Pill({ children, tone = "plain" }: { children: ReactNode; tone?: "plain" | "warn" | "ok" | "dark" | "accent" }) {
  const cls = {
    plain: "border border-line bg-card text-muted",
    warn: "bg-warn-soft text-warn",
    ok: "bg-ok-soft text-ok",
    dark: "bg-stage text-on-stage",
    accent: "bg-accent text-on-accent",
  }[tone];
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${cls}`}>{children}</span>;
}

export function AdminSection({ title, note, action, children }: { title: string; note?: ReactNode; action?: ReactNode; children: ReactNode }) {
  return (
    <section>
      <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1">
        <h2 className="font-heading text-xl font-extrabold sm:text-2xl">{title}</h2>
        {action && <div className="ml-auto">{action}</div>}
      </div>
      {note && <p className="-mt-1 mb-3 text-sm text-muted">{note}</p>}
      {children}
    </section>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="rounded-2xl border-2 border-dashed border-line p-6 text-center text-sm text-muted">{children}</p>;
}

/** Плитка с цифрой; main — тёмная с лаймом (главная цифра раздела). */
export function Tile({ label, value, main, onClick }: { label: string; value: ReactNode; main?: boolean; onClick?: () => void }) {
  const cls = `min-w-0 rounded-2xl p-4 text-left ${main ? "bg-stage text-on-stage" : "border border-line bg-card"}`;
  const body = (
    <>
      <span className={`block break-words text-xs leading-snug ${main ? "text-on-stage/60" : "text-muted"}`}>{label}</span>
      <span className={`mt-1 block truncate font-heading text-2xl font-extrabold ${main ? "text-accent" : ""}`}>{value}</span>
    </>
  );
  return onClick ? (
    <button type="button" onClick={onClick} className={`${cls} transition-colors hover:border-muted`}>
      {body}
    </button>
  ) : (
    <div className={cls}>{body}</div>
  );
}

/** Строка поиска, которая не дёргает сервер на каждую букву (ждёт 250 мс). */
export function useDebounced<T>(value: T, ms = 250): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setV(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return v;
}

/** Поиск и фильтры-кнопки над списком. */
export function SearchBar<F extends string>({
  label,
  q,
  onQ,
  filters,
  filter,
  onFilter,
}: {
  label: string;
  q: string;
  onQ: (v: string) => void;
  filters: { id: F; label: string }[];
  filter: F;
  onFilter: (f: F) => void;
}) {
  return (
    <div className="mb-4 space-y-2">
      <input type="search" value={q} onChange={(e) => onQ(e.target.value)} placeholder={label} aria-label={label} maxLength={100} className={field} />
      <div className="x-noscrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
        {filters.map((f) => (
          <button
            key={f.id}
            type="button"
            aria-pressed={filter === f.id}
            onClick={() => onFilter(f.id)}
            className={`min-h-10 shrink-0 rounded-full px-4 text-sm font-semibold transition-colors ${filter === f.id ? "bg-stage text-on-stage" : "border border-line bg-card text-muted hover:text-ink"}`}
          >
            {f.label}
          </button>
        ))}
      </div>
    </div>
  );
}
