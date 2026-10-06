"use client";
// Настройки кода с памятью (только хозяин): память, кто видит, вид кода.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, linkOf, type CodePatch, type CodeView } from "@/lib/codes";
import type { Dict, Lang } from "@/lib/i18n";
import { useLang } from "@/lib/lang";
import { refreshPeople, useMe } from "@/lib/me";
import { tierOf } from "@/lib/pricing";
import { DEFAULT_STYLE, fromSaved, toSaved } from "@/lib/qr/style";
import { AccessPanel } from "./AccessPanel";
import { ContactPanel } from "./ContactPanel";
import { LinkPanel } from "./LinkPanel";
import { ScanStats } from "./ScanStats";
import { KindIcon } from "./KindIcon";
import { SellBox } from "./Lots";
import { CodeDesigner } from "./CodeDesigner";
import { Memory } from "./Memory";
import { QrThumb } from "./QrThumb";
import { Notice, Shell } from "./Shell";
import type { StyleState } from "./StylePanel";
import { Switch } from "./ui";

type Tab = "memory" | "contact" | "access" | "look" | "link" | "stats";
type Status = "idle" | "saving" | "saved" | "error";

/** Вид кода: тот же конструктор, что в генераторе; изменения сохраняются сами через секунду. */
function LookTab({ t, code, link, save }: { t: Dict; code: CodeView; link: string; save: (p: CodePatch) => Promise<void> }) {
  const [style, setStyle] = useState<StyleState>(() => (code.style ? fromSaved(code.style) : DEFAULT_STYLE));
  const first = useRef(style);
  useEffect(() => {
    if (style === first.current) return;
    const id = setTimeout(() => save({ style: toSaved(style) }), 800);
    return () => clearTimeout(id);
  }, [style, save]);
  // Код с памятью оплачивается один раз за код (ссылка в нём не меняется); стиль красивее — доплата разницы.
  return <CodeDesigner t={t} payload={link} style={style} setStyle={setStyle} fileName={`qr-${code.id}`} gate={{ tier: tierOf(style), key: () => `code:${code.id}` }}
    top={
      <section className="rounded-2xl border border-line bg-card p-5">
        <Switch label={t.compactCode} hint={t.compactHint} checked={code.compact} onChange={(compact) => save({ compact })} />
      </section>
    } side={<p className="px-1 text-sm text-muted">{t.changeAnytime}</p>} />;
}

