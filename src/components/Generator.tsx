"use client";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { api, SAMPLE_SHORT, shownLink } from "@/lib/codes";
import { fill, type Dict } from "@/lib/i18n";
import { buildPayload, CONTENT_TYPES, FIELDS, missingOf, problemsOf, type ContentType, type Fields } from "@/lib/qr/payload";
import { buildDrawing } from "@/lib/qr/render";
import { LOGO_FOR } from "@/lib/qr/logo-art";
import { codeKey, tierOf } from "@/lib/pricing";
import { DEFAULT_STYLE, fromSaved, toQrStyle, toSaved } from "@/lib/qr/style";
import { useLang } from "@/lib/lang";
import { rememberColors, useMe } from "@/lib/me";
import { isDesigner } from "@/lib/people";
import { CodeDesigner } from "./CodeDesigner";
import { ContentForm } from "./ContentForm";
import { PublishBox } from "./PublishBox";
import { SiteFooter } from "./SiteFooter";
import { SiteHeader } from "./SiteHeader";
import type { StyleState } from "./StylePanel";

/** Генератор кода: содержимое → вид → скачать. Своя страница /create; главная — витрина со ссылкой сюда. */
export function Generator() {
  const { lang, t } = useLang((t) => `${t.makeTitle} — ${t.appName}`);

  const [type, setType] = useState<ContentType>("url");
  const [fields, setFields] = useState(() => {
    const f = Object.fromEntries(CONTENT_TYPES.map((k) => [k, {}])) as Record<ContentType, Fields>;
    f.wifi = { security: "WPA" };
    return f;
  });
  const [style, setStyle] = useState<StyleState>(DEFAULT_STYLE);
  // Вход через Google/Apple уводит со страницы — перед этим запоминаем, что человек настроил, и возвращаем после входа.
  const DRAFT = "qrspace.draft";
  const saveDraft = () => {
    try {
      sessionStorage.setItem(DRAFT, JSON.stringify({ type, fields, style: toSaved(style) }));
    } catch {}
  };
  useEffect(() => {
    let d: { type: ContentType; fields: Record<ContentType, Fields>; style: ReturnType<typeof toSaved> } | null = null;
    try {
      d = JSON.parse(sessionStorage.getItem(DRAFT) ?? "null");
      sessionStorage.removeItem(DRAFT);
    } catch {}
    if (!d || !CONTENT_TYPES.includes(d.type)) return;
    // Черновик есть только в браузере — на сервере его нет, поэтому ставим после загрузки.
    /* eslint-disable react-hooks/set-state-in-effect */
    setType(d.type);
    setFields((f) => ({ ...f, ...d.fields }));
    setStyle(fromSaved(d.style));
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);
  const raw = buildPayload(type, fields[type]);
  const { me, base, colors } = useMe();
  // Последние цвета аккаунта — по умолчанию (владелец 08.10.2026), если человек ещё ничего не менял.
  const recent = colors[0];
  const [usedRecent, setUsedRecent] = useState<string | null>(null);
  if (recent && usedRecent !== me && style === DEFAULT_STYLE) {
    setUsedRecent(me);
    setStyle({ ...DEFAULT_STYLE, fg: recent.fg, bg: recent.bg, eyeColor: recent.fg, eyeBallColor: recent.fg });
  }
  // Любой наш код ведёт через нашу короткую ссылку, скан открывает нашу страницу с содержимым и кнопками (и Wi-Fi,
  // контакт, событие — решение владельца 08.10.2026). В предпросмотре — образец той же длины, настоящая — при скачивании.
  const sample = `${(base || "https://qrspace.co").toUpperCase()}/K/${SAMPLE_SHORT}`;
  const tier = tierOf(style);
  // Отпечаток вида считаем, только когда вид меняется (с фото это сотни килобайт), а не на каждую букву.
  const look = useMemo(() => codeKey("", toSaved(style)), [style]);
  const key = useMemo(() => codeKey(raw, look), [raw, look]);
  // Ошибка в шаге 1, с которой код вёл бы в никуда, — скачать нельзя, объясняем; не хватает поля — какого.
  const f = fields[type];
  const stop = useMemo(() => problemsOf(type, f).find((p) => p.block), [type, f]);
  const missing = missingOf(type, f);
  const typed = FIELDS[type].some((k) => k !== "security" && (f[k] ?? "").trim());
  const blocked = stop ? `${t.fixStep1}. ${t[stop.key]}` : undefined;
  // Каждое скачивание по новой оплате — новый код, даже с тем же содержимым: код — свой маленький домен (владелец
  // 10.10.2026). Код, созданный в этот заход, пока ничего не меняли, — он же (PNG, потом SVG), без новой оплаты;
  // в предпросмотре — уже он, с настоящей ссылкой.
  const [made, setMade] = useState<{ key: string; id: string; link: string } | null>(null);
  const fresh = useRef<typeof made>(null);
  const ready = made?.key === key ? made : null;
  const payload = ready ? ready.link : sample;

  return (
    <div>
      <div className="mx-auto w-full max-w-6xl px-4 pb-16 sm:px-6">
        <SiteHeader t={t} lang={lang} />

        {/* Генератор — своя страница (владелец 09.10.2026: «хочу, чтобы генератор QR был отдельной страницей»). */}
        <div id="make" className="scroll-mt-6 pb-6 pt-4 sm:pt-6">
          <h1 className="font-heading text-3xl font-extrabold sm:text-5xl">{t.makeTitle}</h1>
          <p className="mt-3 flex items-center gap-2 text-sm text-muted">
            <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <rect x="5" y="11" width="14" height="10" rx="2" />
              <path d="M8 11V8a4 4 0 0 1 8 0v3" />
            </svg>
            {t.privacy}
          </p>
        </div>

        <CodeDesigner
          t={t}
          payload={payload}
          style={style}
          setStyle={setStyle}
          sample={!raw}
          note={raw ? (ready ? null : t.draftNote) : (blocked ?? (missing && typed ? fill(t.fillField, { f: t[`field.${missing}` as keyof Dict] }) : null))}
          suggestLogo={LOGO_FOR[type]}
          steps
          gate={{
            tier,
            key: () => key,
            made: !!ready,
            blocked,
            beforeLogin: saveDraft,
            onSaved: () => {
              rememberColors(style.fg, style.bg);
              if (fresh.current) setMade(fresh.current);
            },
            finalize: async () => {
              if (ready) return { drawing: buildDrawing(ready.link, toQrStyle(style)), payload: ready.link };
              const { id, link } = await api.quick({ content: { type, fields: fields[type] }, style: toSaved(style), key });
              fresh.current = { key, id, link };
              return { drawing: buildDrawing(link, toQrStyle(style)), payload: link };
            },
          }}
          top={
            <ContentForm
              t={t}
              step={1}
              type={type}
              fields={fields[type]}
              onType={setType}
              onField={(k, v) => setFields((f) => ({ ...f, [type]: { ...f[type], [k]: v } }))}
            />
          }
          side={
            <>
              {ready && <MadeBox t={t} id={ready.id} link={ready.link} />}
              {isDesigner(me) ? (
                <PublishBox t={t} style={style} base={base} />
              ) : (
                <section className="flex gap-4 rounded-2xl bg-stage p-5 text-on-stage">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-accent text-on-accent" aria-hidden>
                    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 11a8 8 0 0 0-14.3-4.9L4 8M4 4v4h4M4 13a8 8 0 0 0 14.3 4.9L20 16M20 20v-4h-4" />
                    </svg>
                  </span>
                  <div className="min-w-0">
                    {/* Короткое «Под вашим контролем» — заголовком, длинное объяснение — обычным текстом (на телефоне иначе стена жирного). */}
                    <h2 className="font-heading text-base font-bold">{t.viaText}</h2>
                    <p className="mt-1 text-sm leading-relaxed text-on-stage/70">{t.viaTitle}</p>
                    {me && (
                      <Link href="/codes" className="mt-3 inline-flex min-h-10 items-center gap-1.5 text-sm font-semibold text-accent hover:underline">
                        {t.viaCta} →
                      </Link>
                    )}
                  </div>
                </section>
              )}
            </>
          }
        />

        <SiteFooter t={t} lang={lang} />
      </div>
    </div>
  );
}

/** Код создан: его своя ссылка (как маленький домен) и переход к нему — менять содержимое, память, кто видит. */
function MadeBox({ t, id, link }: { t: Dict; id: string; link: string }) {
  // Появляется под кнопками скачивания — на телефоне подвинуть в видимую часть.
  const ref = useRef<HTMLElement>(null);
  // Фигурные скобки: в новых браузерах scrollIntoView возвращает обещание, а React принял бы его за уборку эффекта.
  useEffect(() => {
    ref.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, []);
  return (
    <section ref={ref} className="rounded-2xl border-2 border-accent bg-card p-5" aria-label={t.madeTitle}>
      <h2 className="flex items-center gap-2.5 font-heading text-lg font-bold">
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-accent text-sm text-on-accent" aria-hidden>
          ✓
        </span>
        {t.madeTitle}
      </h2>
      <p className="mt-3 break-all rounded-xl bg-field px-3.5 py-2.5 font-mono text-base font-bold">{shownLink(link)}</p>
      <p className="mt-3 text-sm leading-relaxed text-muted">{t.madeText}</p>
      <Link href={`/codes/${id}`} className="mt-4 inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-stage px-4 text-sm font-semibold text-on-stage">
        {t.madeOpen} →
      </Link>
    </section>
  );
}
