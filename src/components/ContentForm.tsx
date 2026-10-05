"use client";
import { useState } from "react";
import type { Dict } from "@/lib/i18n";
import { CONTENT_GROUPS, FIELDS, type ContentGroup, type ContentType, type Fields } from "@/lib/qr/payload";
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
}: {
  t: Dict;
  type: ContentType;
  fields: Fields;
  onType: (t: ContentType) => void;
  onField: (k: string, v: string) => void;
}) {
  const [showPass, setShowPass] = useState(false);
  return (
    <Card title={t.step1}>
      <div className="space-y-3">
        {(Object.keys(CONTENT_GROUPS) as ContentGroup[]).map((g) => (
          <div key={g}>
            <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">{t[`group.${g}`]}</div>
            <Segmented wrap value={type} onChange={onType} options={CONTENT_GROUPS[g].map((id) => ({ id, label: t[`type.${id}`] }))} />
          </div>
        ))}
      </div>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
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
                    <button type="button" onClick={() => setShowPass((s) => !s)} className="rounded-lg px-2 py-1 text-xs font-medium text-muted hover:text-ink">
                      {t.showPassword}
                    </button>
                  ) : undefined
                }
              />
            </div>
          );
        })}
      </div>
    </Card>
  );
}
