import type { Lang } from "./i18n";

const LOCALE: Record<Lang, string> = { hy: "hy-AM", ru: "ru-RU", en: "en-GB" };
// Названия армянских месяцев знают не все браузеры (бывает «M10») — для армянского месяц числом.
const MONTH = (lang: Lang) => (lang === "hy" ? "2-digit" : "short");

/** «5 окт., 14:20» на языке сайта. */
export const fmtDateTime = (iso: string, lang: Lang) =>
  new Intl.DateTimeFormat(LOCALE[lang], { day: "numeric", month: MONTH(lang), hour: "2-digit", minute: "2-digit" }).format(new Date(iso));

/** «5 окт. 2026» — для дат «до». */
export const fmtDate = (ymd: string, lang: Lang) =>
  new Intl.DateTimeFormat(LOCALE[lang], { day: "numeric", month: MONTH(lang), year: "numeric" }).format(new Date(`${ymd}T12:00:00`));
