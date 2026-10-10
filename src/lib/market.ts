// Маркет (демо): дизайны нашего дизайнера. Тираж — с номерами: закончился — больше не купить.
// Цены примерные (владелец не утверждал).
import type { L10n } from "./i18n";
import { DEFAULT_STYLE, type SavedStyle } from "./qr/style";

export type Design = {
  id: string;
  name: L10n;
  about: L10n;
  price: number;
  /** Размер тиража; null — без тиража. */
  edition: number | null;
  /** Дроп дня — крупно наверху маркета. */
  drop?: boolean;
  /** Коллаборация: «QR Space × партнёр» (по договору с партнёром). */
  collab?: string;
  /** Кто выложил (дизайнер); у встроенных — нет. */
  by?: string;
  createdAt?: string;
  /** «Выбор QR Space» — администратор поставил в подборку: первым в сетке маркета, с отметкой. */
  featured?: boolean;
  style: SavedStyle;
};

/**
 * Правка администратора поверх дизайна (владелец 10.10.2026: «менять всякое в маркете»). Встроенные дизайны живут в
 * коде (DESIGNS) и на работающем сайте не меняются — поэтому правки лежат в данных (db.marketOverrides) и
 * накладываются там, где маркет читается. Нет поля — как было.
 */
export type DesignOverride = { hidden?: boolean; featured?: boolean; drop?: boolean; price?: number; name?: L10n; about?: L10n; at: string; by: string };
export type MarketDesign = Design & { hidden?: boolean; changed?: boolean };

const style = (p: Partial<SavedStyle>): SavedStyle => ({ ...DEFAULT_STYLE, eyeIcon: null, picture: null, ...p });

export const DESIGNS: Design[] = [
  {
    id: "nebula",
    drop: true,
    name: { hy: "Միգամածություն", ru: "Туманность", en: "Nebula" },
    about: {
      hy: "Լուսավոր տիեզերք, կետ-աստղեր, ծավալ և գրադիենտ։ Օրվա դրոպ՝ միայն 30 հատ։",
      ru: "Светлый космос, точки-звёзды, объём и градиент. Дроп дня — всего 30 штук.",
      en: "Bright space, star dots, depth and a gradient. Drop of the day — only 30 made.",
    },
    price: 15,
    edition: 30,
    style: style({ texture: "space", fg: "#151a3d", bg: "#e4e1f4", eyeColor: "#151a3d", eyeBallColor: "#5b2a86", dot: "dots", eye: "circle", eyeBall: "circle", effect: "raised", gradient: { to: "#5b2a86", angle: 45 } }),
  },
  {
    id: "parchment",
    name: { hy: "Մագաղաթ", ru: "Пергамент", en: "Parchment" },
    about: {
      hy: "Հին թուղթ, «հեղուկ» կետեր, «Զարդանախշ» անկյուններ, փորագրված ծավալ։",
      ru: "Старая бумага, «жидкие» точки, углы «Узор», вырезанный объём.",
      en: "Old paper, liquid dots, ornate corners, carved depth.",
    },
    price: 12,
    edition: 100,
    style: style({ texture: "parchment", fg: "#4a2a14", bg: "#e9d9b4", eyeColor: "#4a2a14", eyeBallColor: "#9b1b2a", dot: "liquid", eye: "ornate", effect: "carved" }),
  },
  {
    id: "circuit",
    name: { hy: "Միկրոսխեմա", ru: "Микросхема", en: "Circuit" },
    about: {
      hy: "Կանաչ տախտակ, հարթակներ ուղիներով, չիպ-անկյուններ։",
      ru: "Зелёная плата, площадки с дорожками, углы-чипы.",
      en: "Green board, pads with traces, chip corners.",
    },
    price: 7,
    edition: null,
    style: style({ fg: "#0b5132", bg: "#e6f4ea", eyeColor: "#0b5132", eyeBallColor: "#0b5132", dot: "circuit", eye: "chip" }),
  },
  {
    id: "wood",
    name: { hy: "Փայտ", ru: "Дерево", en: "Wood" },
    about: {
      hy: "Տախտակ՝ մանրաթելերով, փափուկ կետեր, տերև-անկյուններ, փորագրված ծավալ։",
      ru: "Доска с волокнами, мягкие точки, углы-листья, вырезанный объём.",
      en: "A plank with grain, soft dots, leaf corners, carved depth.",
    },
    price: 9,
    edition: 100,
    style: style({ texture: "wood", fg: "#3d2412", bg: "#d6b48a", eyeColor: "#3d2412", eyeBallColor: "#7a1e12", dot: "rounded", eye: "leaf", effect: "carved" }),
  },
  {
    id: "liquid",
    name: { hy: "Հեղուկ", ru: "Жидкий", en: "Liquid" },
    about: {
      hy: "Միաձուլված կետեր, փափուկ անկյուններ, կապույտ գրադիենտ։",
      ru: "Слитые точки, мягкие углы, синий градиент.",
      en: "Merged dots, soft corners, a blue gradient.",
    },
    price: 5,
    edition: null,
    style: style({ fg: "#1b2a4a", bg: "#ffffff", eyeColor: "#1b2a4a", eyeBallColor: "#2e3fd6", dot: "liquid", eye: "rounded", eyeBall: "circle", gradient: { to: "#2e3fd6", angle: 45 } }),
  },
  {
    id: "hearts",
    name: { hy: "Սրտեր", ru: "Сердца", en: "Hearts" },
    about: {
      hy: "Սիրտ-կետեր և կլոր անկյուններ՝ հարսանիքի, նվերի, սիրելիի համար։",
      ru: "Точки-сердечки и круглые углы — для свадьбы, подарка, любимых.",
      en: "Heart dots and round corners — for a wedding, a gift, someone you love.",
    },
    price: 5,
    edition: null,
    style: style({ fg: "#9f1239", bg: "#fff1f2", eyeColor: "#9f1239", eyeBallColor: "#9f1239", dot: "heart", eye: "circle" }),
  },
  {
    id: "linen",
    name: { hy: "Վուշ", ru: "Лён", en: "Linen" },
    about: {
      hy: "Կտավի հյուսվածք, ռոմբեր և կտրված անկյուններ։ Սահմանափակ թողարկում։",
      ru: "Фактура ткани, ромбы и срезанные углы. Ограниченный тираж.",
      en: "Fabric texture, diamonds and cut corners. Limited edition.",
    },
    price: 9,
    edition: 50,
    style: style({ texture: "linen", fg: "#283044", bg: "#ece6da", eyeColor: "#283044", eyeBallColor: "#283044", dot: "diamond", eye: "octagon" }),
  },
  {
    id: "kraft",
    name: { hy: "Կրաֆտ", ru: "Крафт", en: "Kraft" },
    about: {
      hy: "Փաթեթավորման թուղթ և քառակուսի կետեր՝ խանութների և նվերների համար։",
      ru: "Упаковочная бумага и квадратные точки — для магазинов и подарков.",
      en: "Wrapping paper and square dots — for shops and gifts.",
    },
    price: 3,
    edition: null,
    style: style({ texture: "kraft", fg: "#3a2414", bg: "#c9a578", eyeColor: "#3a2414", eyeBallColor: "#3a2414", dot: "square", eye: "square" }),
  },
];

