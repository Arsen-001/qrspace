"use client";
// Мелкие элементы формы — один вид на всём сайте.
import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";

/** step — номер шага в генераторе (кружок перед заголовком). */
export function Card({ title, step, children }: { title: string; step?: number; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-line bg-card p-5 sm:p-6">
      <h2 className="mb-4 flex items-center gap-3 font-heading text-lg font-bold">
        {step && <StepBadge n={step} />}
        {title}
      </h2>
      {children}
    </section>
  );
}

export function StepBadge({ n }: { n: number }) {
  return <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-stage font-mono text-sm font-bold text-accent">{n}</span>;
}

export function Label({ children, hint }: { children: ReactNode; hint?: string }) {
  return (
    <div className="mb-2">
      <div className="text-sm font-semibold">{children}</div>
      {hint && <div className="mt-0.5 text-xs text-muted">{hint}</div>}
    </div>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  wrap,
}: {
  value: T;
  options: { id: T; label: ReactNode }[];
  onChange: (v: T) => void;
  wrap?: boolean;
}) {
  return (
    <div role="radiogroup" className={`flex gap-1.5 ${wrap ? "flex-wrap" : ""}`}>
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          role="radio"
          aria-checked={value === o.id}
          onClick={() => onChange(o.id)}
          className={`min-h-10 min-w-0 rounded-xl border px-2.5 text-sm leading-tight font-medium transition-colors ${
            value === o.id ? "border-accent bg-accent text-on-accent" : "border-line bg-field hover:border-muted"
          } ${wrap ? "" : "flex-1"}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function TextField({
  label,
  value,
  onChange,
  multiline,
  type = "text",
  placeholder,
  trailing,
  inputMode,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  multiline?: boolean;
  type?: string;
  placeholder?: string;
  trailing?: ReactNode;
  inputMode?: "text" | "tel" | "email" | "url";
}) {
  const id = useId();
  const cls =
    "w-full rounded-xl border border-line bg-field px-3.5 py-2.5 text-base outline-none transition-colors focus:border-accent";
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-muted">
        {label}
      </label>
      <div className="relative">
        {multiline ? (
          <textarea id={id} value={value} rows={4} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} className={`${cls} resize-y`} />
        ) : (
          <input
            id={id}
            value={value}
            type={type}
            inputMode={inputMode}
            placeholder={placeholder}
            onChange={(e) => onChange(e.target.value)}
            className={`${cls} ${trailing ? "pr-24" : ""}`}
            autoComplete="off"
            spellCheck={false}
          />
        )}
        {trailing && <div className="absolute inset-y-0 right-2 flex items-center">{trailing}</div>}
      </div>
    </div>
  );
}

export function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const id = useId();
  return (
    <label htmlFor={id} className="flex min-w-0 flex-1 cursor-pointer items-center gap-2.5 rounded-xl border border-line bg-field p-2 hover:border-muted">
      <span className="relative h-8 w-8 shrink-0 overflow-hidden rounded-lg border border-line" style={{ background: value }}>
        <input id={id} type="color" value={value} onChange={(e) => onChange(e.target.value)} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-xs text-muted">{label}</span>
        <span className="hidden font-mono text-sm uppercase sm:block">{value}</span>
      </span>
    </label>
  );
}

export function Slider({
  label,
  hint,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  hint?: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium">
        {label}
      </label>
      {hint && <div className="mb-1.5 text-xs text-muted">{hint}</div>}
      <input id={id} type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full accent-[var(--accent)]" />
    </div>
  );
}

export function UploadButton({ label, onFile, onFiles, multiple }: { label: string; onFile?: (f: File) => void; onFiles?: (f: File[]) => void; multiple?: boolean }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <>
      <button type="button" onClick={() => ref.current?.click()} className="min-h-10 rounded-xl border border-line bg-field px-4 text-sm font-medium hover:border-muted">
        {label}
      </button>
      <input
        ref={ref}
        type="file"
        multiple={multiple}
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(e) => {
          const list = [...(e.target.files ?? [])];
          if (list.length) {
            onFiles?.(list);
            onFile?.(list[0]);
          }
          e.target.value = "";
        }}
      />
    </>
  );
}

export function GhostButton({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="min-h-10 rounded-xl px-3 text-sm font-medium text-muted hover:text-ink">
      {children}
    </button>
  );
}

/** Выключатель «вкл/выкл» с подписью и пояснением. */
export function Switch({ label, hint, checked, disabled, onChange }: { label: ReactNode; hint?: ReactNode; checked: boolean; disabled?: boolean; onChange: (v: boolean) => void }) {
  const id = useId();
  return (
    <label htmlFor={id} className={`flex items-start justify-between gap-4 ${disabled ? "opacity-50" : "cursor-pointer"}`}>
      <span className="min-w-0">
        <span className="block text-sm font-semibold">{label}</span>
        {hint && <span className="mt-0.5 block text-xs text-muted">{hint}</span>}
      </span>
      <span className="relative mt-0.5 inline-flex shrink-0">
        <input id={id} type="checkbox" role="switch" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} className="peer sr-only" />
        <span className="h-7 w-12 rounded-full bg-line transition-colors peer-checked:bg-ok peer-focus-visible:ring-2 peer-focus-visible:ring-accent" />
        <span className="absolute left-1 top-1 h-5 w-5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-5" />
      </span>
    </label>
  );
}

/** Круглая галочка «Сделано» — как в списке дел: не занимает строку, видна сразу. */
export function DoneCheck({ label, busy, onClick }: { label: string; busy?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      disabled={busy}
      onClick={onClick}
      aria-label={label}
      title={label}
      className="group grid h-10 w-10 shrink-0 place-items-center rounded-full border-2 border-ok/50 text-ok transition-colors hover:border-ok hover:bg-ok hover:text-on-ok disabled:opacity-50"
    >
      <svg viewBox="0 0 24 24" className="h-5 w-5 opacity-40 transition-opacity group-hover:opacity-100" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="m5 12.5 4.5 4.5L19 7.5" />
      </svg>
    </button>
  );
}

export type SelectOption<T extends string> = { id: T; label: ReactNode; /** Текст для поиска по первым буквам, если label не строка. */ text?: string };

/**
 * Выпадающий список в нашем стиле вместо нативного <select>: кнопка как наши поля, список — карточка с тенью,
 * выбранный пункт с лаймовой отметкой. Клавиатура: ↑ ↓ Home End, Enter/пробел — выбрать, Esc — закрыть,
 * первые буквы — перейти к пункту; клик снаружи закрывает, фокус возвращается на кнопку.
 */
export function Select<T extends string>({
  value,
  onChange,
  options,
  label,
  compact,
  className = "",
  disabled,
}: {
  value: T;
  onChange: (v: T) => void;
  options: SelectOption<T>[];
  /** Подпись для чтения с экрана (видимую подпись ставьте рядом). */
  label: string;
  compact?: boolean;
  className?: string;
  disabled?: boolean;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [place, setPlace] = useState<{ up: boolean; right: boolean }>({ up: false, right: false });
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const typed = useRef({ text: "", at: 0 });
  const current = options.find((o) => o.id === value) ?? options[0];
  const textOf = (o: SelectOption<T>) => (o.text ?? (typeof o.label === "string" ? o.label : String(o.id))).toLowerCase();

  const show = (at = Math.max(0, options.findIndex((o) => o.id === value))) => {
    setActive(at);
    setOpen(true);
  };
  const close = (focus = true) => {
    setOpen(false);
    if (focus) button.current?.focus();
  };
  const pick = (i: number) => {
    const o = options[i];
    if (o && o.id !== value) onChange(o.id);
    close();
  };

  // Где открыть: не вылезать за край экрана справа и снизу (на телефоне — вверх, если внизу мало места).
  useLayoutEffect(() => {
    if (!open || !root.current || !list.current) return;
    const b = root.current.getBoundingClientRect();
    const h = list.current.offsetHeight;
    const w = list.current.offsetWidth;
    setPlace({ up: b.bottom + h + 8 > innerHeight && b.top > h + 8, right: b.left + w > innerWidth - 8 });
    list.current.focus();
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => !root.current?.contains(e.target as Node) && close(false);
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [open]);
  useEffect(() => {
    if (open) list.current?.querySelector(`[data-i="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [open, active]);

  const onListKey = (e: React.KeyboardEvent) => {
    const last = options.length - 1;
    const keys: Record<string, () => void> = {
      ArrowDown: () => setActive((a) => Math.min(last, a + 1)),
      ArrowUp: () => setActive((a) => Math.max(0, a - 1)),
      Home: () => setActive(0),
      End: () => setActive(last),
      Enter: () => pick(active),
      " ": () => pick(active),
      Escape: () => close(),
      Tab: () => close(false),
    };
    if (keys[e.key]) {
      if (e.key !== "Tab") e.preventDefault();
      keys[e.key]();
      return;
    }
    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
      const now = e.timeStamp;
      typed.current = { text: (now - typed.current.at < 600 ? typed.current.text : "") + e.key.toLowerCase(), at: now };
      const i = options.findIndex((o) => textOf(o).startsWith(typed.current.text) || o.id.toLowerCase().startsWith(typed.current.text));
      if (i >= 0) setActive(i);
    }
  };

  return (
    <div ref={root} className={`relative ${className}`}>
      <button
        ref={button}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={`${id}-list`}
        aria-label={label}
        onClick={() => (open ? close() : show())}
        onKeyDown={(e) => {
          if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) {
            e.preventDefault();
            show();
          }
        }}
        className={`flex w-full min-w-0 items-center justify-between gap-2 rounded-xl border bg-field text-left outline-none transition-colors hover:border-muted focus-visible:border-ink disabled:opacity-50 ${
          open ? "border-ink" : "border-line"
        } ${compact ? "min-h-10 px-3 text-sm font-medium" : "min-h-11 px-3.5 text-base"}`}
      >
        <span className="min-w-0 truncate">{current?.label}</span>
        <svg viewBox="0 0 24 24" className={`h-4 w-4 shrink-0 text-muted transition-transform ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      {open && (
        <ul
          ref={list}
          id={`${id}-list`}
          role="listbox"
          tabIndex={-1}
          aria-label={label}
          aria-activedescendant={`${id}-o${active}`}
          onKeyDown={onListKey}
          className={`x-pop absolute z-50 max-h-72 min-w-full overflow-auto rounded-xl border border-line bg-card p-1 shadow-[0_18px_40px_-14px_rgba(0,0,0,0.4)] outline-none ${
            place.up ? "bottom-full mb-1.5 origin-bottom" : "top-full mt-1.5 origin-top"
          } ${place.right ? "right-0" : "left-0"}`}
          style={{ maxWidth: "calc(100vw - 32px)" }}
        >
          {options.map((o, i) => {
            const sel = o.id === value;
            return (
              <li
                key={o.id}
                id={`${id}-o${i}`}
                data-i={i}
                role="option"
                aria-selected={sel}
                onPointerEnter={() => setActive(i)}
                onClick={() => pick(i)}
                className={`flex min-h-10 cursor-pointer items-center gap-2.5 whitespace-nowrap rounded-lg px-3 text-sm ${i === active ? "bg-field" : ""} ${sel ? "font-semibold" : ""}`}
              >
                <span aria-hidden className={`grid h-4 w-4 shrink-0 place-items-center rounded ${sel ? "bg-accent text-on-accent" : ""}`}>
                  {sel && (
                    <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="m5 12.5 4.5 4.5L19 7.5" />
                    </svg>
                  )}
                </span>
                {o.label}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
