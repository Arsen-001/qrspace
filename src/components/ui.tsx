"use client";
// Мелкие элементы формы — один вид на всём сайте.
import { useId, useRef, type ReactNode } from "react";

export function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-line bg-card p-5 sm:p-6">
      <h2 className="mb-4 font-heading text-lg font-bold">{title}</h2>
      {children}
    </section>
  );
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
