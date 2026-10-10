"use client";
// Главная после входа (владелец 09.10.2026): «после входа своя страница не должна быть как до входа — там свой кабинет, где
// сразу видно, какие QR у тебя есть, со своими выключателями; кнопка „создать новый QR“; редактирование и генерация —
// отдельные страницы»; «и нужно, сколько раз сканировали». Каждый код — карточка с выключателем, как на первом экране:
// выключено — сам код, включено — что под ним (то, что увидит человек после скана). Сканы — всего, за неделю и по дням.
import Link from "next/link";
import { useEffect, useState } from "react";
import { api, linkOf, mediaUrl, type CodeList, type CodeView } from "@/lib/codes";
import { fill, type Dict } from "@/lib/i18n";
import { useLang } from "@/lib/lang";
import { useMe } from "@/lib/me";
import { FIELDS } from "@/lib/qr/payload";
import { KindIcon } from "./KindIcon";
import { Upcoming } from "./CodesPage";
import { QrThumb } from "./QrThumb";
import { Notice, Shell } from "./Shell";
import { TypeIcon } from "./TypeIcon";
import { VisBadge } from "./VisBadge";

/** Маленький вертикальный выключатель с ON / OFF на кружке — как большой на первом экране. */
function MiniSwitch({ t, title, open, toggle }: { t: Dict; title: string; open: boolean; toggle: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={open}
      aria-label={`${t.heroSwitch}: ${title}`}
      onClick={toggle}
      className={`relative h-24 w-10 shrink-0 rounded-full border transition-colors sm:h-32 ${open ? "border-accent bg-accent/20" : "border-stage-line bg-white/5 hover:border-on-stage/40"}`}
    >
      <span
        aria-hidden
        className={`absolute left-1/2 top-1 grid h-8 w-8 -translate-x-1/2 place-items-center rounded-full font-mono text-[11px] font-bold shadow-lg transition-[transform,background-color] duration-500 ease-[cubic-bezier(.65,0,.35,1)] ${
          open ? "translate-y-0 bg-accent text-on-accent" : "translate-y-[3.5rem] bg-on-stage text-stage sm:translate-y-[5.5rem]"
        }`}
      >
        {open ? "ON" : "OFF"}
      </span>
    </button>
  );
}

/** Что под кодом — коротко, как увидит человек после скана: содержимое кода или память (записи, фото). */
function Under({ t, code }: { t: Dict; code: CodeView }) {
  if (code.content) {
    const f = code.content.fields;
    const main = FIELDS[code.content.type].map((k) => f[k]).find((v) => v?.trim()) ?? "";
    return (
      <div className="flex h-full flex-col justify-center gap-2 p-2.5 text-left sm:gap-3 sm:p-4">
        <span className="flex items-center gap-2">
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-accent text-on-accent sm:h-9 sm:w-9 sm:rounded-xl">
            <TypeIcon type={code.content.type} className="h-4 w-4 sm:h-5 sm:w-5" />
          </span>
          <span className="hidden font-mono text-[11px] uppercase tracking-[0.14em] text-on-stage/60 sm:inline">{t[`type.${code.content.type}`]}</span>
        </span>
        <span className="line-clamp-3 break-words font-heading text-sm font-extrabold leading-snug sm:text-lg">{main || t.notSetUp}</span>
      </div>
    );
  }
  const blocks = code.blocks ?? [];
  const photos = blocks.filter((b) => b.kind === "photo" && b.media).slice(0, 3);
  const text = blocks.find((b) => b.kind === "text" && b.text.trim())?.text;
  if (!blocks.length)
    return (
      <div className="grid h-full place-items-center p-2.5 text-center sm:p-4">
        <span>
          <span className="block font-heading text-sm font-bold sm:text-base">{code.kind === "link" ? t.notSetUp : t.dashEmptyMemory}</span>
          <span className="mt-1 hidden text-xs text-on-stage/60 sm:block">{t.dashEmptyMemoryHint}</span>
        </span>
      </div>
    );
  return (
    <div className="flex h-full flex-col gap-2 p-2.5 text-left sm:gap-3 sm:p-4">
      <span className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.14em] text-on-stage/60">
        <KindIcon kind={code.kind} className="h-4 w-4 text-accent" />
        {t.records}: {blocks.length}
      </span>
      {photos.length > 0 && (
        <span className="grid grid-cols-3 gap-1.5">
          {photos.map((b) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={b.id} src={mediaUrl(b.media!)} alt="" loading="lazy" className="aspect-square w-full rounded-lg object-cover" />
          ))}
        </span>
      )}
      {text && <span className="line-clamp-3 text-xs leading-relaxed text-on-stage/85 sm:line-clamp-4 sm:text-sm">{text}</span>}
    </div>
  );
}

