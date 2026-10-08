"use client";
// Страница скана для кода из генератора: что в коде — крупно, и кнопки (позвонить, открыть, скопировать, сохранить…).
// Любой наш код открывается здесь, а не сразу у цели (решение владельца 08.10.2026).
import { useState } from "react";
import type { Dict } from "@/lib/i18n";
import { actionHref, icsOf, safeUrl, vcardOf, type Content } from "@/lib/qr/payload";
import { TypeIcon } from "./TypeIcon";

const APP: Partial<Record<Content["type"], string>> = {
  whatsapp: "WhatsApp",
  telegram: "Telegram",
  viber: "Viber",
  instagram: "Instagram",
  facebook: "Facebook",
  tiktok: "TikTok",
  youtube: "YouTube",
  linkedin: "LinkedIn",
  x: "X",
};

const btn = "flex min-h-13 w-full items-center justify-center gap-2 rounded-xl px-4 font-heading text-sm font-bold transition-all";
const primary = `${btn} bg-accent text-on-accent hover:brightness-95`;
const secondary = `${btn} border border-line bg-field hover:border-muted`;

function CopyButton({ t, value, label }: { t: Dict; value: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className={secondary}
      onClick={() =>
        navigator.clipboard?.writeText(value).then(() => {
          setDone(true);
          setTimeout(() => setDone(false), 1800);
        })
      }
    >
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        {done ? <path d="m5 12.5 4.5 4.5L19 7.5" /> : <path d="M9 9h10v11H9zM5 15V4h10" />}
      </svg>
      {done ? t.actCopied : (label ?? t.actCopy)}
    </button>
  );
}