function TitleField({ t, value, save }: { t: Dict; value: string; save: (p: CodePatch) => Promise<void> }) {
  const [title, setTitle] = useState(value);
  const commit = () => {
    const v = title.trim();
    if (v && v !== value) save({ title: v });
    else setTitle(value);
  };
  return (
    <input
      aria-label={t.titleLabel}
      value={title}
      maxLength={80}
      onChange={(e) => setTitle(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
      className="w-full min-w-0 rounded-xl border border-transparent bg-transparent px-2 py-1 font-heading text-2xl font-extrabold tracking-tight outline-none hover:border-line focus:border-accent focus:bg-field sm:text-3xl"
    />
  );
}

function DeleteCode({ t, id }: { t: Dict; id: string }) {
  const router = useRouter();
  const [sure, setSure] = useState(false);
  return sure ? (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={() => api.remove(id).then(() => router.push("/codes"))}
        className="min-h-11 rounded-xl bg-warn px-4 text-sm font-semibold text-on-warn"
      >
        {t.deleteSure}
      </button>
      <button type="button" onClick={() => setSure(false)} className="min-h-11 rounded-xl px-3 text-sm font-medium text-muted hover:text-ink">
        {t.cancel}
      </button>
    </div>
  ) : (
    <button type="button" onClick={() => setSure(true)} className="min-h-11 rounded-xl px-3 text-sm font-medium text-muted hover:text-warn">
      {t.deleteCode}
    </button>
  );
}

function Editor({ t, lang, me, base, initial }: { t: Dict; lang: Lang; me: string; base: string; initial: CodeView }) {
  const [code, setCode] = useState(initial);
  const [tab, setTab] = useState<Tab>(initial.kind === "memory" ? "memory" : initial.kind === "link" ? "link" : "contact");
  const [status, setStatus] = useState<Status>("idle");
  const link = linkOf(base, code);

  // Одна функция сохранения на всю страницу — чтобы автосохранение вида не перезапускалось.
  const id = initial.id;
  const seq = useRef(0);
  const save = useCallback(
    async (p: CodePatch) => {
      setStatus("saving");
      // Выключатели и выбор отвечают сразу, не дожидаясь сервера; ответ сервера потом поправит, если что.
      setCode((c) => {
        const { title, visibility, people, showOwner, lost, reward, contact, compact, publicAdd } = p;
        return {
          ...c,
          ...(title !== undefined && { title }),
          ...(visibility !== undefined && { visibility }),
          ...(people !== undefined && { people }),
          ...(showOwner !== undefined && { showOwner }),
          ...(compact !== undefined && { compact }),
          ...(p.target !== undefined && { target: p.target || null }),
          ...(publicAdd !== undefined && { publicAdd }),
          ...(lost !== undefined && { lost }),
          ...(reward !== undefined && { reward }),
          ...(contact !== undefined && { contact: { ...contact, phone: contact.phone || null, schedule: contact.schedule ?? null } }),
        };
      });
      // Быстрые изменения подряд: ответ на старое не должен откатить новое — берём только ответ на последнее.
      const n = ++seq.current;
      try {
        const fresh = await api.patch(id, p);
        if (n === seq.current) {
          setCode(fresh);
          setStatus("saved");
        }
      } catch {
        setStatus("error");
        api.get(id).then(setCode, () => {});
      }
    },
    [id],
  );

  const requests = code.requests?.length ?? 0;
  const unread = code.messages?.filter((m) => !m.read).length ?? 0;
  // У машины, ключей и питомца главное — связь: эта вкладка первая.
  const contactTab = { id: "contact" as const, label: t.tabContact, badge: unread };
  // Код-ссылке память и «кто видит» не нужны: скан сразу уходит на адрес хозяина.
  const tabs: { id: Tab; label: string; badge?: number }[] =
    code.kind === "link"
      ? [
          { id: "link", label: t.tabLink },
          { id: "look", label: t.tabLook },
        ]
      : [
          ...(code.kind === "memory" ? [] : [contactTab]),
          { id: "memory", label: t.tabMemory },
          ...(code.kind === "memory" ? [contactTab] : []),
          { id: "access", label: t.tabAccess, badge: requests },
          { id: "stats", label: t.tabStats },
          { id: "look", label: t.tabLook },
        ];

  return (
    <>
      <Link href="/codes" className="inline-flex min-h-10 items-center gap-1 text-sm font-medium text-muted hover:text-ink">
        ← {t.backToCodes}
      </Link>
      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
        <div className="min-w-0 flex-1 basis-64 -ml-2">
          <div className="flex items-center gap-1">
            <span className="grid h-9 w-9 shrink-0 place-items-center text-muted" title={t[`tpl.${code.kind}`]}>
              <KindIcon kind={code.kind} className="h-6 w-6" />
            </span>
            <TitleField key={code.title} t={t} value={code.title ?? ""} save={save} />
            {code.edition && (
              <span className="shrink-0 rounded-full bg-ink px-2.5 py-1 text-xs font-semibold text-bg">
                {code.edition.design === "number" ? t.numberCode : `${t.editionNo} ${code.edition.no}${code.edition.of !== null ? ` / ${code.edition.of}` : ""}`}
              </span>
            )}
          </div>
        </div>
        <span className="text-sm text-muted" aria-live="polite">
          {status === "saving" ? t.saving : status === "saved" ? t.saved : status === "error" ? <span className="text-warn">{t.saveError}</span> : null}
        </span>
      </div>

      {code.blocked && <p className="mt-3 rounded-2xl bg-warn-soft p-4 text-sm font-medium text-warn">⛔ {t.blockedOwner}</p>}

      <div role="tablist" className="mt-4 flex gap-1 overflow-x-auto border-b border-line">
        {tabs.map((x) => (
          <button
            key={x.id}
            type="button"
            role="tab"
            aria-selected={tab === x.id}
            onClick={() => setTab(x.id)}
            className={`-mb-px flex min-h-11 shrink-0 items-center gap-2 border-b-2 px-3 text-sm font-semibold ${tab === x.id ? "border-accent text-ink" : "border-transparent text-muted hover:text-ink"}`}
          >
            {x.label}
            {!!x.badge && <span className="grid h-5 min-w-5 place-items-center rounded-full bg-warn px-1 text-[11px] text-on-warn">{x.badge}</span>}
          </button>
        ))}
      </div>

      <div className="mt-5">
        {tab === "look" ? (
          <LookTab t={t} code={code} link={link} save={save} />
        ) : (
          <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
            <div className="min-w-0">
              {tab === "link" ? (
                <div className="space-y-5">
                  <LinkPanel t={t} code={code} save={save} />
                  {code.stats && <ScanStats t={t} lang={lang} stats={code.stats} />}
                </div>
              ) : tab === "stats" ? (
                code.stats && <ScanStats t={t} lang={lang} stats={code.stats} />
              ) : tab === "memory" ? (
                <Memory t={t} lang={lang} code={code} me={me} onChange={setCode} />
              ) : tab === "contact" ? (
                <ContactPanel t={t} lang={lang} code={code} save={save} />
              ) : (
                <AccessPanel t={t} lang={lang} code={code} base={base} save={save} />
              )}
            </div>
            <div className="order-first space-y-4 lg:sticky lg:top-4 lg:order-none">
            <aside className="rounded-2xl border border-line bg-card p-4">
              <div className="flex gap-4 lg:block">
                <QrThumb link={link} style={code.style} className="h-28 w-28 shrink-0 border border-line lg:h-auto lg:w-full" />
                <div className="min-w-0 lg:mt-3">
                  <div className="break-all font-mono text-xs text-muted">{link}</div>
                  <a href={`/c/${code.id}`} target="_blank" rel="noreferrer" className="mt-2 inline-grid min-h-10 place-items-center rounded-xl border border-line bg-field px-3 text-sm font-medium hover:border-muted">
                    {t.openAsScan} ↗
                  </a>
                  <p className="mt-2 text-xs text-muted">{t.changeAnytime}</p>
                </div>
              </div>
            </aside>
            {code.edition && <SellBox t={t} code={code} />}
            </div>
          </div>
        )}
      </div>

      <div className="mt-10 border-t border-line pt-5">
        <DeleteCode t={t} id={code.id} />
      </div>
    </>
  );
}

export function CodeEditor({ id }: { id: string }) {
  const { lang, t } = useLang((t) => `${t.navCodes} — ${t.appName}`);
  const { ready, me, base } = useMe();
  const [state, setState] = useState<{ me: string; code: CodeView | null; error?: boolean } | null>(null);

  useEffect(() => {
    if (!me) return;
    let live = true;
    api
      .get(id)
      .then((code) => refreshPeople().then(() => live && setState({ me, code })))
      .catch((e: Error) => live && setState({ me, code: null, error: e.message !== "404" }));
    return () => {
      live = false;
    };
  }, [id, me]);
  const loaded = state?.me === me ? state : null;

  return (
    <Shell t={t} lang={lang}>
      {!ready ? null : !me ? (
        <div className="rounded-2xl border border-line bg-card p-6 text-center">
          <Link href={`/login?next=/codes/${id}`} className="inline-grid min-h-11 place-items-center rounded-xl bg-accent px-5 text-sm font-semibold text-on-accent">
            {t.login}
          </Link>
        </div>
      ) : !loaded ? (
        <Notice>{t.loading}</Notice>
      ) : loaded.error ? (
        <Notice>{t.loadError}</Notice>
      ) : !loaded.code ? (
        <Notice>{t.notFound}</Notice>
      ) : loaded.code.access !== "owner" ? (
        <div className="rounded-2xl border border-line bg-card p-6 text-center">
          <Link href={`/c/${id}`} className="inline-grid min-h-11 place-items-center rounded-xl border border-line bg-field px-5 text-sm font-semibold">
            {loaded.code.title ?? t.notFound} →
          </Link>
        </div>
      ) : (
        <Editor key={loaded.code.id + me} t={t} lang={lang} me={me} base={base} initial={loaded.code} />
      )}
    </Shell>
  );
}