/** Сканы по дням (последние 30) — тонкие столбики. */
function Spark({ days }: { days: number[] }) {
  const max = Math.max(1, ...days);
  return (
    <span aria-hidden className="flex h-6 w-full max-w-[150px] items-end justify-between gap-px">
      {days.slice(-30).map((d, i) => (
        <span key={i} className={`w-[3px] shrink rounded-sm ${d ? "bg-accent" : "bg-white/15"}`} style={{ height: `${Math.max(12, (d / max) * 100)}%` }} />
      ))}
    </span>
  );
}

/** Сканы кода: всего, за неделю и столбики по дням. На телефоне — столбиком справа от кода, на компьютере — строкой. */
function Scans({ t, code }: { t: Dict; code: CodeView }) {
  const scans = code.stats?.total ?? 0;
  const week = code.stats?.week ?? 0;
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between sm:gap-3">
      <div>
        <div className="flex flex-wrap items-baseline gap-x-1.5">
          <span className="font-heading text-3xl font-extrabold leading-none">{scans}</span>
          <span className="text-sm text-on-stage/70">{t.scansCount.toLowerCase()}</span>
        </div>
        <div className={`mt-1 text-xs ${week ? "font-semibold text-accent" : "text-on-stage/50"}`}>{fill(t.dashWeek, { n: week })}</div>
      </div>
      {code.stats && <Spark days={code.stats.days} />}
    </div>
  );
}

function CodeCard({ t, base, code }: { t: Dict; base: string; code: CodeView }) {
  const [open, setOpen] = useState(false);
  const unread = (code.messages?.filter((m) => !m.read).length ?? 0) + (code.requests?.length ?? 0);
  return (
    <li className="flex flex-col rounded-3xl bg-stage p-3.5 text-on-stage shadow-[0_18px_40px_-24px_rgba(0,0,0,0.6)] sm:p-5">
      <div className="flex items-start gap-3">
        <Link href={`/codes/${code.id}`} className="flex min-h-10 min-w-0 flex-1 items-center hover:text-accent">
          <span className="block truncate font-heading text-lg font-extrabold">{code.title}</span>
        </Link>
        {unread > 0 && <span className="grid h-6 min-w-6 place-items-center rounded-full bg-warn px-1.5 text-xs font-bold text-on-warn">{unread}</span>}
      </div>
      <div className="flex flex-wrap gap-1.5">
        <VisBadge t={t} v={code.visibility} />
        {code.edition && (
          <span className="rounded-full bg-on-stage/10 px-2.5 py-1 text-xs font-semibold">
            № {code.edition.no}
            {code.edition.of !== null ? ` / ${code.edition.of}` : ""}
          </span>
        )}
        {code.lost && <span className="rounded-full bg-warn px-2.5 py-1 text-xs font-semibold text-on-warn">{t.lostMode}</span>}
      </div>

      {/* Телефон: выключатель, код и сканы — одним рядом (карточка вдвое ниже); компьютер: код крупно, сканы под ним. */}
      <div className="mt-3 flex items-center gap-2.5 sm:mt-4 sm:gap-3">
        <div className="flex flex-col items-center gap-1">
          <span className={`w-12 text-center font-mono text-[11px] uppercase leading-tight tracking-[0.04em] ${open ? "text-accent" : "text-on-stage/50"}`}>{t.dashUnderShort}</span>
          <MiniSwitch t={t} title={code.title ?? ""} open={open} toggle={() => setOpen((v) => !v)} />
          <span className={`font-mono text-[11px] uppercase tracking-[0.12em] ${open ? "text-on-stage/50" : "text-on-stage"}`}>QR</span>
        </div>
        <div className="relative aspect-square w-[42%] max-w-40 shrink-0 overflow-hidden rounded-2xl border border-stage-line bg-white/[0.03] sm:w-auto sm:max-w-none sm:min-w-0 sm:flex-1">
          <Under t={t} code={code} />
          {/* Код сверху; включили — уезжает срезом вверх и открывает, что под ним. */}
          <div
            className="absolute inset-0 p-2 transition-[clip-path] duration-700 ease-[cubic-bezier(.65,0,.35,1)] sm:p-3"
            style={{ background: code.style?.bg ?? "#ffffff", clipPath: open ? "inset(0 0 100% 0)" : "inset(0 0 0 0)" }}
            aria-hidden={open}
          >
            <QrThumb link={linkOf(base, code)} style={code.style} className={`h-full w-full ${code.blocked ? "opacity-40" : ""}`} />
          </div>
        </div>
        <div className="min-w-0 flex-1 sm:hidden">
          <Scans t={t} code={code} />
        </div>
      </div>

      <div className="mt-4 hidden sm:block">
        <Scans t={t} code={code} />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 sm:mt-4">
        <Link href={`/codes/${code.id}`} className="grid min-h-11 place-items-center rounded-xl bg-accent px-3 font-heading text-sm font-bold text-on-accent">
          {t.edit}
        </Link>
        <Link href={`/c/${code.id}`} className="grid min-h-11 place-items-center rounded-xl border border-stage-line px-3 text-sm font-semibold hover:border-on-stage/50">
          {t.dashAsGuest}
        </Link>
      </div>
    </li>
  );
}

