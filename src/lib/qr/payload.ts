// Что зашито в код: из полей формы собираем строку, которую поймёт камера телефона.

export const CONTENT_GROUPS = {
  main: ["url", "text", "wifi", "contact", "location", "event"],
  contact: ["phone", "sms", "email", "whatsapp", "telegram", "viber"],
  social: ["instagram", "facebook", "tiktok", "youtube", "linkedin", "x"],
} as const;

export type ContentGroup = keyof typeof CONTENT_GROUPS;
export type ContentType = (typeof CONTENT_GROUPS)[ContentGroup][number];
export const CONTENT_TYPES = Object.values(CONTENT_GROUPS).flat() as ContentType[];

/** Соцсети: адрес профиля по имени пользователя. */
const SOCIAL: Record<"instagram" | "facebook" | "tiktok" | "youtube" | "linkedin" | "x", (u: string) => string> = {
  instagram: (u) => `https://instagram.com/${u}`,
  facebook: (u) => `https://facebook.com/${u}`,
  tiktok: (u) => `https://www.tiktok.com/@${u}`,
  youtube: (u) => `https://youtube.com/@${u}`,
  linkedin: (u) => `https://www.linkedin.com/in/${u}`,
  x: (u) => `https://x.com/${u}`,
};

export type Fields = Record<string, string>;

/** Поля каждого вида — порядок = порядок в форме. */
export const FIELDS: Record<ContentType, string[]> = {
  url: ["url"],
  text: ["text"],
  wifi: ["ssid", "password", "security"],
  phone: ["phone"],
  whatsapp: ["phone", "message"],
  telegram: ["username"],
  email: ["email", "subject", "body"],
  contact: ["firstName", "lastName", "phone", "email", "company", "website"],
  location: ["place"],
  event: ["title", "start", "end", "place", "notes"],
  sms: ["phone", "message"],
  viber: ["phone"],
  instagram: ["username"],
  facebook: ["username"],
  tiktok: ["username"],
  youtube: ["username"],
  linkedin: ["username"],
  x: ["username"],
};

const digits = (s: string) => s.replace(/[^\d+]/g, "");
/** Номер для WhatsApp и Viber — международный, без «+»: «00374…» и «+374…» → «374…». */
const intl = (s: string) => digits(s).replace(/^\+/, "").replace(/^00/, "");
const hasDigit = (s: string) => /\d/.test(s);

