"use client";
// «Кто видит»: все / выбранные люди / только я; список людей с правами и сроком; просьбы; приглашение; кто открывал.
import { useState, type ReactNode } from "react";
import { api, codeLink, type CodePatch, type CodeView, type Grant, type Role, type Visibility } from "@/lib/codes";
import { fmtDate, fmtDateTime } from "@/lib/format";
import { refreshPeople } from "@/lib/me";
import type { Dict, Lang } from "@/lib/i18n";
import { Avatar, personName } from "./Avatar";
import { ContactsBox } from "./ContactsBox";
import { Card, Switch } from "./ui";
import { VisIcon } from "./VisBadge";

const today = () => new Date().toISOString().slice(0, 10);
const small = "min-h-10 rounded-xl border border-line bg-field px-3 text-sm";

function Row({ id, lang, children, sub }: { id: string | null; lang: Lang; children?: ReactNode; sub?: ReactNode }) {
  return (
    <li className="flex flex-wrap items-center gap-3 py-3">
      <Avatar id={id} lang={lang} size={36} />
      <div className="min-w-0 flex-1">
        <div className="font-medium">{personName(id, lang)}</div>
        {sub && <div className="text-xs text-muted">{sub}</div>}
      </div>
      {children}
    </li>
  );
}

export function AccessPanel({ t, lang, code, base, save }: { t: Dict; lang: Lang; code: CodeView; base: string; save: (p: CodePatch) => Promise<void> }) {
  const people = code.people ?? [];
  const requests = code.requests ?? [];
  const visits = code.visits ?? [];
  const [email, setEmail] = useState("");
  const [addError, setAddError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const invite = `${codeLink(base, code.id)}?invite=${code.invite}`;

  const setPeople = (next: Grant[]) => save({ people: next });
  const patchGrant = (id: string, p: Partial<Grant>) => setPeople(people.map((g) => (g.personId === id ? { ...g, ...p } : g)));
  // Человек должен хотя бы раз войти (через Google или Apple) — тогда его можно найти по почте.
  const addByEmail = async () => {
    setAddError(null);
    try {
      const { id } = await api.lookup(email.trim());
      if (id === code.owner || people.some((g) => g.personId === id)) return setAddError(t.alreadyAdded);
      await setPeople([...people, { personId: id, role: "view", until: null }]);
      await refreshPeople();
      setEmail("");
    } catch {
      setAddError(t.notRegistered);
    }
  };

  return (
    <div className="space-y-5">
      <Card title={t.visTitle}>
        <div role="radiogroup" aria-label={t.visTitle} className="grid gap-2 sm:grid-cols-2">
          {(["all", "contacts", "people", "me"] as Visibility[]).map((v) => (
            <button
              key={v}
              type="button"
              role="radio"
              aria-checked={code.visibility === v}
              onClick={() => save({ visibility: v })}
              className={`flex min-w-0 items-start gap-3 rounded-xl border p-3 text-left transition-colors ${
                code.visibility === v ? "border-accent bg-accent text-on-accent" : "border-line bg-field hover:border-muted"
              }`}
            >
              <VisIcon v={v} className="mt-0.5 h-5 w-5" />
              <span className="min-w-0">
                <span className="block text-sm font-semibold">{t[`vis.${v}`]}</span>
                <span className={`mt-0.5 block text-xs ${code.visibility === v ? "opacity-85" : "text-muted"}`}>{t[`visHint.${v}`]}</span>
              </span>
            </button>
          ))}
        </div>
      </Card>

      {(code.visibility === "all" || code.visibility === "contacts") && (
        <section className="rounded-2xl border border-line bg-card p-5">
          <Switch label={t.publicAddLabel} hint={t.publicAddHint} checked={code.publicAdd} onChange={(publicAdd) => save({ publicAdd })} />
        </section>
      )}
      {code.visibility === "contacts" && <ContactsBox t={t} lang={lang} />}

      {requests.length > 0 && (
        <Card title={t.requestsTitle}>
          <ul className="divide-y divide-line">
            {requests.map((r) => (
              <Row key={r.personId} id={r.personId} lang={lang} sub={fmtDateTime(r.at, lang)}>
                <div className="flex gap-2">
                  <button type="button" onClick={() => save({ approve: r.personId })} className="min-h-10 rounded-xl bg-accent px-4 text-sm font-semibold text-on-accent">
                    {t.approve}
                  </button>
                  <button type="button" onClick={() => save({ decline: r.personId })} className="min-h-10 rounded-xl px-3 text-sm font-medium text-muted hover:text-ink">
                    {t.decline}
                  </button>
                </div>
              </Row>
            ))}
          </ul>
        </Card>
      )}

      <Card title={t.peopleTitle}>
        {code.visibility !== "people" && <p className="mb-3 rounded-xl bg-field p-3 text-sm text-muted">{t.peopleOffHint}</p>}
        {people.length === 0 ? (
          <p className="text-sm text-muted">{t.noPeople}</p>
        ) : (
          <ul className="divide-y divide-line">
            {people.map((g) => {
              const expired = !!g.until && g.until < today();
              return (
                <Row key={g.personId} id={g.personId} lang={lang} sub={g.until ? `${t.until} ${fmtDate(g.until, lang)}${expired ? ` · ${t.expired}` : ""}` : t.untilNone}>
                  <div className="flex w-full flex-wrap gap-2 sm:w-auto">
                    <select
                      aria-label={personName(g.personId, lang)}
                      value={g.role}
                      onChange={(e) => patchGrant(g.personId, { role: e.target.value as Role })}
                      className={`${small} w-full min-w-0 sm:w-auto`}
                    >
                      <option value="view">{t["role.view"]}</option>
                      <option value="edit">{t["role.edit"]}</option>
                    </select>
                    <input
                      type="date"
                      aria-label={t.until}
                      title={t.until}
                      value={g.until ?? ""}
                      min={today()}
                      onChange={(e) => patchGrant(g.personId, { until: e.target.value || null })}
                      className={`${small} min-w-0 flex-1 sm:w-40 sm:flex-none`}
                    />
                    <button
                      type="button"
                      onClick={() => setPeople(people.filter((x) => x.personId !== g.personId))}
                      className="min-h-10 rounded-xl px-3 text-sm font-medium text-muted hover:text-warn"
                    >
                      {t.removePerson}
                    </button>
                  </div>
                </Row>
              );
            })}
          </ul>
        )}
        <form
          className="mt-4 border-t border-line pt-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (email.trim()) addByEmail();
          }}
        >
          <div className="flex flex-wrap gap-2">
            <input
              type="email"
              value={email}
              placeholder={t.addByEmail}
              aria-label={t.addByEmail}
              onChange={(e) => setEmail(e.target.value)}
              className={`${small} min-w-0 flex-1 text-base`}
              autoComplete="off"
            />
            <button type="submit" disabled={!email.trim()} className="min-h-10 rounded-xl bg-accent px-4 text-sm font-semibold text-on-accent disabled:opacity-40">
              + {t.addPerson}
            </button>
          </div>
          {addError && <p className="mt-2 text-sm text-warn">{addError}</p>}
          <p className="mt-2 text-xs text-muted">{t.addPersonHint}</p>
        </form>
      </Card>

      <Card title={t.inviteTitle}>
        <p className="mb-3 text-sm text-muted">{t.inviteHint}</p>
        <div className="flex flex-wrap gap-2">
          <input readOnly value={invite} onFocus={(e) => e.target.select()} className={`${small} min-w-0 flex-1 font-mono text-xs`} aria-label={t.inviteTitle} />
          <button
            type="button"
            onClick={() => {
              navigator.clipboard?.writeText(invite).then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              });
            }}
            className="min-h-10 rounded-xl border border-line bg-field px-4 text-sm font-medium hover:border-muted"
          >
            {copied ? t.copied : t.copy}
          </button>
        </div>
        <button type="button" onClick={() => save({ newInvite: true })} className="mt-2 min-h-10 rounded-xl text-sm font-medium text-muted hover:text-ink">
          ↻ {t.newInvite}
        </button>
      </Card>

      <Card title={t.historyTitle}>
        {visits.length === 0 ? (
          <p className="text-sm text-muted">{t.historyEmpty}</p>
        ) : (
          <ul className="divide-y divide-line">
            {visits.map((v, i) => (
              <li key={i} className="flex items-center gap-3 py-2.5">
                <Avatar id={v.personId} lang={lang} size={28} />
                <span className="min-w-0 flex-1 text-sm">
                  <span className="font-medium">{v.personId ? personName(v.personId, lang) : t.guest}</span>
                  <span className={v.allowed ? "text-muted" : "text-warn"}> · {v.allowed ? t.historyAllowed : t.historyDenied}</span>
                </span>
                <span className="shrink-0 text-xs text-muted">{fmtDateTime(v.at, lang)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
