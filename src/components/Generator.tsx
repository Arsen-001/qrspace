"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/codes";
import { buildPayload, CONTENT_TYPES, type ContentType, type Fields } from "@/lib/qr/payload";
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
  const sample = `${(base || "https://qrspace.co").toUpperCase()}/K/XXXXXX`;
  const payload = sample;
  const tier = tierOf(style);

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
          suggestLogo={LOGO_FOR[type]}
          steps
          gate={{
            tier,
            key: () => codeKey(raw, toSaved(style)),
            beforeLogin: saveDraft,
            onSaved: () => rememberColors(style.fg, style.bg),
            finalize: async () => {
              const { link } = await api.quick({ content: { type, fields: fields[type] }, style: toSaved(style), key: codeKey(raw, toSaved(style)) });
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
            isDesigner(me) ? (
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
            )
          }
        />

        <SiteFooter t={t} lang={lang} />
      </div>
    </div>
  );
}
