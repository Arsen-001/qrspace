// Оформление кода приходит от браузера и потом рисуется у других людей (маркет, лоты, заказы) — поэтому сервер
// пересобирает его заново только из известных полей и проверенных значений. Всё лишнее и странное — отбрасываем.
import { DOT_STYLES, EFFECTS, EYE_BALLS, EYE_STYLES } from "./render";
import { CODE_SHAPES, ORNAMENTS } from "./shapes";
import type { SavedStyle } from "./style";
import { TEXTURES } from "./textures";

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => !!v && typeof v === "object" && !Array.isArray(v);
const hex = (v: unknown) => (typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v) ? v.toLowerCase() : null);
const num = (v: unknown, min: number, max: number) => (typeof v === "number" && Number.isFinite(v) && v >= min && v <= max ? v : null);
const oneOf = <T extends string>(v: unknown, list: readonly T[]) => (list.includes(v as T) ? (v as T) : null);
const b64 = (v: unknown) => (typeof v === "string" && /^[A-Za-z0-9+/]*={0,2}$/.test(v) ? v : null);
/** Только картинки, только base64 — никаких ссылок наружу и разметки. */
const image = (v: unknown) =>
  typeof v === "string" && (/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(v) || /^\/api\/asset\/[0-9a-f]{32}\.(png|jpg|webp)$/.test(v)) ? v : null;

export function sanitizeStyle(v: unknown): SavedStyle | null {
  if (!isObj(v)) return null;
  const fg = hex(v.fg);
  const bg = hex(v.bg);
  const eyeColor = hex(v.eyeColor);
  const eyeBallColor = hex(v.eyeBallColor);
  const dot = oneOf(v.dot, DOT_STYLES);
  const eye = oneOf(v.eye, EYE_STYLES);
  const eyeBall = oneOf(v.eyeBall, EYE_BALLS);
  const effect = oneOf(v.effect, EFFECTS);
  const rotate = ([0, 90, 180, 270] as const).find((r) => r === v.rotate);
  if (!fg || !bg || !eyeColor || !eyeBallColor || !dot || !eye || !eyeBall || !effect || rotate === undefined) return null;

  let gradient: SavedStyle["gradient"] = null;
  if (v.gradient !== null && v.gradient !== undefined) {
    const g = isObj(v.gradient) ? v.gradient : {};
    const to = hex(g.to);
    const angle = num(g.angle, 0, 360);
    if (!to || angle === null) return null;
    gradient = { to, angle };
  }
  const texture = v.texture === null || v.texture === undefined ? null : oneOf(v.texture, TEXTURES);
  if (v.texture && !texture) return null;

  let logo: SavedStyle["logo"] = null;
  if (v.logo) {
    const l = isObj(v.logo) ? v.logo : {};
    const src = image(l.src);
    const scale = num(l.scale, 0.05, 0.5);
    if (!src || scale === null) return null;
    logo = { src, scale };
  }
  let eyeIcon: SavedStyle["eyeIcon"] = null;
  if (v.eyeIcon) {
    const e = isObj(v.eyeIcon) ? v.eyeIcon : {};
    const m = isObj(e.mask) ? e.mask : {};
    const w = num(m.w, 1, 128);
    const data = b64(m.data);
    const preview = image(e.preview);
    const strength = num(e.strength, 0, 1);
    if (w === null || !Number.isInteger(w) || !data || !preview || strength === null) return null;
    eyeIcon = { mask: { w, data }, preview, strength };
  }
  let picture: SavedStyle["picture"] = null;
  if (v.picture) {
    const p = isObj(v.picture) ? v.picture : {};
    const t = isObj(p.tones) ? p.tones : {};
    const src = image(p.src);
    const tw = num(t.w, 1, 1024);
    const tdata = b64(t.data);
    const layout = typeof p.layout === "string" && /^[\w-]{1,20}$/.test(p.layout) ? p.layout : null;
    const dotSize = num(p.dotSize, 0.1, 1);
    if (!src || tw === null || !Number.isInteger(tw) || !tdata || !layout || dotSize === null || typeof p.mono !== "boolean") return null;
    picture = { src, tones: { w: tw, data: tdata }, layout, dotSize, mono: p.mono };
  }
  // Подпись под кодом: обычный текст, до 40 знаков, без управляющих символов.
  const caption = typeof v.caption === "string" ? v.caption.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 40) : "";
  // Номер под кодом: цифры, пробелы, плюс, скобки, дефисы.
  const captionPhone = typeof v.captionPhone === "string" ? v.captionPhone.replace(/[^\d+()\s-]/g, "").trim().slice(0, 24) : "";
  // Форма кода (круг, сердце…); нет или неизвестная — квадрат.
  const shape = oneOf(v.shape, CODE_SHAPES);
  const ornament = oneOf(v.ornament, ORNAMENTS);
  return { fg, bg, eyeColor, eyeBallColor, dot, eye, eyeBall, gradient, rotate, effect, texture, eyeIcon, logo, picture, ...(caption && { caption }), ...(captionPhone && { captionPhone }), ...(shape && shape !== "square" && { shape }), ...(ornament && ornament !== "none" && { ornament }) };
}
