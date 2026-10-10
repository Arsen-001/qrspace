"use client";
import { useState } from "react";
import type { Dict } from "@/lib/i18n";
import { CONTENT_GROUPS, FIELDS, type ContentGroup, type ContentType, type Fields } from "@/lib/qr/payload";
import { TypeIcon } from "./TypeIcon";
import { Card, Segmented, TextField } from "./ui";

const PLACEHOLDER: Partial<Record<string, string>> = {
  url: "example.com",
  phone: "+374 91 123456",
  username: "@username",
  email: "name@example.com",
  website: "example.com",
  place: "Yerevan, Northern Ave 1 · 40.1811, 44.5136",
};

const INPUT_MODE: Partial<Record<string, "tel" | "email" | "url">> = {
  url: "url",
  website: "url",
  phone: "tel",
  email: "email",
};

export function ContentForm({
  t,
  type,
  fields,
  onType,
  onField,
  step,
  footer,
}: {
  t: Dict;
  type: ContentType;
  fields: Fields;
  onType: (t: ContentType) => void;
  onField: (k: string, v: string) => void;
  /** Номер шага в генераторе. */
  step?: number;
  /** Что под полями (в коде — «Сохранить»). */
  footer?: React.ReactNode;
}) {
  const [showPass, setShowPass] = useState(false);
  return (
    <Card title={t.step1} step={step} info={t.infoStep1}>
      <div className="space-y-4">
        {(Object.keys(CONTENT_GROUPS) as ContentGroup[]).map((g) => (
          <div key={g}>
            <div className="mb-2 font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">{t[`group.${g}`]}</div>
            <div role="radiogroup" aria-label={t[`group.${g}`]} className="grid grid-cols-3 gap-2 sm:grid-cols-6">
              {CONTENT_GROUPS[g].map((id) => {
                const on = type === id;
                return (
                  <button
                    key={id}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => onType(id)}
                    className={`flex min-w-0 flex-col items-center gap-1.5 rounded-xl border px-1 pb-2 pt-2.5 text-xs font-semibold leading-tight transition-all ${
                      on ? "border-stage bg-stage text-on-stage shadow-[0_6px_18px_-8px_rgba(0,0,0,0.5)]" : "border-line bg-field hover:-translate-y-0.5 hover:border-muted"
                    }`}
                  >
                    <TypeIcon type={id} className={`h-6 w-6 ${on ? "text-accent" : ""}`} />
                    <span className="max-w-full text-center break-words">{t[`type.${id}`]}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-5 flex items-center gap-3 rounded-xl border border-dashed border-line px-3.5 py-3 text-sm" aria-live="polite">
        <TypeIcon type={type} className="h-5 w-5 shrink-0 text-accent-ink" />
        <span>{t[`hint.${type}`]}</span>
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {FIELDS[type].map((k) => {
          const label = t[`field.${k}` as keyof Dict];
          const value = fields[k] ?? "";
          const set = (v: string) => onField(k, v);
          const wide = ["url", "text", "body", "message", "title", "place", "notes"].includes(k) || FIELDS[type].length === 1;
          if (k === "security") {
            return (
              <div key={k} className="sm:col-span-2">
                <div className="mb-1.5 text-sm font-medium text-muted">{label}</div>
                <Segmented
                  value={value || "WPA"}
                  onChange={set}
                  options={(["WPA", "WEP", "nopass"] as const).map((id) => ({ id, label: t[`security.${id}`] }))}
                />
              </div>
            );
          }
          if (k === "password" && fields.security === "nopass") return null;
          return (
            <div key={k} className={wide ? "sm:col-span-2" : ""}>
              <TextField
                label={label}
                value={value}
                onChange={set}
                multiline={k === "text" || k === "body" || k === "notes"}
                placeholder={PLACEHOLDER[k]}
                inputMode={INPUT_MODE[k]}
                type={k === "password" && !showPass ? "password" : k === "start" || k === "end" ? "datetime-local" : "text"}
                trailing={
                  k === "password" ? (
                    <button type="button" onClick={() => setShowPass((s) => !s)} className="x-hit rounded-lg px-2 py-1 text-xs font-medium text-muted hover:text-ink">
                      {t.showPassword}
                    </button>
                  ) : undefined
                }
              />
            </div>
          );
        })}
      </div>
      {footer}
    </Card>
  );
}
