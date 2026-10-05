"use client";
// «Связь» (только хозяин): сообщения через нас, номер по выключателю, имя хозяина, режим «Потеряно».
import { useState } from "react";
import type { CodePatch, CodeView, Message } from "@/lib/codes";
import { fmtDateTime } from "@/lib/format";
import { fill, type Dict, type Lang } from "@/lib/i18n";
import { Avatar, personName } from "./Avatar";
import { Card, Switch } from "./ui";

const input = "w-full rounded-xl border border-line bg-field px-3.5 py-2.5 text-base outline-none transition-colors focus:border-accent";

/** Поле, которое сохраняется, когда из него вышли (или нажали Enter). */
function BlurField({ label, value, placeholder, type = "text", onSave }: { label: string; value: string; placeholder?: string; type?: string; onSave: (v: string) => void }) {
  const [v, setV] = useState(value);
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-muted">{label}</span>
      <input
        type={type}
        value={v}
        placeholder={placeholder}
        maxLength={60}
        onChange={(e) => setV(e.target.value)}
        onBlur={() => v.trim() !== value && onSave(v.trim())}
        onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
        className={input}
      />
    </label>
  );
}

export const messageTitle = (t: Dict, m: Message) => (m.preset ? t[`preset.${m.preset}` as keyof Dict] : null);

function Inbox({ t, lang, messages, save }: { t: Dict; lang: Lang; messages: Message[]; save: (p: CodePatch) => Promise<void> }) {
  const unread = messages.filter((m) => !m.read).length;
  return (
    <Card title={t.inboxTitle}>
      {messages.length === 0 ? (
        <p className="text-sm text-muted">{t.inboxEmpty}</p>
      ) : (
        <>
          <ul className="divide-y divide-line">
            {messages.map((m) => (
              <li key={m.id} className="flex gap-3 py-3">
                <Avatar id={m.from} lang={lang} size={32} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-2 text-xs text-muted">
                    <span className="font-medium text-ink">{m.from ? personName(m.from, lang) : t.guest}</span>
                    <span>{fmtDateTime(m.at, lang)}</span>
                    {!m.read && <span className="rounded-full bg-warn px-1.5 py-0.5 text-[11px] font-semibold text-white">{t.newMark}</span>}
                  </div>
                  {messageTitle(t, m) && <div className="mt-1 font-semibold">{messageTitle(t, m)}</div>}
                  {m.text && <p className="mt-0.5 whitespace-pre-wrap break-words text-sm">{m.text}</p>}
                  {m.place && (
                    <a href={`https://maps.google.com/?q=${m.place.lat},${m.place.lon}`} target="_blank" rel="noreferrer" className="mt-1 inline-block text-xs font-semibold text-accent underline underline-offset-2">
                      📍 {t.openMap}
                    </a>
                  )}
                  <div className="mt-1 text-xs text-muted">
                    {t.inboxReply}: {m.reply ? <span className="select-all font-medium text-ink">{m.reply}</span> : t.inboxNoReply}
                  </div>
                </div>
                <button type="button" onClick={() => save({ removeMessage: m.id })} className="min-h-9 shrink-0 self-start rounded-lg px-2 text-xs font-medium text-muted hover:text-warn">
                  {t.delete}
                </button>
              </li>
            ))}
          </ul>
          {unread > 0 && (
            <button type="button" onClick={() => save({ readMessages: true })} className="mt-2 min-h-10 rounded-xl border border-line bg-field px-4 text-sm font-medium hover:border-muted">
              ✓ {t.markAllRead}
            </button>
          )}
        </>
      )}
    </Card>
  );
}

export function ContactPanel({ t, lang, code, save }: { t: Dict; lang: Lang; code: CodeView; save: (p: CodePatch) => Promise<void> }) {
  const phone = code.contact.phone ?? "";
  const schedule = code.contact.schedule ?? { on: false, from: "08:00", to: "22:00", tz: Intl.DateTimeFormat().resolvedOptions().timeZone };
  const contact = { enabled: code.contact.enabled, phone, showPhone: code.contact.showPhone, schedule };
  // Часовой пояс — того, кто настраивает: «с 8 до 22» по его времени.
  const setSchedule = (p: Partial<typeof schedule>) => save({ contact: { ...contact, schedule: { ...schedule, ...p, tz: Intl.DateTimeFormat().resolvedOptions().timeZone } } });
  const canLose = code.kind === "lost" || code.kind === "pet";
  return (
    <div className="space-y-5">
      {code.contact.enabled && <Inbox t={t} lang={lang} messages={code.messages ?? []} save={save} />}

      <Card title={t.contactTitle}>
        <div className="space-y-5">
          <Switch label={t.contactEnable} hint={t.contactHint} checked={code.contact.enabled} onChange={(enabled) => save({ contact: { ...contact, enabled } })} />
          <div className="space-y-4 border-t border-line pt-5">
            <div>
              <BlurField key={phone} label={t.phoneLabel} type="tel" value={phone} placeholder="+374 …" onSave={(p) => save({ contact: { ...contact, phone: p, showPhone: contact.showPhone && !!p } })} />
              <p className="mt-1.5 text-xs text-muted">{t.phoneHint}</p>
            </div>
            <div className={`rounded-xl p-4 ${code.contact.showPhone ? "bg-ok-soft" : "bg-field"}`}>
              <Switch
                label={t.showPhone}
                hint={!phone ? t.showPhoneNeedsNumber : code.contact.showPhone ? t.showPhoneOn : t.showPhoneOff}
                checked={code.contact.showPhone}
                disabled={!phone}
                onChange={(showPhone) => save({ contact: { ...contact, showPhone } })}
              />
              {code.contact.showPhone && (
                <div className="mt-4 space-y-3 border-t border-black/5 pt-4">
                  <Switch label={t.byScheduleLabel} hint={schedule.on ? fill(t.byScheduleOn, { from: schedule.from, to: schedule.to }) : t.byScheduleOff} checked={schedule.on} onChange={(on) => setSchedule({ on })} />
                  {schedule.on && (
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <input type="time" aria-label={t.fromTime} value={schedule.from} onChange={(e) => e.target.value && setSchedule({ from: e.target.value })} className="min-h-10 rounded-xl border border-line bg-card px-3" />
                      <span>—</span>
                      <input type="time" aria-label={t.toTime} value={schedule.to} onChange={(e) => e.target.value && setSchedule({ to: e.target.value })} className="min-h-10 rounded-xl border border-line bg-card px-3" />
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </Card>

      <Card title={t.privacyTitle}>
        <Switch label={t.showOwner} hint={t.showOwnerHint} checked={code.showOwner} onChange={(showOwner) => save({ showOwner })} />
      </Card>

      {canLose && (
        <Card title={t.lostMode}>
          <div className="space-y-4">
            <div className={`rounded-xl p-4 ${code.lost ? "bg-warn-soft" : "bg-field"}`}>
              <Switch
                label={t.lostMode}
                hint={code.lost ? t.lostOn : t[`lostHint.${code.kind === "pet" ? "pet" : "lost"}`]}
                checked={code.lost}
                onChange={(lost) => save({ lost })}
              />
            </div>
            <BlurField key={code.reward} label={t.rewardLabel} value={code.reward} placeholder={t.rewardPlaceholder} onSave={(reward) => save({ reward })} />
          </div>
        </Card>
      )}
    </div>
  );
}
