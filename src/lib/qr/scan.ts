// Сканер на сайте (владелец 09.10.2026: «у нас должен быть и наш сканер», «а можно сканер для штрихкодов?»): что
// прочитала камера → понятное содержимое с кнопками (как после скана нашего кода) или штрихкод с номером.
import type { Content } from "./payload";

export type Scanned = { kind: "barcode"; number: string; format: string } | { kind: "content"; content: Content };

/** Двумерные коды (в них может быть что угодно); остальные — штрихкоды товаров, посылок и т. п. (в них номер). */
const MATRIX = new Set(["QRCode", "MicroQRCode", "rMQRCode", "DataMatrix", "Aztec", "PDF417", "MaxiCode"]);

/** «Ключ:значение;» с обратной чертой перед спецсимволами (Wi‑Fi, MECARD). */
function fieldsOf(body: string): Record<string, string> {
  const out: Record<string, string> = {};
  let key = "";
  let val = "";
  let inVal = false;
  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (ch === "\\" && i + 1 < body.length) {
      if (inVal) val += body[++i];
      else key += body[++i];
    } else if (!inVal && ch === ":") inVal = true;
    else if (inVal && ch === ";") {
      if (key) out[key.toUpperCase()] = out[key.toUpperCase()] ? `${out[key.toUpperCase()]}\n${val}` : val;
      key = val = "";
      inVal = false;
    } else if (inVal) val += ch;
    else key += ch;
  }
  if (key && inVal) out[key.toUpperCase()] = val;
  return out;
}

/** Строки vCard / iCalendar: «ИМЯ;параметры:значение», продолжение строки — с пробела. */
function linesOf(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of text.replace(/\r?\n[ \t]/g, "").split(/\r?\n/)) {
    const at = line.indexOf(":");
    if (at < 0) continue;
    const name = line.slice(0, at).split(";")[0].toUpperCase();
    if (!(name in out)) out[name] = line.slice(at + 1).replace(/\\n/gi, "\n").replace(/\\([,;\\])/g, "$1");
  }
  return out;
}

/** «20261010T183000Z» → «2026-10-10T18:30» (как поле даты в генераторе). */
const fromIcs = (s = "") => {
  const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2}))?/.exec(s);
  return m ? `${m[1]}-${m[2]}-${m[3]}T${m[4] ?? "00"}:${m[5] ?? "00"}` : "";
};

export function parseScanned(text: string, format: string): Scanned {
  const s = text.trim();
  if (!MATRIX.has(format)) return { kind: "barcode", number: s, format };
  const c = (type: Content["type"], fields: Record<string, string>): Scanned => ({ kind: "content", content: { type, fields } });
  const low = s.toLowerCase();

  if (low.startsWith("wifi:")) {
    const f = fieldsOf(s.slice(5));
    const t = (f.T ?? "").toUpperCase();
    return c("wifi", { ssid: f.S ?? "", password: f.P ?? "", security: t === "WEP" ? "WEP" : t === "NOPASS" || (!t && !f.P) ? "nopass" : "WPA" });
  }
  if (/^https?:\/\//i.test(s)) return c("url", { url: s });
  if (low.startsWith("tel:")) return c("phone", { phone: s.slice(4) });
  if (low.startsWith("smsto:") || low.startsWith("sms:")) {
    const [phone, ...msg] = s.replace(/^sms(to)?:/i, "").split(/[:?]/);
    return c("sms", { phone, message: msg.join(":").replace(/^body=/i, "") });
  }
  if (low.startsWith("mailto:")) {
    const u = new URL(s);
    return c("email", { email: decodeURIComponent(u.pathname), subject: u.searchParams.get("subject") ?? "", body: u.searchParams.get("body") ?? "" });
  }
  if (low.startsWith("matmsg:")) {
    const f = fieldsOf(s.slice(7));
    return c("email", { email: f.TO ?? "", subject: f.SUB ?? "", body: f.BODY ?? "" });
  }
  if (low.startsWith("geo:")) return c("location", { place: s.slice(4).split("?")[0] });
  if (low.startsWith("mecard:")) {
    const f = fieldsOf(s.slice(7));
    const [last = "", first = ""] = (f.N ?? "").split(",");
    return c("contact", { firstName: first, lastName: last, phone: (f.TEL ?? "").split("\n")[0], email: (f.EMAIL ?? "").split("\n")[0], company: f.ORG ?? "", website: f.URL ?? "" });
  }
  if (low.startsWith("begin:vcard")) {
    const f = linesOf(s);
    const [last = "", first = ""] = (f.N ?? "").split(";");
    const fn = !first && !last ? (f.FN ?? "") : "";
    return c("contact", { firstName: first || fn, lastName: last, phone: f.TEL ?? "", email: f.EMAIL ?? "", company: (f.ORG ?? "").split(";")[0], website: f.URL ?? "" });
  }
  if (low.startsWith("begin:vcalendar") || low.startsWith("begin:vevent")) {
    const f = linesOf(s);
    return c("event", { title: f.SUMMARY ?? "", start: fromIcs(f.DTSTART), end: fromIcs(f.DTEND), place: f.LOCATION ?? "", notes: f.DESCRIPTION ?? "" });
  }
  // Адрес без http (www.site.com) — тоже ссылка.
  if (/^(www\.)?[a-z0-9-]+(\.[a-z0-9-]+)+(\/\S*)?$/i.test(s)) return c("url", { url: `https://${s}` });
  return c("text", { text: s });
}
