"use client";
// Условия, конфиденциальность, возвраты — на языке сайта. Внизу — контакты оператора (или «будут указаны при запуске»).
import Link from "next/link";
import { fmtDate } from "@/lib/format";
import { useLang } from "@/lib/lang";
import { LEGAL_DOCS, LEGAL_RU, LEGAL_UPDATED, legalFor, operatorFor, type LegalDoc } from "@/lib/legal";
import { Shell } from "./Shell";

export function LegalPage({ doc }: { doc: LegalDoc }) {
  const { lang, t } = useLang((t) => `${LEGAL_RU[doc].title} — ${t.appName}`);
  const op = operatorFor(lang);
  const d = legalFor(lang)[doc];
  return (
    <Shell t={t} lang={lang} narrow>
      <nav className="flex flex-wrap gap-2 text-sm" aria-label={t.legalNav}>
        {LEGAL_DOCS.map((x) => (
          <Link
            key={x}
            href={`/legal/${x}`}
            aria-current={x === doc ? "page" : undefined}
            className={`grid min-h-10 place-items-center rounded-xl px-3 font-medium ${x === doc ? "bg-card text-ink shadow-sm" : "text-muted hover:text-ink"}`}
          >
            {legalFor(lang)[x].title}
          </Link>
        ))}
      </nav>
      <h1 className="mt-4 font-heading text-3xl font-extrabold tracking-tight">{d.title}</h1>
      <p className="mt-1 text-xs text-muted">
        {t.legalUpdated}: {fmtDate(LEGAL_UPDATED, lang)}
      </p>
      <p className="mt-4">{d.intro}</p>
      <div className="mt-6 space-y-6">
        {d.sections.map((s) => (
          <section key={s.h}>
            <h2 className="font-heading text-lg font-bold">{s.h}</h2>
            {s.p.map((p) => (
              <p key={p} className="mt-2 text-sm leading-relaxed">
                {p}
              </p>
            ))}
          </section>
        ))}
        <section id="contacts" className="rounded-2xl border border-line bg-card p-5">
          <h2 className="font-heading text-lg font-bold">{t.legalContacts}</h2>
          <div className="mt-2 space-y-1 text-sm">
            <p className="font-semibold">{op.name}</p>
            <p>{op.address}</p>
            <p>
              <a href={`mailto:${op.email}`} className="text-accent-ink underline underline-offset-2">
                {op.email}
              </a>
            </p>
          </div>
        </section>
      </div>
    </Shell>
  );
}
