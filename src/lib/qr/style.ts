// Оформление кода: как оно лежит в панели (StyleState), как сохраняется у нас (SavedStyle — чистый JSON)
// и как превращается в настройки рисунка (QrStyle).
import type { StyleState } from "@/components/StylePanel";
import type { QrStyle } from "./render";
import { textureSrc } from "./textures";

export type SavedStyle = Omit<StyleState, "eyeIcon" | "picture"> & {
  eyeIcon: { mask: { w: number; data: string }; preview: string; strength: number } | null;
  /** Исходные фото не храним — только готовый коллаж и его тона. */
  picture: { src: string; tones: { w: number; data: string }; layout: string; dotSize: number; mono: boolean } | null;
};

export const DEFAULT_STYLE: StyleState = {
  fg: "#111111",
  bg: "#ffffff",
  eyeColor: "#111111",
  dot: "square",
  eye: "square",
  eyeBall: "auto",
  eyeBallColor: "#111111",
  gradient: null,
  rotate: 0,
  effect: "none",
  texture: null,
  eyeIcon: null,
  logo: null,
  picture: null,
};

function toB64(bytes: Uint8Array | Uint8ClampedArray): string {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

function fromB64(b64: string): Uint8Array {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

export function toSaved(s: StyleState): SavedStyle {
  return {
    ...s,
    eyeIcon: s.eyeIcon && { mask: { w: s.eyeIcon.mask.w, data: toB64(s.eyeIcon.mask.data) }, preview: s.eyeIcon.preview, strength: s.eyeIcon.strength },
    picture: s.picture && {
      src: s.picture.src,
      tones: { w: s.picture.tones.w, data: toB64(s.picture.tones.data) },
      layout: s.picture.layout,
      dotSize: s.picture.dotSize,
      mono: s.picture.mono,
    },
  };
}

export function fromSaved(s: SavedStyle): StyleState {
  return {
    ...DEFAULT_STYLE,
    ...s,
    eyeIcon: s.eyeIcon && { mask: { w: s.eyeIcon.mask.w, data: fromB64(s.eyeIcon.mask.data) }, preview: s.eyeIcon.preview, strength: s.eyeIcon.strength },
    picture: s.picture && {
      files: [],
      src: s.picture.src,
      tones: { w: s.picture.tones.w, data: new Uint8ClampedArray(fromB64(s.picture.tones.data)) },
      layout: s.picture.layout,
      dotSize: s.picture.dotSize,
      mono: s.picture.mono,
    },
  };
}

/** Настройки рисунка; только в браузере (текстура рисуется на canvas). */
export function toQrStyle(s: StyleState): QrStyle {
  return {
    fg: s.fg,
    bg: s.bg,
    // Свой цвет углов передаём, только если его меняли: иначе на фото углы берут цвет фото.
    eyeColor: s.eyeColor !== s.fg ? s.eyeColor : undefined,
    eyeBallColor: s.eyeBallColor !== s.eyeColor ? s.eyeBallColor : undefined,
    gradient: s.gradient,
    rotate: s.rotate,
    effect: s.effect,
    texture: s.texture ? textureSrc(s.texture) : null,
    eyeIcon: s.eyeIcon && { mask: s.eyeIcon.mask, strength: s.eyeIcon.strength },
    dot: s.dot,
    eye: s.eye,
    eyeBall: s.eyeBall,
    logo: s.logo,
    caption: s.caption,
    picture: s.picture && { src: s.picture.src, dotSize: s.picture.dotSize, tones: s.picture.tones },
  };
}
