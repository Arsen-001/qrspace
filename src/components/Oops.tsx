"use client";
// «Тут ничего нет» (удалённый код, неверная ссылка) и «Что-то пошло не так» — в нашем виде и на языке человека.
import Link from "next/link";
import { useLang } from "@/lib/lang";
import { Shell } from "./Shell";

export function Oops({ retry }: { retry?: () => void }) {
  const { lang, t } = useLang((t) => `${retry ? t.errTitle : t.nfTitle} — ${t.appName}`);
  return (
    <Shell t={t} lang={lang}>
      <section className="mx-auto mt-6 max-w-3xl overflow-hidden rounded-2xl bg-stage p-6 text-on-stage sm:mt-12 sm:p-10">
        <p className="font-mono text-sm text-accent">{retry ? "500" : "404"}</p>
        <h1 className="mt-3 font-heading text-3xl font-extrabold tracking-tight text-balance sm:text-5xl">{retry ? t.errTitle : t.nfTitle}</h1>
        <p className="mt-4 max-w-lg opacity-80">{retry ? t.errText : t.nfText}</p>
        <div className="mt-8 flex flex-wrap gap-3">
          {retry ? (
            <button type="button" onClick={retry} className="inline-grid min-h-11 place-items-center rounded-xl bg-accent px-5 font-semibold text-on-accent">
              {t.errRetry}
            </button>
          ) : (
            <Link href="/#make" className="inline-grid min-h-11 place-items-center rounded-xl bg-accent px-5 font-semibold text-on-accent">
              {t.makeYours} →
            </Link>
          )}
          <Link href="/" className="inline-grid min-h-11 place-items-center rounded-xl border border-stage-line px-5 hover:border-on-stage font-semibold">
            {t.nfHome}
          </Link>
        </div>
      </section>
    </Shell>
  );
}
