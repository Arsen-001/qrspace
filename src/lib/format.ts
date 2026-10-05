import type { Lang } from "./i18n";

const LOCALE: Record<Lang, string> = { ru: "ru-RU", en: "en-GB", hy: "hy-AM" };
const pad = (n: number) => String(n).padStart(2, "0");

// Армянские названия месяцев и порядок даты браузеры показывают по-разному («M10», «10-05») —
// для армянского собираем сами: 05.10, 21:20.
const hyDate = (d: Date, year: boolean) => `${pad(d.getDate())}.${pad(d.getMonth() + 1)}${year ? `.${d.getFullYear()}` : ""}`;

/** «5 окт., 14:20» на языке сайта. */
export function fmtDateTime(iso: string, lang: Lang) {
  const d = new Date(iso);
  if (lang === "hy") return `${hyDate(d, false)}, ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  return new Intl.DateTimeFormat(LOCALE[lang], { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(d);
}

/** «5 окт. 2026» — для дат «до». */
export function fmtDate(ymd: string, lang: Lang) {
  const d = new Date(`${ymd}T12:00:00`);
  if (lang === "hy") return hyDate(d, true);
  return new Intl.DateTimeFormat(LOCALE[lang], { day: "numeric", month: "short", year: "numeric" }).format(d);
}

/** «через 5 дней», «сегодня», «3 дня назад». */
export const fmtDays = (days: number, lang: Lang) => new Intl.RelativeTimeFormat(LOCALE[lang], { numeric: "auto" }).format(days, "day");
