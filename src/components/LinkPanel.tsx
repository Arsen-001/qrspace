"use client";
// Код-ссылка: куда ведёт скан. Адрес меняется когда угодно — напечатанный код остаётся тем же.
import { useState } from "react";
import type { CodePatch, CodeView } from "@/lib/codes";
import type { Dict } from "@/lib/i18n";
import { Card } from "./ui";

export function LinkPanel({ t, code, save }: { t: Dict; code: CodeView; save: (p: CodePatch) => Promise<void> }) {
  const [target, setTarget] = useState(code.target ?? "");
  const [bad, setBad] = useState(false);
  const commit = () => {
    let v = target.trim();
    if (v && !/^https?:\/\//i.test(v)) v = `https://${v}`;
    if (v && !/^https?:\/\/[^\s]+\.[^\s]+/i.test(v)) return setBad(true);
    setBad(false);
    setTarget(v);
    if (v !== (code.target ?? "")) save({ target: v });
  };
  return (
    <Card title={t.linkTitle}>
      <p className="mb-3 text-sm text-muted">{t.linkHint}</p>
      <form
        className="flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          commit();
        }}
      >
        <input
          // Не type="url": браузер не пустил бы «menu.am» без https:// — дописываем сами.
          type="text"
          inputMode="url"
          value={target}
          placeholder="https://"
          aria-label={t.linkTitle}
          onChange={(e) => setTarget(e.target.value)}
          className="min-h-11 min-w-0 flex-1 rounded-xl border border-line bg-field px-3.5 text-base outline-none focus:border-accent"
          autoComplete="off"
          spellCheck={false}
        />
        <button type="submit" className="min-h-11 rounded-xl bg-accent px-4 text-sm font-semibold text-on-accent">
          {t.save}
        </button>
      </form>
      {bad && <p className="mt-2 text-sm text-warn">{t.linkBad}</p>}
      {code.target ? (
        <p className="mt-3 break-all text-xs text-muted">
          {t.linkNow}:{" "}
          <a href={code.target} target="_blank" rel="noreferrer" className="font-medium text-accent-ink underline underline-offset-2">
            {code.target}
          </a>
        </p>
      ) : (
        <p className="mt-3 text-xs text-warn">{t.linkEmpty}</p>
      )}
    </Card>
  );
}
