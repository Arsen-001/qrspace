"use client";
// «Мои контакты»: список людей (по почте), общий для всех кодов с видимостью «Мои контакты».
import { useEffect, useState } from "react";
import { api } from "@/lib/codes";
import { refreshPeople, useMe } from "@/lib/me";
import type { Dict, Lang } from "@/lib/i18n";
import { Avatar, personName } from "./Avatar";
import { Card } from "./ui";

export function ContactsBox({ t, lang }: { t: Dict; lang: Lang }) {
  useMe(); // имена перерисуются, когда обновятся
  const [list, setList] = useState<string[] | null>(null);
  const [email, setEmail] = useState("");
  const [error, setError] = useState(false);
  useEffect(() => {
    let live = true;
    api.contacts().then((l) => live && setList(l), () => {});
    return () => {
      live = false;
    };
  }, []);
  return (
    <Card title={t.contactsTitle}>
      <p className="mb-3 text-sm text-muted">{t.contactsHint}</p>
      {list && list.length === 0 && <p className="text-sm text-muted">{t.noContacts}</p>}
      {list && list.length > 0 && (
        <ul className="divide-y divide-line">
          {list.map((id) => (
            <li key={id} className="flex items-center gap-3 py-2.5">
              <Avatar id={id} lang={lang} size={32} />
              <span className="min-w-0 flex-1 font-medium">{personName(id, lang)}</span>
              <button type="button" onClick={async () => setList(await api.removeContact(id))} className="min-h-10 rounded-xl px-3 text-sm font-medium text-muted hover:text-warn">
                {t.removePerson}
              </button>
            </li>
          ))}
        </ul>
      )}
      <form
        className="mt-3 flex flex-wrap gap-2 border-t border-line pt-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setError(false);
          try {
            const next = await api.addContact(email);
            await refreshPeople();
            setList(next);
            setEmail("");
          } catch {
            setError(true);
          }
        }}
      >
        <input type="email" value={email} placeholder={t.addByEmail} aria-label={t.addByEmail} onChange={(e) => setEmail(e.target.value)} className="min-h-10 min-w-0 flex-1 rounded-xl border border-line bg-field px-3 text-base" />
        <button type="submit" disabled={!email.trim()} className="min-h-10 rounded-xl bg-accent px-4 text-sm font-semibold text-on-accent disabled:opacity-40">
          + {t.addPerson}
        </button>
        {error && <p className="w-full text-sm text-warn">{t.notRegistered}</p>}
      </form>
    </Card>
  );
}
