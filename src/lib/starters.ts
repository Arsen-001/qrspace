// Готовые шаблоны: код сразу с подсказками, напоминаниями и нужной видимостью — для разных сфер.
// Тексты — на языке, на котором человек создаёт код (их потом правят как обычные записи).
import type { Kind, Repeat, Visibility } from "./codes";
import type { L10n } from "./i18n";

type L = L10n;
export type Starter = {
  id: string;
  kind: Kind;
  name: L;
  hint: L;
  visibility: Visibility;
  /** Все, кто видит код и вошёл, могут добавлять свои фото и записи (свадьба, праздник). */
  publicAdd?: boolean;
  blocks: L[];
  tasks: { text: L; every: Repeat; inDays: number }[];
};

export const STARTERS: Starter[] = [
  {
    id: "guests",
    kind: "memory",
    name: { hy: "Բնակարան հյուրերի համար", ru: "Квартира для гостей", en: "Guest apartment" },
    hint: { hy: "Wi‑Fi, ինչպես բնակվել, տան կանոններ", ru: "Wi‑Fi, как заселиться, правила дома", en: "Wi‑Fi, check-in, house rules" },
    visibility: "all",
    blocks: [
      { hy: "Wi‑Fi՝ ցանցը … , գաղտնաբառը …", ru: "Wi‑Fi: сеть … , пароль …", en: "Wi‑Fi: network … , password …" },
      { hy: "Ինչպես բնակվել՝ բանալին …, դուռը …, լույսը …", ru: "Как заселиться: ключ …, дверь …, свет …", en: "Check-in: key …, door …, lights …" },
      { hy: "Տան կանոններ՝ լռություն 23:00-ից, աղբը …", ru: "Правила дома: тишина с 23:00, мусор …", en: "House rules: quiet after 23:00, rubbish …" },
    ],
    tasks: [],
  },
  {
    id: "event",
    kind: "memory",
    name: { hy: "Հարսանիք / տոն", ru: "Свадьба / праздник", en: "Wedding / party" },
    hint: { hy: "Հյուրերն իրենք են ավելացնում լուսանկարներ", ru: "Гости сами добавляют фото и видео", en: "Guests add their own photos and videos" },
    visibility: "all",
    publicAdd: true,
    blocks: [{ hy: "Բարի գալուստ։ Ավելացրեք ձեր լուսանկարներն ու տեսանյութերը տոնից — կոճակը ստորև։", ru: "Добро пожаловать! Добавляйте свои фото и видео с праздника — кнопка ниже.", en: "Welcome! Add your photos and videos from the party — the button is below." }],
    tasks: [],
  },
  {
    id: "appliance",
    kind: "memory",
    name: { hy: "Տեխնիկա / կաթսա", ru: "Техника / котёл", en: "Appliance / boiler" },
    hint: { hy: "Ինչպես միացնել, սպասարկման հիշեցում", ru: "Как включить, напоминание об обслуживании", en: "How to turn on, service reminder" },
    visibility: "me",
    blocks: [{ hy: "Ինչպես միացնել՝\n1. …\n2. …\n3. …", ru: "Как включить:\n1. …\n2. …\n3. …", en: "How to turn on:\n1. …\n2. …\n3. …" }],
    tasks: [{ text: { hy: "Վարպետի սպասարկում", ru: "Обслуживание мастером", en: "Service by a technician" }, every: "year", inDays: 30 }],
  },
  {
    id: "garden",
    kind: "memory",
    name: { hy: "Այգի / բույսեր", ru: "Сад / растения", en: "Garden / plants" },
    hint: { hy: "Ջրել, պարարտացնել — հիշեցումներ", ru: "Полив и подкормка — напоминания", en: "Watering and feeding reminders" },
    visibility: "me",
    blocks: [{ hy: "Ինչ է աճում, երբ է տնկվել, ինչ է սիրում։", ru: "Что растёт, когда посажено, что любит.", en: "What grows here, when it was planted, what it likes." }],
    tasks: [
      { text: { hy: "Ջրել", ru: "Полить", en: "Water" }, every: "week", inDays: 1 },
      { text: { hy: "Պարարտացնել", ru: "Подкормить", en: "Feed" }, every: "month", inDays: 14 },
    ],
  },
  {
    id: "petmed",
    kind: "pet",
    name: { hy: "Կենդանու բժշկական քարտ", ru: "Медкарта питомца", en: "Pet medical card" },
    hint: { hy: "Պատվաստումներ, չիպ, մշակում — հիշեցումներով", ru: "Прививки, чип, обработка — с напоминаниями", en: "Vaccines, chip, treatments — with reminders" },
    visibility: "all",
    blocks: [
      { hy: "Անուն, ցեղատեսակ, տարիք, բնավորություն։", ru: "Кличка, порода, возраст, характер.", en: "Name, breed, age, temperament." },
      { hy: "Չիպ՝ № …  Ալերգիա՝ …  Անասնաբույժ՝ …", ru: "Чип: № …  Аллергии: …  Ветеринар: …", en: "Chip: No. …  Allergies: …  Vet: …" },
    ],
    tasks: [
      { text: { hy: "Պատվաստում", ru: "Прививка", en: "Vaccination" }, every: "year", inDays: 60 },
      { text: { hy: "Մշակում տզերից", ru: "Обработка от клещей", en: "Tick treatment" }, every: "quarter", inDays: 7 },
    ],
  },
  {
    id: "equipment",
    kind: "memory",
    name: { hy: "Սարքավորում / գրասենյակ", ru: "Оборудование / офис", en: "Equipment / office" },
    hint: { hy: "Հրահանգ աշխատակիցների համար, սպասարկում", ru: "Инструкция для сотрудников, обслуживание", en: "Staff instructions, servicing" },
    visibility: "people",
    blocks: [{ hy: "Ինչպես օգտվել և ում զանգել, եթե փչացել է։", ru: "Как пользоваться и кому звонить, если сломалось.", en: "How to use it and whom to call if it breaks." }],
    tasks: [{ text: { hy: "Սպասարկում", ru: "Обслуживание", en: "Servicing" }, every: "quarter", inDays: 30 }],
  },
];
