"use client";
// Напоминания под кодом: что и когда сделать, «Сделано» (срок переносится сам), кто и когда делал.
import { useState } from "react";
import { api, daysLeft, REPEATS, todayYmd, type CodeView, type Repeat, type Task } from "@/lib/codes";
import { fmtDate, fmtDateTime, fmtDays } from "@/lib/format";
import type { Dict, Lang } from "@/lib/i18n";
import { personName } from "./Avatar";
import { DoneCheck, Select } from "./ui";

const field = "w-full min-w-0 rounded-xl border border-line bg-field px-3.5 py-2.5 text-base outline-none transition-colors focus:border-accent";

/** «просрочено · 3 дня назад» / «сегодня» / «через 5 дней» — с цветом. */
export function DueNote({ t, lang, due }: { t: Dict; lang: Lang; due: string }) {
  const days = daysLeft(due);
  const cls = days < 0 ? "text-warn font-semibold" : days === 0 ? "text-ok font-semibold" : "text-muted";
  return (
    <span className={cls}>
      {days < 0 && `${t.overdue} · `}
      {/* Далёкий срок — просто дата: «через 365 дней» читать неудобно. */}
      {days > 30 ? fmtDate(due, lang) : fmtDays(days, lang)}
      {Math.abs(days) > 1 && days <= 30 && ` · ${fmtDate(due, lang)}`}
    </span>
  );
}

function Row({ t, lang, me, code, task, canEdit, onChange }: { t: Dict; lang: Lang; me: string | null; code: CodeView; task: Task; canEdit: boolean; onChange: (v: CodeView) => void }) {
  const [busy, setBusy] = useState(false);
  const last = task.done.at(-1);
  const run = async (fn: () => Promise<CodeView>) => {
    setBusy(true);
    try {
      onChange(await fn());
    } finally {
      setBusy(false);
    }
  };
  return (
    <li className="flex items-start gap-3 py-3">
      {canEdit && <DoneCheck label={`${t.markDone}: ${task.text}`} busy={busy} onClick={() => run(() => api.doneTask(code.id, task.id))} />}
      <div className="min-w-0 flex-1 pt-1.5">
        <div className="font-medium">{task.text}</div>
        <div className="mt-0.5 text-xs">
          <DueNote t={t} lang={lang} due={task.due} />
          {task.every !== "none" && <span className="text-muted"> · {t[`repeat.${task.every}`]}</span>}
        </div>
        {last && (
          <div className="mt-0.5 text-xs text-muted">
            {t.lastDone}: {fmtDateTime(last.at, lang)}
            {last.by && ` · ${last.by === me ? t.you : personName(last.by, lang)}`}
          </div>
        )}
      </div>
      {canEdit && (
        <div className="flex gap-1">
          <button type="button" disabled={busy} onClick={() => run(() => api.removeTask(code.id, task.id))} aria-label={`${t.delete}: ${task.text}`} className="min-h-10 rounded-xl px-2.5 text-sm text-muted hover:text-warn">
            ×
          </button>
        </div>
      )}
    </li>
  );
}

function AddTask({ t, code, onChange }: { t: Dict; code: CodeView; onChange: (v: CodeView) => void }) {
  const [text, setText] = useState("");
  const [due, setDue] = useState(todayYmd());
  const [every, setEvery] = useState<Repeat>("none");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  return (
    <form
      className="mt-3 grid gap-2 border-t border-line pt-4 sm:grid-cols-[minmax(0,1fr)_150px_170px_auto]"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!text.trim() || !due) return;
        setBusy(true);
        setError(false);
        try {
          onChange(await api.addTask(code.id, { text, due, every }));
          setText("");
        } catch {
          setError(true);
        } finally {
          setBusy(false);
        }
      }}
    >
      <input value={text} maxLength={120} placeholder={t.taskPlaceholder} aria-label={t.taskPlaceholder} onChange={(e) => setText(e.target.value)} className={field} />
      <input type="date" value={due} aria-label={t.taskDue} onChange={(e) => setDue(e.target.value)} className={field} />
      <Select label={t.taskRepeat} value={every} onChange={(v) => setEvery(v as Repeat)} options={REPEATS.map((r) => ({ id: r, label: t[`repeat.${r}`] }))} />
      <button type="submit" disabled={busy || !text.trim()} className="min-h-11 rounded-xl bg-accent px-4 text-sm font-semibold text-on-accent disabled:opacity-40">
        + {t.addTask}
      </button>
      {error && <p className="text-sm text-warn sm:col-span-4">{t.saveError}</p>}
    </form>
  );
}

export function Tasks({ t, lang, me, code, onChange }: { t: Dict; lang: Lang; me: string | null; code: CodeView; onChange: (v: CodeView) => void }) {
  const tasks = code.tasks ?? [];
  // Где «гости добавляют свои фото» (свадьба), напоминания — дело хозяина, гостям их форма не нужна.
  const canEdit = code.access === "owner" || (code.access === "edit" && !code.publicAdd);
  if (!tasks.length && !canEdit) return null;
  return (
    <section className="mb-3 rounded-2xl border border-line bg-card p-4 sm:p-5">
      <h2 className="font-heading text-lg font-bold">{t.tasksTitle}</h2>
      <p className="mt-0.5 text-xs text-muted">{t.tasksHint}</p>
      {tasks.length > 0 ? (
        <ul className="mt-1 divide-y divide-line">
          {tasks.map((task) => (
            <Row key={task.id} t={t} lang={lang} me={me} code={code} task={task} canEdit={canEdit} onChange={onChange} />
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-muted">{t.noTasks}</p>
      )}
      {canEdit && <AddTask t={t} code={code} onChange={onChange} />}
    </section>
  );
}