/**
 * Маркет с правками администратора: выложенные дизайнером (новые первыми), потом встроенные; «в подборке» — первыми.
 * Дроп дня один: тот, кого администратор сделал дропом (последняя правка), иначе самый свежий выложенный дроп, иначе
 * встроенный; скрытый дропом не бывает. Скрытые — только для кабинета администратора (withHidden).
 */
export function marketList(published: Design[], overrides: Record<string, DesignOverride>, withHidden = false): MarketDesign[] {
  const all: MarketDesign[] = [...[...published].reverse(), ...DESIGNS].map((d) => {
    const o = overrides[d.id];
    if (!o) return d;
    return {
      ...d,
      ...(o.price !== undefined && { price: o.price }),
      ...(o.name && { name: o.name }),
      ...(o.about && { about: o.about }),
      ...(o.featured !== undefined && { featured: o.featured }),
      ...(o.drop !== undefined && { drop: o.drop }),
      ...(o.hidden && { hidden: true }),
      // Что дизайн правили — видно только в кабинете администратора.
      ...(withHidden && { changed: true }),
    };
  });
  const visible = all.filter((d) => !d.hidden);
  const chosen = visible.filter((d) => overrides[d.id]?.drop).sort((a, b) => overrides[b.id].at.localeCompare(overrides[a.id].at))[0];
  const drop = chosen ?? visible.find((d) => d.drop);
  const list = (withHidden ? all : visible).map((d) => (!!d.drop === (d === drop) ? d : { ...d, drop: d === drop }));
  // Подборка — первыми, остальной порядок не трогаем (sort в JS устойчивый).
  return list.sort((a, b) => Number(!!b.featured) - Number(!!a.featured));
}

/** Дроп дня и остальные — из готового списка маркета (сервер уже наложил правки и убрал скрытые). Дропа может не быть. */
export function catalog(all: Design[]): { drop: Design | null; rest: Design[]; all: Design[] } {
  const drop = all.find((d) => d.drop) ?? null;
  return { drop, rest: all.filter((d) => d !== drop), all };
}

/** Сколько уже продано (демо-начало), чтобы тиражи выглядели живыми. */
export const SEED_SALES: Record<string, number> = { nebula: 21, parchment: 63, wood: 37, linen: 50 };
