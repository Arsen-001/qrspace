"use client";
import { memo, useMemo, useState } from "react";
import { fill, type Dict } from "@/lib/i18n";
import { CONTENT_GROUPS, FIELDS, limitOf, problemsOf, type ContentGroup, type ContentType, type Fields, type Problem } from "@/lib/qr/payload";
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
/** Поля, где заглавная буква и автозамена клавиатуры только мешают. */
const PLAIN = ["url", "website", "phone", "email", "username", "ssid", "password"];

/** Что не так в поле — под полем: ошибка (скачать нельзя) или подсказка, с готовым исправлением, если оно есть. */
export function ProblemNote({ t, type, p, onFix }: { t: Dict; type: ContentType; p: Problem; onFix?: () => void }) {
  return (
    <p role={p.block ? "alert" : undefined} className={`flex flex-wrap items-center gap-x-2 gap-y-1 text-sm leading-snug ${p.block ? "font-medium text-warn" : "text-muted"}`}>
      {/* Длинная почта в подсказке переносится где угодно — иначе на узком телефоне распирает карточку. */}
      <span className="min-w-0 [overflow-wrap:anywhere]">
        <span aria-hidden>! </span>
        {fill(t[p.key], { fix: p.arg ?? "", site: p.arg ?? "", type: t[`type.${type}`], nopass: t["security.nopass"] })}
      </span>
      {p.fix && onFix && (
        <button type="button" onClick={onFix} className="inline-flex min-h-10 items-center rounded-lg px-1 font-semibold text-accent-ink underline underline-offset-2">
          {t.fixIt}
        </button>
      )}
    </p>
  );
}

/** Плитки видов содержимого. memo: пока печатают в поле, плитки (18 значков) не перерисовываются. */
const TypeTiles = memo(function TypeTiles({ t, type, onType }: { t: Dict; type: ContentType; onType: (t: ContentType) => void }) {
  return (
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
                    on ? "border-accent/70 bg-stage text-on-stage shadow-[0_6px_18px_-8px_rgba(0,0,0,0.5)]" : "border-line bg-field hover:-translate-y-0.5 hover:border-muted"
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
  );
});

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
  // Ошибку в поле показываем, когда человек из него вышел (пока печатает впервые — не мешаем); дальше — пока не исправит.
  const [touched, setTouched] = useState<string[]>([]);
  const problems = useMemo(() => problemsOf(type, fields), [type, fields]);
  return (
    <Card title={t.step1} step={step} info={t.infoStep1}>
      <TypeTiles t={t} type={type} onType={onType} />
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
          // Подсказка о пустом поле (Wi-Fi без пароля) — уже когда вышли из соседнего: в пустом поле никто не печатает.
          const seen = touched.includes(`${type}:${k}`) || (!value && touched.some((x) => x.startsWith(`${type}:`)));
          const problem = seen ? problems.find((p) => p.field === k) : undefined;
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
                maxLength={limitOf(k)}
                plain={PLAIN.includes(k)}
                // Конец события — не раньше начала: календарь телефона сам не даст выбрать раньше.
                min={k === "end" ? fields.start || undefined : undefined}
                invalid={problem?.block}
                note={problem && <ProblemNote t={t} type={type} p={problem} onFix={problem.fix ? () => set(problem.fix!) : undefined} />}
                onBlur={() => !touched.includes(`${type}:${k}`) && setTouched((x) => [...x, `${type}:${k}`])}
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