// В строке Wi-Fi спецсимволы экранируются обратной чертой.
const wifiEscape = (s: string) => s.replace(/([\\;,:"])/g, "\\$1");
const vcardEscape = (s: string) => s.replace(/([\\;,])/g, "\\$1").replace(/\n/g, "\\n");

function normalizeUrl(raw: string): string {
  // «http//сайт» — пропущено двоеточие.
  const s = raw.trim().replace(/^(https?)\/\/(?!\/)/i, "$1://");
  if (!s) return "";
  // Своя схема («mailto:», «tel:») — как есть; «example.com:8080» и «localhost:3000» — это порт, а не схема.
  if (/^(tel|sms|mailto|viber):/i.test(s) || /^[a-z][a-z\d+.-]*:(?!\d)/i.test(s)) return s;
  return `https://${s}`;
}

/** Ссылка на профиль, а не имя: «https://…» или «instagram.com/…», «youtu.be/…». */
const isLink = (s: string) => /^https?:\/\//i.test(s) || /^([\w-]+\.)+[a-z]{2,}\//i.test(s);

/** Широта и долгота из «40.18, 44.51», «40,18 44,51»; null — это адрес, а не координаты. */
function coords(q: string): [string, string] | null {
  const m = q.match(/^\s*(-?\d{1,3}(?:[.,]\d+)?)\s*[,;\s]\s*(-?\d{1,3}(?:[.,]\d+)?)\s*$/);
  if (!m) return null;
  const [lat, lon] = [m[1], m[2]].map((x) => x.replace(",", "."));
  return Math.abs(+lat) <= 90 && Math.abs(+lon) <= 180 ? [lat, lon] : null;
}

/** «2026-10-10T18:30» из поля даты → «20261010T183000» для календаря (местное время). */
const icsDate = (s: string) => s.replace(/[-:]/g, "").padEnd(13, "0").slice(0, 13) + "00";

/** Готовая строка для кода или "" — если главное поле пустое. */
export function buildPayload(type: ContentType, f: Fields): string {
  const v = (k: string) => (f[k] ?? "").trim();
  switch (type) {
    case "sms": {
      const n = digits(v("phone"));
      return hasDigit(n) ? `SMSTO:${n}:${v("message")}` : "";
    }
    case "viber": {
      const n = intl(v("phone"));
      return hasDigit(n) ? `viber://chat?number=${encodeURIComponent(`+${n}`)}` : "";
    }
    case "location": {
      const q = v("place");
      if (!q) return "";
      // Ссылка на карту (Google, Яндекс, Apple) — как есть; координаты «40.18, 44.51» — точкой, иначе — поиском по адресу.
      if (/^https?:\/\/\S+$/i.test(q)) return q;
      const c = coords(q);
      return c ? `https://maps.google.com/?q=${c[0]},${c[1]}` : `https://maps.google.com/?q=${encodeURIComponent(q)}`;
    }
    case "event": {
      if (!v("title") || !v("start")) return "";
      const lines = [
        "BEGIN:VEVENT",
        `SUMMARY:${vcardEscape(v("title"))}`,
        `DTSTART:${icsDate(v("start"))}`,
        v("end") && `DTEND:${icsDate(v("end"))}`,
        v("place") && `LOCATION:${vcardEscape(v("place"))}`,
        v("notes") && `DESCRIPTION:${vcardEscape(v("notes"))}`,
        "END:VEVENT",
      ];
      return lines.filter(Boolean).join("\n");
    }
    case "instagram":
    case "facebook":
    case "tiktok":
    case "youtube":
    case "linkedin":
    case "x": {
      // В имени пользователя пробелов не бывает — убираем (часто ставит клавиатура телефона).
      const u = v("username").replace(/\s+/g, "");
      if (!u) return "";
      if (isLink(u)) return normalizeUrl(u);
      return SOCIAL[type](u.replace(/^@/, ""));
    }
    case "url":
      return normalizeUrl(v("url"));
    case "text":
      return (f.text ?? "").trim() ? (f.text ?? "") : "";
    case "wifi": {
      if (!v("ssid")) return "";
      const sec = v("security") || "WPA";
      const pass = sec === "nopass" ? "" : `P:${wifiEscape(f.password ?? "")};`;
      return `WIFI:T:${sec};S:${wifiEscape(f.ssid ?? "")};${pass};`;
    }
    case "phone":
      return hasDigit(v("phone")) ? `tel:${digits(v("phone"))}` : "";
    case "whatsapp": {
      const n = intl(v("phone"));
      if (!hasDigit(n)) return "";
      return v("message") ? `https://wa.me/${n}?text=${encodeURIComponent(v("message"))}` : `https://wa.me/${n}`;
    }
    case "telegram": {
      // «@имя», «t.me/имя», «https://telegram.me/имя» — одно и то же.
      const u = v("username")
        .replace(/\s+/g, "")
        .replace(/^(https?:\/\/)?(www\.)?(t|telegram)\.me\//i, "")
        .replace(/^@/, "");
      return u ? `https://t.me/${u}` : "";
    }
    case "email": {
      const to = v("email").replace(/^mailto:/i, "");
      if (!to) return "";
      const q = new URLSearchParams();
      if (v("subject")) q.set("subject", v("subject"));
      if (v("body")) q.set("body", v("body"));
      const qs = q.toString().replace(/\+/g, "%20");
      return `mailto:${to}${qs ? `?${qs}` : ""}`;
    }
    case "contact": {
      // Визитка — хоть с одним полем: имя, номер, почта или компания.
      if (!["firstName", "lastName", "phone", "email", "company"].some((k) => v(k))) return "";
      const name = [v("firstName"), v("lastName")].filter(Boolean).join(" ") || v("company") || v("phone") || v("email");
      const lines = [
        "BEGIN:VCARD",
        "VERSION:3.0",
        `N:${vcardEscape(v("lastName"))};${vcardEscape(v("firstName"))};;;`,
        `FN:${vcardEscape(name)}`,
        hasDigit(v("phone")) && `TEL;TYPE=CELL:${digits(v("phone"))}`,
        v("email") && `EMAIL:${v("email")}`,
        v("company") && `ORG:${vcardEscape(v("company"))}`,
        v("website") && `URL:${normalizeUrl(v("website"))}`,
        "END:VCARD",
      ];
      return lines.filter(Boolean).join("\n");
    }
  }
}

/** Что лежит в коде из генератора: вид и поля. Скан любого нашего кода открывает нашу страницу (решение владельца
 * 08.10.2026: «чтобы созданным у нас кодом нельзя было пользоваться без нас»), там — это содержимое и кнопки. */
export type Content = { type: ContentType; fields: Fields };

/** Ссылка для главной кнопки на нашей странице (открыть сайт, позвонить, написать…). У текста, Wi-Fi, контакта и события — нет. */
export function actionHref(c: Content): string | null {
  if (c.type === "text" || c.type === "wifi" || c.type === "contact" || c.type === "event") return null;
  const p = buildPayload(c.type, c.fields);
  if (!p) return null;
  // «SMSTO:номер:текст» понимают только камеры; браузеру нужен sms:номер?body=текст.
  const sms = /^SMSTO:([^:]*):([\s\S]*)$/.exec(p);
  if (sms) return `sms:${sms[1]}${sms[2] ? `?body=${encodeURIComponent(sms[2])}` : ""}`;
  return /^(https?:|tel:|mailto:|viber:)/i.test(p) ? p : null;
}

/** Сколько знаков в поле: столько же принимает форма, лишнего сервер молча не обрезает (адрес сайта бывает длинным — с метками рекламы). */
export const LIMIT: Record<string, number> = { text: 2000, body: 2000, notes: 1000, message: 1000, url: 2000, website: 2000 };
export const limitOf = (k: string) => LIMIT[k] ?? 300;

/** Проверка содержимого с сервера: только поля этого вида, длина ограничена, ссылки — только безопасные. */
export function cleanContent(raw: unknown): Content | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as { type?: unknown; fields?: unknown };
  if (typeof r.type !== "string" || !(CONTENT_TYPES as string[]).includes(r.type)) return null;
  const type = r.type as ContentType;
  const src = (r.fields && typeof r.fields === "object" ? r.fields : {}) as Record<string, unknown>;
  const fields: Fields = {};
  for (const k of FIELDS[type]) {
    const v = src[k];
    if (typeof v === "string" && v.trim()) fields[k] = v.slice(0, limitOf(k));
  }
  if (!buildPayload(type, fields)) return null;
  if (!["text", "wifi", "contact", "event"].includes(type) && !actionHref({ type, fields })) return null;
  return { type, fields };
}

/** Строки файлов .vcf и .ics — через CRLF, как требуют стандарты (иначе Outlook и часть Android не берут). */
const crlf = (s: string) => s.replace(/\r?\n/g, "\r\n");
/** Короткий постоянный отпечаток текста — UID события: то же событие, добавленное снова, обновится, а не задвоится. */
const digest = (s: string) => {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = (Math.imul(h, 33) ^ s.charCodeAt(i)) >>> 0;
  return h.toString(36);
};

/** Файл «Сохранить в контакты» (.vcf) и «Добавить в календарь» (.ics). */
export const vcardOf = (f: Fields) => crlf(buildPayload("contact", f));
export function icsOf(f: Fields): string {
  const ev = buildPayload("event", f);
  // UID и DTSTAMP (время создания, UTC) — обязательные строки события.
  const stamp = new Date().toISOString().replace(/[-:]|\.\d+/g, "");
  const head = `BEGIN:VEVENT\nUID:${digest(ev)}@qrspace.co\nDTSTAMP:${stamp}`;
  return crlf(`BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//QR Space//EN\n${ev.replace("BEGIN:VEVENT", head)}\nEND:VCALENDAR\n`);
}
/** Сайт из карточки контакта — ссылкой, только http(s). */
export const safeUrl = (s: string) => {
  const u = normalizeUrl(s);
  return /^https?:\/\//i.test(u) ? u : null;
};

/** Имя профиля для показа: «https://www.youtube.com/@qrspace» → «@qrspace», «t.me/name» → «@name». */
export function handleOf(raw: string): string {
  const u = raw.trim().replace(/\s+/g, "");
  if (!u) return "";
  if (!isLink(u)) return /^[@+]/.test(u) ? u : `@${u}`;
  // Ссылка: путь без адреса сайта, «?…» и «/» в конце; у LinkedIn — без «in/».
  const h = u.replace(/^https?:\/\//i, "").replace(/^[^/]+\//, "").replace(/[?#].*$/, "").replace(/\/+$/, "").replace(/^in\//, "");
  if (!h) return u.replace(/^https?:\/\/(www\.)?/i, "");
  // Одно имя в пути — это профиль (t.me/name → @name); у youtu.be в пути — видео.
  return /^[\w.]+$/.test(h) && !/youtu\.be\//i.test(u) ? `@${h}` : h;
}

/** Имя приложения перед именем или номером: в списке кодов видно, Viber это или WhatsApp, X или LinkedIn. */
const BRAND: Partial<Record<ContentType, string>> = {
  sms: "SMS",
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

/** Название кода в «Моих кодах»: главное поле без лишнего. */
export function titleOfContent(c: Content): string {
  const f = c.fields;
  const main =
    c.type === "contact"
      ? [f.firstName, f.lastName].filter(Boolean).join(" ") || f.company || f.phone || f.email
      : c.type === "event"
        ? f.title
        : c.type === "wifi"
          ? f.ssid
          : f.username !== undefined
            ? handleOf(f.username)
            : (f.url ?? f.phone ?? f.email ?? f.place ?? f.text ?? "");
  const clean = (main ?? "").replace(/^https?:\/\//i, "").replace(/\s+/g, " ").trim();
  const brand = BRAND[c.type];
  return (brand && clean ? `${brand} ${clean}` : clean).slice(0, 60) || brand || c.type;
}

// ——— Проверка формы: что не так в поле и что ещё не заполнено ———

/** Ошибка в поле: key — ключ словаря (bad.*), block — с ней скачать нельзя (код вёл бы в никуда), fix — готовое исправление. */
export type Problem = { field: string; key: ProblemKey; block: boolean; fix?: string; arg?: string };
export type ProblemKey = "bad.scheme" | "bad.spaces" | "bad.host" | "bad.digits" | "bad.intl" | "bad.email" | "bad.emailTypo" | "bad.endBeforeStart" | "bad.wifiNoPass" | "bad.otherSite";

/** Частые почтовые сервисы — для подсказки «может, gmail.com?». */
const MAIL_DOMAINS = ["gmail.com", "yahoo.com", "outlook.com", "hotmail.com", "icloud.com", "mail.ru", "yandex.ru", "bk.ru", "inbox.ru", "list.ru", "rambler.ru", "proton.me", "protonmail.com", "aol.com", "live.com", "me.com"];
/** Расстояние между строками (сколько букв поменять) — не дальше 2. */
function near(a: string, b: string): boolean {
  if (Math.abs(a.length - b.length) > 2) return false;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[b.length] <= 2;
}

/** Проблема с адресом почты: неверный вид или опечатка в известном сервисе. */
function emailProblem(field: string, raw: string, block: boolean): Problem | null {
  const e = raw.trim().replace(/^mailto:/i, "");
  if (!e) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@.]{2,}$/.test(e)) return { field, key: "bad.email", block };
  const [user, domain] = [e.slice(0, e.lastIndexOf("@")), e.slice(e.lastIndexOf("@") + 1).toLowerCase()];
  if (MAIL_DOMAINS.includes(domain)) return null;
  const like = MAIL_DOMAINS.find((d) => near(domain, d));
  return like ? { field, key: "bad.emailTypo", block: false, fix: `${user}@${like}`, arg: `${user}@${like}` } : null;
}

/** Номер: без цифр — не номер; для WhatsApp и Viber — только с кодом страны (с «0» в начале международных номеров нет). */
function phoneProblem(field: string, raw: string, needIntl: boolean): Problem | null {
  const s = raw.trim();
  if (!s) return null;
  if (!hasDigit(s)) return { field, key: "bad.digits", block: true };
  if (needIntl && /^0[1-9]/.test(digits(s))) return { field, key: "bad.intl", block: true };
  return null;
}

/** Сайт соцсети по имени — чтобы заметить ссылку не на ту сеть (вставили Facebook в Instagram). */
const NETWORK_SITES: Partial<Record<ContentType, RegExp>> = {
  instagram: /(^|\.)instagram\.com$|(^|\.)instagr\.am$/,
  facebook: /(^|\.)facebook\.com$|(^|\.)fb\.com$|(^|\.)fb\.me$/,
  tiktok: /(^|\.)tiktok\.com$/,
  youtube: /(^|\.)youtube\.com$|(^|\.)youtu\.be$/,
  linkedin: /(^|\.)linkedin\.com$|(^|\.)lnkd\.in$/,
  x: /(^|\.)x\.com$|(^|\.)twitter\.com$/,
};

/** Что не так в полях этого вида (пусто — всё хорошо). Показываем под полем; с block скачать нельзя. */
export function problemsOf(type: ContentType, f: Fields): Problem[] {
  const v = (k: string) => (f[k] ?? "").trim();
  const out: (Problem | null)[] = [];
  const site = (field: string) => {
    const raw = v(field);
    if (!raw) return;
    const u = normalizeUrl(raw);
    if (!/^https?:\/\//i.test(u)) {
      // В «Ссылке» можно и звонок, и почту — их понимает и наша страница.
      if (field === "url" && /^(tel|mailto|sms|viber):/i.test(u)) return;
      return out.push({ field, key: "bad.scheme", block: true });
    }
    const host = u.replace(/^https?:\/\//i, "").split(/[/?#]/)[0];
    if (/\s/.test(host)) return out.push({ field, key: "bad.spaces", block: true });
    if (!/\./.test(host) && !/^localhost(:\d+)?$/i.test(host)) out.push({ field, key: "bad.host", block: false });
  };
  switch (type) {
    case "url":
      site("url");
      break;
    case "phone":
    case "sms":
      out.push(phoneProblem("phone", v("phone"), false));
      break;
    case "whatsapp":
    case "viber":
      out.push(phoneProblem("phone", v("phone"), true));
      break;
    case "email":
      out.push(emailProblem("email", v("email"), true));
      break;
    case "contact":
      out.push(phoneProblem("phone", v("phone"), false), emailProblem("email", v("email"), true));
      site("website");
      break;
    case "event":
      if (v("start") && v("end") && v("end") < v("start")) out.push({ field: "end", key: "bad.endBeforeStart", block: true });
      break;
    case "wifi":
      if (v("ssid") && (f.security || "WPA") !== "nopass" && !f.password) out.push({ field: "password", key: "bad.wifiNoPass", block: false });
      break;
    case "instagram":
    case "facebook":
    case "tiktok":
    case "youtube":
    case "linkedin":
    case "x": {
      const u = v("username").replace(/\s+/g, "");
      if (!isLink(u)) break;
      const host = normalizeUrl(u).replace(/^https?:\/\//i, "").split(/[/?#]/)[0].toLowerCase();
      if (!NETWORK_SITES[type]!.test(host)) out.push({ field: "username", key: "bad.otherSite", block: false, arg: host.replace(/^www\./, "") });
      break;
    }
  }
  return out.filter((p): p is Problem => !!p);
}

/** Какого обязательного поля не хватает, чтобы код можно было скачать (у визитки хватит любого поля — тогда null). */
export function missingOf(type: ContentType, f: Fields): string | null {
  if (buildPayload(type, f) || type === "contact") return null;
  const need: Partial<Record<ContentType, string[]>> = { wifi: ["ssid"], event: ["title", "start"], location: ["place"] };
  return (need[type] ?? [FIELDS[type][0]]).find((k) => !(f[k] ?? "").trim()) ?? null;
}
