"use client";
// Что в коде (сайт, телефон, Wi-Fi…): меняется когда угодно — напечатанный код остаётся тем же, скан покажет новое.
import { useState } from "react";
import type { CodePatch, CodeView } from "@/lib/codes";
import type { Dict } from "@/lib/i18n";
import { buildPayload, cleanContent, CONTENT_TYPES, problemsOf, type ContentType, type Fields } from "@/lib/qr/payload";
import { ContentForm } from "./ContentForm";

export function LinkPanel({ t, code, save }: { t: Dict; code: CodeView; save: (p: CodePatch) => Promise<void> }) {
  const initial = code.content ?? { type: "url" as const, fields: {} };
  const [type, setType] = useState<ContentType>(initial.type);
  const [fields, setFields] = useState(() => {
    const f = Object.fromEntries(CONTENT_TYPES.map((k) => [k, {}])) as Record<ContentType, Fields>;
    f.wifi = { security: "WPA" };
    f[initial.type] = { ...f[initial.type], ...initial.fields };
    return f;
  });
  const [state, setState] = useState<"idle" | "bad" | "saved">("idle");
  const current = { type, fields: fields[type] };
  const changed = JSON.stringify(cleanContent(current)) !== JSON.stringify(code.content);
  // Ошибка, с которой скан вёл бы в никуда (номер без цифр, WhatsApp без кода страны…), — не сохраняем; что не так — под полем.
  const stop = problemsOf(type, fields[type]).some((p) => p.block);
  const commit = async () => {
    const ct = cleanContent(current);
    if (!ct) return setState("bad");
    await save({ content: ct });
    setState("saved");
  };
  return (
    <ContentForm
      t={t}
      type={type}
      fields={fields[type]}
      onType={(x) => {
        setType(x);
        setState("idle");
      }}
      onField={(k, v) => {
        setFields((f) => ({ ...f, [type]: { ...f[type], [k]: v } }));
        setState("idle");
      }}
      footer={
        <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-line pt-4">
          <button
            type="button"
            disabled={!buildPayload(type, fields[type]) || !changed || stop}
            onClick={commit}
            className="min-h-11 rounded-xl bg-accent px-5 font-heading text-sm font-bold text-on-accent disabled:opacity-40"
          >
            {t.save}
          </button>
          <span className="text-sm text-muted" aria-live="polite">
            {state === "bad" ? <span className="text-warn">{t.linkBad}</span> : state === "saved" ? `✓ ${t.saved}` : code.content ? t.linkHint : t.linkEmpty}
          </span>
        </div>
      }
    />
  );
}
