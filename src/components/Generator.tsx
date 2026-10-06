"use client";
import Link from "next/link";
import { useState } from "react";
import { buildPayload, CONTENT_TYPES, type ContentType, type Fields } from "@/lib/qr/payload";
import { codeKey, tierOf } from "@/lib/pricing";
import { DEFAULT_STYLE, toSaved } from "@/lib/qr/style";
import { useLang } from "@/lib/lang";
import { useMe } from "@/lib/me";
import { isDesigner } from "@/lib/people";
import { CodeDesigner } from "./CodeDesigner";
import { HomeFeatures, HomeHero, HomeTicker } from "./HomeHero";
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
  const payload = buildPayload(type, fields[type]);
  const { me, base } = useMe();

  return (
    <div className="x-home min-h-screen">
      <div className="mx-auto w-full max-w-6xl px-4 pb-16 sm:px-6">
        <SiteHeader t={t} lang={lang} />

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
          gate={{
            tier: tierOf(style),
            key: () => codeKey(payload, toSaved(style)),
          }}
          top={
            <ContentForm
              t={t}
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
              type === "url" && (
                // Обычный код со ссылкой не поменять после печати — предлагаем код-ссылку.
                <section className="rounded-2xl border border-line bg-card p-5">
                  <h2 className="font-heading text-base font-bold">{t.linkPromoTitle}</h2>
                  <p className="mt-1 text-sm text-muted">{t.linkPromoText}</p>
                  <Link
                    href="/codes?new=link"
                    className="mt-3 inline-grid min-h-11 place-items-center rounded-xl bg-accent px-4 text-sm font-semibold text-on-accent"
                  >
                    {t.linkPromoCta}
                  </Link>
                </section>
              )
            )
          }
        />

        <HomeFeatures t={t} />

        <SiteFooter t={t} lang={lang} lead={t.footer} />
      </div>
    </div>
  );
}
