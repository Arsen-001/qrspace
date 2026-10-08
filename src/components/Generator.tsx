"use client";
import Link from "next/link";
import { useState } from "react";
import { api } from "@/lib/codes";
import { buildPayload, CONTENT_TYPES, isDirect, linkTarget, type ContentType, type Fields } from "@/lib/qr/payload";
import { buildDrawing } from "@/lib/qr/render";
import { codeKey, tierOf } from "@/lib/pricing";
import { DEFAULT_STYLE, toQrStyle, toSaved } from "@/lib/qr/style";
import { useLang } from "@/lib/lang";
import { useMe } from "@/lib/me";
import { isDesigner } from "@/lib/people";
import { CodeDesigner } from "./CodeDesigner";
import { HomeBackdrop, HomeFeatures, HomeHero, HomeTicker } from "./HomeHero";
import { ContentForm } from "./ContentForm";
import { PublishBox } from "./PublishBox";
import { SiteFooter } from "./SiteFooter";
import { SiteHeader } from "./SiteHeader";
import type { StyleState } from "./StylePanel";

export function Generator() {
  const { lang, t } = useLang((t) => `${t.appName} — ${t.tagline}`);

  const [type, setType] = useState<ContentType>("url");
  const [fields, setFields] = useState(() => {
    const f = Object.fromEntries(CONTENT_TYPES.map((k) => [k, {}])) as Record<ContentType, Fields>;
    f.wifi = { security: "WPA" };
    return f;
  });
  const [style, setStyle] = useState<StyleState>(DEFAULT_STYLE);
  const raw = buildPayload(type, fields[type]);
  const { me, base } = useMe();
  // Наш красивый код ведёт только через нашу короткую ссылку: в предпросмотре — образец той же длины, настоящая
  // создаётся при скачивании (код появляется в «Мои коды»). Wi-Fi, контакт и событие — прямо в коде, только простые.
  const direct = isDirect(type);
  const sample = `${(base || "https://qrspace.co").toUpperCase()}/K/XXXXXX`;
  // Пока ничего не ввели — в предпросмотре пример с нашей ссылкой: видно, как меняется вид, скачать нельзя.
  const payload = direct && raw ? raw : sample;
  const tier = tierOf(style);

  return (
    <div>
      <div className="mx-auto w-full max-w-6xl px-4 pb-16 sm:px-6">
        <SiteHeader t={t} lang={lang} />

        <HomeBackdrop />
        <HomeHero t={t} />
        <HomeTicker t={t} />

        <div id="make" className="scroll-mt-6 pb-6 pt-4">
          <h2 className="font-heading text-2xl font-extrabold sm:text-4xl">{t.homeMakeTitle}</h2>
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
          steps
          gate={{
            tier,
            key: () => codeKey(raw, toSaved(style)),
            blocked: direct && tier === "styled" ? t.directBlocked : undefined,
            finalize: direct
              ? undefined
              : async () => {
                  const target = linkTarget(type, raw);
                  const { link } = await api.quick(target ? { target, style: toSaved(style) } : { text: raw, style: toSaved(style) });
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
                  {direct ? (
                    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="6.5" y="2.5" width="11" height="19" rx="2.5" />
                      <path d="M11 18.5h2" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 11a8 8 0 0 0-14.3-4.9L4 8M4 4v4h4M4 13a8 8 0 0 0 14.3 4.9L20 16M20 20v-4h-4" />
                    </svg>
                  )}
                </span>
                <div className="min-w-0">
                  <h2 className="font-heading text-base font-bold">{direct ? t.directTitle : t.viaTitle}</h2>
                  <p className="mt-1 text-sm leading-relaxed text-on-stage/70">{direct ? t.directText : t.viaText}</p>
                  {!direct && me && (
                    <Link href="/codes" className="mt-3 inline-flex min-h-10 items-center gap-1.5 text-sm font-semibold text-accent hover:underline">
                      {t.viaCta} →
                    </Link>
                  )}
                </div>
              </section>
            )
          }
        />

        <HomeFeatures t={t} />

        <SiteFooter t={t} lang={lang} lead={t.footer} />
      </div>
    </div>
  );
}