function download(name: string, type: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Строка «подпись — значение» с кнопкой копирования справа. */
function Row({ t, label, value, href }: { t: Dict; label: string; value: string; href?: string | null }) {
  const [done, setDone] = useState(false);
  return (
    <div className="flex items-center gap-3 border-t border-line py-3 first:border-t-0">
      <div className="min-w-0 flex-1">
        <div className="text-xs text-muted">{label}</div>
        {href ? (
          <a href={href} className="block break-words font-semibold underline-offset-2 hover:underline">
            {value}
          </a>
        ) : (
          <div className="whitespace-pre-wrap break-words font-semibold">{value}</div>
        )}
      </div>
      <button
        type="button"
        aria-label={`${t.actCopy}: ${label}`}
        onClick={() =>
          navigator.clipboard?.writeText(value).then(() => {
            setDone(true);
            setTimeout(() => setDone(false), 1500);
          })
        }
        className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-line bg-field text-muted hover:text-ink"
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          {done ? <path d="m5 12.5 4.5 4.5L19 7.5" /> : <path d="M9 9h10v11H9zM5 15V4h10" />}
        </svg>
      </button>
    </div>
  );
}

const when = (s: string, lang: string) => {
  const d = new Date(s);
  return isNaN(+d) ? s : d.toLocaleString(lang, { dateStyle: "long", timeStyle: "short" });
};

export function ContentCard({ t, lang, content, title }: { t: Dict; lang: string; content: Content; title?: string | null }) {
  const { type, fields: f } = content;
  const href = actionHref(content);
  const label = (k: string) => t[`field.${k}` as keyof Dict] as string;
  const app = APP[type];

  // Что показать крупно и какие кнопки.
  let main = "";
  const rows: { k: string; v: string; href?: string | null }[] = [];
  const actions: React.ReactNode[] = [];
  const open = (text: string) => (
    <a key="open" href={href!} className={primary} rel="noopener noreferrer">
      {text} <span aria-hidden>→</span>
    </a>
  );

  switch (type) {
    case "url":
      main = (f.url ?? "").replace(/^https?:\/\//i, "").replace(/\/$/, "");
      actions.push(open(t.actOpenSite), <CopyButton key="c" t={t} value={href ?? f.url ?? ""} label={t.actCopyLink} />);
      break;
    case "phone":
      main = f.phone ?? "";
      actions.push(open(t.actCall), <CopyButton key="c" t={t} value={main} label={t.actCopyNumber} />);
      break;
    case "sms":
      main = f.phone ?? "";
      if (f.message) rows.push({ k: label("message"), v: f.message });
      actions.push(open(t.actSms), <CopyButton key="c" t={t} value={main} label={t.actCopyNumber} />);
      break;
    case "email":
      main = f.email ?? "";
      if (f.subject) rows.push({ k: label("subject"), v: f.subject });
      if (f.body) rows.push({ k: label("body"), v: f.body });
      actions.push(open(t.actEmail), <CopyButton key="c" t={t} value={main} label={t.actCopyEmail} />);
      break;
    case "whatsapp":
    case "viber":
      main = f.phone ?? "";
      if (f.message) rows.push({ k: label("message"), v: f.message });
      actions.push(open(`${t.actOpenIn} ${app}`), <CopyButton key="c" t={t} value={main} label={t.actCopyNumber} />);
      break;
    case "location":
      main = f.place ?? "";
      actions.push(open(t.actMap), <CopyButton key="c" t={t} value={main} />);
      break;
    case "text":
      main = "";
      actions.push(<CopyButton key="c" t={t} value={f.text ?? ""} label={t.actCopyText} />);
      break;
    case "wifi":
      main = f.ssid ?? "";
      if (f.security !== "nopass" && f.password) rows.push({ k: label("password"), v: f.password });
      if (f.security !== "nopass" && f.password) actions.push(<CopyButton key="p" t={t} value={f.password} label={t.actCopyPassword} />);
      actions.push(<CopyButton key="n" t={t} value={main} label={t.actCopyNetwork} />);
      break;
    case "contact": {
      main = [f.firstName, f.lastName].filter(Boolean).join(" ") || (f.phone ?? "");
      if (f.phone) rows.push({ k: label("phone"), v: f.phone, href: `tel:${f.phone.replace(/[^\d+]/g, "")}` });
      if (f.email) rows.push({ k: label("email"), v: f.email, href: `mailto:${f.email}` });
      if (f.company) rows.push({ k: label("company"), v: f.company });
      if (f.website) rows.push({ k: label("website"), v: f.website, href: safeUrl(f.website) });
      actions.push(
        <button key="s" type="button" className={primary} onClick={() => download(`${main || "contact"}.vcf`, "text/vcard", vcardOf(f))}>
          {t.actSaveContact}
        </button>,
      );
      if (f.phone)
        actions.push(
          <a key="call" href={`tel:${f.phone.replace(/[^\d+]/g, "")}`} className={secondary}>
            {t.actCall}
          </a>,
        );
      break;
    }
    case "event":
      main = f.title ?? "";
      if (f.start) rows.push({ k: label("start"), v: when(f.start, lang) });
      if (f.end) rows.push({ k: label("end"), v: when(f.end, lang) });
      if (f.place) rows.push({ k: label("place"), v: f.place });
      if (f.notes) rows.push({ k: label("notes"), v: f.notes });
      actions.push(
        <button key="s" type="button" className={primary} onClick={() => download(`${main || "event"}.ics`, "text/calendar", icsOf(f))}>
          {t.actAddCalendar}
        </button>,
      );
      break;
    default:
      // Соцсети и Telegram — профиль: откроется приложение, если оно есть, иначе браузер.
      main = (f.username ?? "").replace(/^https?:\/\/(www\.)?/i, "");
      if (main && !main.includes("/") && !main.startsWith("@")) main = `@${main}`;
      actions.push(open(`${t.actOpenIn} ${app}`), <CopyButton key="c" t={t} value={href ?? main} label={t.actCopyLink} />);
  }

  return (
    <section className="overflow-hidden rounded-3xl border border-line bg-card">
      <div className="relative bg-stage p-6 text-on-stage sm:p-8">
        <div className="flex items-center gap-3">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-accent text-on-accent">
            <TypeIcon type={type} className="h-6 w-6" />
          </span>
          <div className="min-w-0">
            <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-on-stage/60">{t[`type.${type}`]}</div>
            {title && title !== main && <div className="truncate text-sm text-on-stage/80">{title}</div>}
          </div>
        </div>
        {type === "text" ? (
          <p className="mt-5 whitespace-pre-wrap break-words text-lg leading-relaxed">{f.text}</p>
        ) : (
          main && <p className="mt-5 break-words font-heading text-2xl font-extrabold leading-tight sm:text-3xl">{main}</p>
        )}
      </div>
      {(rows.length > 0 || type === "wifi") && (
        <div className="px-6 pt-2 sm:px-8">
          {rows.map((r) => (
            <Row key={r.k} t={t} label={r.k} value={r.v} href={r.href} />
          ))}
          {type === "wifi" && <p className="border-t border-line py-3 text-sm text-muted first:border-t-0">{t.wifiHow}</p>}
        </div>
      )}
      <div className="grid gap-2 p-6 sm:p-8">{actions}</div>
    </section>
  );
}