export function HomeDashboard() {
  const { lang, t } = useLang((t) => `${t.dashTitle} — ${t.appName}`);
  const { me } = useMe();
  const [list, setList] = useState<{ me: string | null; data: CodeList } | null>(null);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let live = true;
    api.list().then((data) => live && setList({ me, data }), () => {});
    return () => {
      live = false;
    };
  }, [me, tick]);
  const data = list?.me === me ? list.data : null;
  const total = data?.mine.reduce((s, c) => s + (c.stats?.total ?? 0), 0) ?? 0;
  const week = data?.mine.reduce((s, c) => s + (c.stats?.week ?? 0), 0) ?? 0;

  return (
    <Shell t={t} lang={lang}>
      <div className="flex flex-wrap items-end gap-x-6 gap-y-4">
        <div className="min-w-0 flex-1 basis-64">
          <h1 className="font-heading text-3xl font-extrabold sm:text-5xl">{t.dashTitle}</h1>
          {data && data.mine.length > 0 && (
            <p className="mt-2 text-sm text-muted">
              {t.navCodes}: <b className="text-ink">{data.mine.length}</b> · {t.dashScansAll}: <b className="text-ink">{total}</b>
              {week > 0 && <span className="ml-1.5 rounded-md bg-accent px-1.5 py-0.5 font-mono text-xs font-bold text-on-accent">+{week}</span>}
            </p>
          )}
        </div>
        <Link href="/create" className="inline-flex min-h-13 w-full items-center justify-center gap-2 rounded-xl bg-accent px-6 font-heading text-base font-bold text-on-accent sm:w-auto">
          <span aria-hidden className="text-xl leading-none">+</span>
          {t.dashNew}
        </Link>
      </div>

      {!data ? (
        <div className="mt-8">
          <Notice>{t.loading}</Notice>
        </div>
      ) : (
        // На телефоне сначала сами коды («сразу видно, какие QR у тебя есть»), напоминания — под ними.
        <div className="mt-6 flex flex-col gap-10 sm:mt-8">
          <div className="order-2 empty:hidden sm:order-none">
            <Upcoming t={t} lang={lang} codes={[...data.mine, ...data.shared]} onDone={() => setTick((n) => n + 1)} />
          </div>
          {data.mine.length ? (
            <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {data.mine.map((c) => (
                <CodeCard key={c.id} t={t} base={data.base} code={c} />
              ))}
              <li>
                <Link
                  href="/create"
                  className="flex h-full min-h-20 items-center justify-center gap-3 rounded-3xl border-2 border-dashed border-line p-4 text-center font-heading font-bold text-muted transition-all hover:-translate-y-1 hover:border-accent-ink hover:text-ink sm:min-h-60 sm:flex-col sm:p-6"
                >
                  <span aria-hidden className="grid h-11 w-11 place-items-center rounded-xl bg-accent text-2xl text-on-accent sm:h-14 sm:w-14 sm:rounded-2xl sm:text-3xl">
                    +
                  </span>
                  {t.dashNew}
                </Link>
              </li>
            </ul>
          ) : (
            <Link href="/create" className="group relative block overflow-hidden rounded-3xl bg-stage p-8 text-on-stage sm:p-12">
              <div aria-hidden className="x-stage-glow" />
              <span className="relative block font-heading text-2xl font-extrabold sm:text-4xl">{t.firstCodeTitle}</span>
              <span className="relative mt-2 block max-w-md text-sm text-on-stage/70">{t.firstCodeText}</span>
              <span className="relative mt-6 inline-flex min-h-12 items-center gap-2 rounded-xl bg-accent px-5 font-heading text-sm font-bold text-on-accent">
                {t.firstCodeCta} <span className="transition-transform group-hover:translate-x-1">→</span>
              </span>
            </Link>
          )}
          {data.shared.length > 0 && <Shared t={t} base={data.base} codes={data.shared} />}
        </div>
      )}
    </Shell>
  );
}

function Shared({ t, base, codes }: { t: Dict; base: string; codes: CodeView[] }) {
  return (
    <section>
      <h2 className="font-heading text-2xl font-extrabold">{t.sharedTitle}</h2>
      <p className="mt-1 text-sm text-muted">{t.sharedHint}</p>
      <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {codes.map((c) => (
          <li key={c.id}>
            <Link href={`/c/${c.id}`} className="block rounded-2xl border border-line bg-card p-3 transition-transform hover:-translate-y-1">
              <span className="block rounded-xl p-2" style={{ background: c.style?.bg ?? "#ffffff" }}>
                <QrThumb link={linkOf(base, c)} style={c.style} className="w-full rounded-md" />
              </span>
              <span className="mt-2 block truncate text-sm font-semibold">{c.title}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
