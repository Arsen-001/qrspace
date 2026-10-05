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

// В строке Wi-Fi спецсимволы экранируются обратной чертой.
const wifiEscape = (s: string) => s.replace(/([\\;,:"])/g, "\\$1");
const vcardEscape = (s: string) => s.replace(/([\\;,])/g, "\\$1").replace(/\n/g, "\\n");

function normalizeUrl(raw: string): string {
  const s = raw.trim();
  if (!s) return "";
  if (/^[a-z][a-z\d+.-]*:/i.test(s)) return s;
  return `https://${s}`;
}

/** «2026-10-10T18:30» из поля даты → «20261010T183000» для календаря (местное время). */
const icsDate = (s: string) => s.replace(/[-:]/g, "").padEnd(13, "0").slice(0, 13) + "00";

/** Готовая строка для кода или "" — если главное поле пустое. */
export function buildPayload(type: ContentType, f: Fields): string {
  const v = (k: string) => (f[k] ?? "").trim();
  switch (type) {
    case "sms": {
      const n = digits(v("phone"));
      return n ? `SMSTO:${n}:${v("message")}` : "";
    }
    case "viber": {
      const n = digits(v("phone"));
      return n ? `viber://chat?number=${encodeURIComponent(n.startsWith("+") ? n : `+${n}`)}` : "";
    }
    case "location": {
      const q = v("place");
      if (!q) return "";
      // Координаты «40.18, 44.51» — точкой на карте, иначе — поиском по адресу.
      const m = q.match(/^\s*(-?\d+(?:\.\d+)?)\s*[,;\s]\s*(-?\d+(?:\.\d+)?)\s*$/);
      return m ? `https://maps.google.com/?q=${m[1]},${m[2]}` : `https://maps.google.com/?q=${encodeURIComponent(q)}`;
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
      const u = v("username");
      if (!u) return "";
      if (/^https?:\/\//i.test(u) || /\.(com|me)\//i.test(u)) return normalizeUrl(u);
      return SOCIAL[type](u.replace(/^@/, ""));
    }
    case "url":
      return normalizeUrl(v("url"));
    case "text":
      return f.text ?? "";
    case "wifi": {
      if (!v("ssid")) return "";
      const sec = v("security") || "WPA";
      const pass = sec === "nopass" ? "" : `P:${wifiEscape(f.password ?? "")};`;
      return `WIFI:T:${sec};S:${wifiEscape(f.ssid ?? "")};${pass};`;
    }
    case "phone":
      return v("phone") ? `tel:${digits(v("phone"))}` : "";
    case "whatsapp": {
      const n = digits(v("phone")).replace(/^\+/, "");
      if (!n) return "";
      return v("message") ? `https://wa.me/${n}?text=${encodeURIComponent(v("message"))}` : `https://wa.me/${n}`;
    }
    case "telegram": {
      const u = v("username").replace(/^@/, "").replace(/^https?:\/\/t\.me\//, "");
      return u ? `https://t.me/${u}` : "";
    }
    case "email": {
      if (!v("email")) return "";
      const q = new URLSearchParams();
      if (v("subject")) q.set("subject", v("subject"));
      if (v("body")) q.set("body", v("body"));
      const qs = q.toString().replace(/\+/g, "%20");
      return `mailto:${v("email")}${qs ? `?${qs}` : ""}`;
    }
    case "contact": {
      if (!v("firstName") && !v("lastName") && !v("phone")) return "";
      const lines = [
        "BEGIN:VCARD",
        "VERSION:3.0",
        `N:${vcardEscape(v("lastName"))};${vcardEscape(v("firstName"))};;;`,
        `FN:${vcardEscape([v("firstName"), v("lastName")].filter(Boolean).join(" "))}`,
        v("phone") && `TEL;TYPE=CELL:${digits(v("phone"))}`,
        v("email") && `EMAIL:${v("email")}`,
        v("company") && `ORG:${vcardEscape(v("company"))}`,
        v("website") && `URL:${normalizeUrl(v("website"))}`,
        "END:VCARD",
      ];
      return lines.filter(Boolean).join("\n");
    }
  }
}
