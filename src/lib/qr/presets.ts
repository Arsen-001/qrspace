// Готовые стили в генераторе: один клик — и код уже красивый, дальше можно менять что угодно.
// Без текстур (их рисование тяжёлое) и без картинок; логотип и фото человека при выборе стиля остаются.
import type { StyleState } from "@/components/StylePanel";

export type StylePreset = { id: string; style: Pick<StyleState, "fg" | "bg" | "eyeColor" | "eyeBallColor" | "dot" | "eye" | "eyeBall" | "gradient" | "effect"> };

const p = (id: string, fg: string, bg: string, dot: StyleState["dot"], eye: StyleState["eye"], eyeBall: StyleState["eyeBall"], extra: Partial<StylePreset["style"]> = {}): StylePreset => ({
  id,
  style: { fg, bg, eyeColor: fg, eyeBallColor: fg, dot, eye, eyeBall, gradient: null, effect: "none", ...extra },
});

export const STYLE_PRESETS: StylePreset[] = [
  p("classic", "#111111", "#ffffff", "square", "square", "auto"),
  p("soft", "#1b2a4a", "#ffffff", "rounded", "rounded", "auto"),
  p("dots", "#4c1d95", "#f7f3ff", "dots", "circle", "circle"),
  p("lime", "#0b0b0c", "#c6ff2e", "rounded", "drop", "drop"),
  p("night", "#f3f2ec", "#0b0b0c", "liquid", "rounded", "rounded", { eyeBallColor: "#c6ff2e" }),
  p("hearts", "#9b1b2a", "#fff5f5", "heart", "circle", "circle"),
  p("stars", "#151a3d", "#ffffff", "star", "octagon", "star", { eyeBallColor: "#5b2a86" }),
  p("circuit", "#0b5132", "#e6f4ea", "circuit", "chip", "square"),
  p("gradient", "#7a1f2b", "#ffffff", "diamond", "leaf", "leaf", { gradient: { to: "#2e3fd6", angle: 45 } }),
  p("raised", "#111111", "#f3efe6", "rounded", "rounded", "auto", { effect: "raised" }),
];

/** Совпадает ли оформление с готовым стилем (чтобы подсветить выбранный). */
export const isPreset = (s: StyleState, pr: StylePreset) =>
  !s.texture && (Object.keys(pr.style) as (keyof StylePreset["style"])[]).every((k) => JSON.stringify(s[k]) === JSON.stringify(pr.style[k]));
