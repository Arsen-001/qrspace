"use client";
// «Пожаловаться» на код: мошенничество, спам, оскорбления. Можно без входа; решает администратор.
import { useState } from "react";
import { api, REPORT_REASONS, type ReportReason } from "@/lib/codes";
import type { Dict } from "@/lib/i18n";

export function ReportBox({ t, id }: { t: Dict; id: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ReportReason>("phishing");
  const [text, setText] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "sent" | "limit" | "error">("idle");
  if (state === "sent") return <p className="text-xs font-medium text-ok">✓ {t.reportSent}</p>;
  if (!open)
    return (
      <button type="button" onClick={() => setOpen(true)} className="min-h-11 px-2 text-sm text-muted underline underline-offset-2 hover:text-warn sm:min-h-9 sm:text-xs">
        {t.reportCode}
      </button>
    );
  return (
    <form
      className="w-full max-w-md space-y-2 rounded-2xl border border-line bg-card p-4 text-left"
      onSubmit={async (e) => {
        e.preventDefault();
        setState("busy");
        try {
          await api.report(id, reason, text);
          setState("sent");
        } catch (err) {
          setState((err as Error).message === "429" ? "limit" : "error");
        }
      }}
    >
      <div className="text-sm font-semibold text-ink">{t.reportCode}</div>
      <div role="radiogroup" aria-label={t.reportCode} className="flex flex-wrap gap-1.5">
        {REPORT_REASONS.map((r) => (
          <button
            key={r}
            type="button"
            role="radio"
            aria-checked={reason === r}
            onClick={() => setReason(r)}
            className={`min-h-9 rounded-xl border px-3 text-xs font-medium ${reason === r ? "border-accent bg-accent text-on-accent" : "border-line bg-field text-ink"}`}
          >
            {t[`reason.${r}`]}
          </button>
        ))}
      </div>
      <textarea value={text} rows={2} maxLength={1000} placeholder={t.reportDetails} aria-label={t.reportDetails} onChange={(e) => setText(e.target.value)} className="w-full resize-y rounded-xl border border-line bg-field px-3 py-2 text-sm text-ink" />
      {state === "limit" && <p className="text-xs text-warn">{t.sendLimit}</p>}
      {state === "error" && <p className="text-xs text-warn">{t.sendError}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={state === "busy"} className="min-h-10 rounded-xl bg-warn px-4 text-sm font-semibold text-white disabled:opacity-50">
          {t.reportSend}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="min-h-10 rounded-xl px-3 text-sm text-muted hover:text-ink">
          {t.cancel}
        </button>
      </div>
    </form>
  );
}
