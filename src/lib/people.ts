// Демо-люди: пока нет настоящего входа, человек выбирает, кем войти. Имена — на трёх языках.
import type { Lang } from "./i18n";

/** demo — кто это в демо-данных, чтобы было понятно, кем войти и что проверить. */
export type Person = { id: string; name: Record<Lang, string>; color: string; demo: Record<Lang, string>; designer?: boolean };

export const PEOPLE: Person[] = [
  {
    id: "arman",
    name: { hy: "Արման", ru: "Арман", en: "Arman" },
    color: "#2e3fd6",
    demo: { hy: "Կոդերի տերը՝ կաթսա, Wi‑Fi, ալբոմ", ru: "Хозяин кодов: котёл, Wi‑Fi, альбом", en: "Owns the codes: boiler, Wi‑Fi, album" },
  },
  {
    id: "ani",
    name: { hy: "Անի", ru: "Ани", en: "Ani" },
    color: "#b4235a",
    demo: { hy: "Քույրը՝ կարող է լրացնել «Կաթսա»-ն", ru: "Сестра: может дописывать в «Котёл»", en: "Sister: can add to “Boiler”" },
  },
  {
    id: "david",
    name: { hy: "Դավիթ", ru: "Давид", en: "David" },
    color: "#0f766e",
    demo: { hy: "Վարպետը՝ միայն դիտում է «Կաթսա»-ն", ru: "Мастер: только смотрит «Котёл»", en: "Repairman: can only view “Boiler”" },
  },
  {
    id: "lilit",
    name: { hy: "Լիլիթ", ru: "Лилит", en: "Lilit" },
    color: "#b45309",
    demo: { hy: "Հյուրը՝ խնդրել է մուտք «Կաթսա»-ին", ru: "Гостья: попросила доступ к «Котлу»", en: "Guest: asked for access to “Boiler”" },
  },
  {
    id: "nare",
    name: { hy: "Նարե", ru: "Наре", en: "Nare" },
    color: "#7c3aed",
    designer: true,
    demo: { hy: "Դիզայներ՝ կոդեր է հրապարակում շուկայում", ru: "Дизайнер: выкладывает коды в маркет", en: "Designer: publishes codes to the market" },
  },
];

export const personById = (id: string | null | undefined) => PEOPLE.find((p) => p.id === id) ?? null;

export const isDesigner = (id: string | null | undefined) => !!personById(id)?.designer;
