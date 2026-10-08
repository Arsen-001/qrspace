// Рисунок кода — список фигур (контуры SVG + картинки). Из одного списка собираем SVG-файл
// и рисуем на canvas (PNG, проверка «сканируется ли»), поэтому файл и превью всегда совпадают.
import QRCode from "qrcode";

export const DOT_STYLES = ["square", "rounded", "dots", "diamond", "star", "heart", "plus", "liquid", "leaf", "circuit"] as const;
export const EYE_STYLES = ["square", "rounded", "circle", "leaf", "drop", "dropOut", "octagon", "mixed", "dotted", "chip", "ornate"] as const;
export type DotStyle = (typeof DOT_STYLES)[number];
/** Центр угла отдельно от рамки; auto — в пару к рамке. */
export const EYE_BALLS = ["auto", "square", "rounded", "circle", "leaf", "drop", "dropOut", "octagon", "diamond", "star", "dots"] as const;
export type EyeBall = (typeof EYE_BALLS)[number];
export type EyeStyle = (typeof EYE_STYLES)[number];

export type QrStyle = {
  fg: string;
  bg: string;
  dot: DotStyle;
  eye: EyeStyle;
  /** Цвет «глаз» (три больших квадрата); пусто — как у точек. */
  eyeColor?: string;
  /** Форма центра глаза; auto — в пару к рамке. */
  eyeBall?: EyeBall;
  /** Свой цвет центра глаза; пусто — как у рамки глаза. */
  eyeBallColor?: string;
  /** Градиент точек: от fg к `to` под углом `angle` (градусы). */
  gradient?: { to: string; angle: number } | null;
  /** Поворот кода; фото и логотип остаются ровными. */
  rotate?: Rotation;
  /** Объём: выпуклые точки (тень снаружи) или вырезанные (тень внутри). */
  effect?: Effect;
  /** Текстура фона (картинка) — вместо ровного цвета фона. */
  texture?: string | null;
  /** Свой значок в центре углов — тиснением (чуть светлее центра), strength — насколько светлее. */
  eyeIcon?: { mask: IconMask; strength: number } | null;
  logo?: { src: string; scale: number } | null;
  /** Текст под кодом — по ширине кода (владелец 08.10.2026). */
  caption?: string | null;
  /** QR-картинка: фото под кодом, от каждой клетки остаётся точка в центре. */
  picture?: { src: string; dotSize: number; tones?: Tones } | null;
};

/** Уменьшенная копия фото (RGBA, w×w) — из неё берём цвет точек. */
export type Tones = { w: number; data: Uint8ClampedArray };

const hex = (r: number, g: number, b: number) =>
  "#" + [r, g, b].map((v) => (Math.min(255, Math.max(0, Math.round(v / 6) * 6)) | 0).toString(16).padStart(2, "0")).join("");
const hexRgb = (h: string): [number, number, number] => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
/** Смесь двух цветов #rrggbb: t = доля второго. */
function mix(a: string, b: string, t: number): string {
  if (!/^#[\da-f]{6}$/i.test(a) || !/^#[\da-f]{6}$/i.test(b)) return a;
  const x = hexRgb(a);
  const y = hexRgb(b);
  return "#" + x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, "0")).join("");
}
const lumOf = (r: number, g: number, b: number) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;

/** Тёмная точка — тот же цвет фото, затемнённый; светлая — осветлённый. Так код не спорит с картинкой. */
function darkTone(r: number, g: number, b: number): string {
  const k = Math.min(1, 0.15 / Math.max(lumOf(r, g, b), 0.01));
  return hex(r * k, g * k, b * k);
}
function lightTone(r: number, g: number, b: number): string {
  const l = lumOf(r, g, b);
  const t = Math.min(1, Math.max(0, (0.88 - l) / (1 - l)));
  return hex(r + (255 - r) * t, g + (255 - g) * t, b + (255 - b) * t);
}

export type Rotation = 0 | 90 | 180 | 270;
/** Силуэт значка: w×w клеток, 1 — значок, 0 — пусто. */
export type IconMask = { w: number; data: Uint8Array };

/** Силуэт значка → контур из прямоугольников (подряд идущие клетки строки — одним прямоугольником). */
function iconPath(mask: IconMask, x0: number, y0: number, box: number): string {
  const px = box / mask.w;
  let d = "";
  for (let j = 0; j < mask.w; j++) {
    let i = 0;
    while (i < mask.w) {
      if (!mask.data[j * mask.w + i]) {
        i++;
        continue;
      }
      const start = i;
      while (i < mask.w && mask.data[j * mask.w + i]) i++;
      d += `M${n(x0 + start * px)} ${n(y0 + j * px)}h${n((i - start) * px)}v${n(px)}h${n(-(i - start) * px)}Z`;
    }
  }
  return d;
}
export const EFFECTS = ["none", "raised", "carved"] as const;
export type Effect = (typeof EFFECTS)[number];
export type Gradient = { kind: "linear"; from: string; to: string; x1: number; y1: number; x2: number; y2: number };
export type Fill = string | Gradient;

/** fixed — не поворачивается вместе с кодом (фон, фото, логотип). */
export type Shape =
  | { kind: "path"; d: string; fill: Fill; rule?: "evenodd"; opacity?: number; fixed?: boolean; effect?: Effect }
  | { kind: "image"; src: string; x: number; y: number; w: number; h: number; fixed?: boolean }
  | { kind: "text"; text: string; x: number; y: number; size: number; fill: string; fixed: true };

/** height — с подписью под кодом рисунок выше, чем шире (без подписи = size). */
export type Drawing = { size: number; shapes: Shape[]; rotate: Rotation; height?: number };

/** Шрифт подписи: жирный и есть везде — в PNG, SVG и на телефоне выглядит одинаково. */
export const CAPTION_FONT = '"Arial Black", Arial, Helvetica, sans-serif';
export const CAPTION_MAX = 40;

const QUIET = 4; // пустая рамка вокруг кода в клетках — без неё телефоны читают хуже

const n = (v: number) => Math.round(v * 1000) / 1000;

/** Углы по часовой: левый верхний, правый верхний, правый нижний, левый нижний. */
type Radii = [number, number, number, number];

/** Прямоугольник со своим скруглением у каждого угла, обход по часовой. */
function roundRect(x: number, y: number, w: number, h: number, [tl, tr, br, bl]: Radii): string {
  const arc = (r: number, ex: number, ey: number) => (r > 0 ? `A${n(r)} ${n(r)} 0 0 1 ${n(ex)} ${n(ey)}` : `L${n(ex)} ${n(ey)}`);
  return (
    `M${n(x + tl)} ${n(y)}H${n(x + w - tr)}${arc(tr, x + w, y + tr)}` +
    `V${n(y + h - br)}${arc(br, x + w - br, y + h)}` +
    `H${n(x + bl)}${arc(bl, x, y + h - bl)}` +
    `V${n(y + tl)}${arc(tl, x + tl, y)}Z`
  );
}

/** Прямоугольник против часовой — внутри фигуры по часовой даёт вырез. */
const holeRect = (x: number, y: number, w: number, h: number) => `M${n(x)} ${n(y)}v${n(h)}h${n(w)}v${n(-h)}Z`;

const rectPath = (x: number, y: number, w: number, h: number, r = 0) => roundRect(x, y, w, h, [r, r, r, r]);

/** Прямоугольник со срезанными углами (восьмиугольник). */
function cutRect(x: number, y: number, s: number, c: number): string {
  const p = [
    [x + c, y], [x + s - c, y], [x + s, y + c], [x + s, y + s - c],
    [x + s - c, y + s], [x + c, y + s], [x, y + s - c], [x, y + c],
  ];
  return `M${p.map(([a, b]) => `${n(a)} ${n(b)}`).join("L")}Z`;
}

const HEART: [number, number][][] = [
  [[0.5, 0.92]],
  [[0.12, 0.64], [0, 0.42], [0, 0.29]],
  [[0, 0.13], [0.13, 0.02], [0.28, 0.02]],
  [[0.39, 0.02], [0.47, 0.09], [0.5, 0.17]],
  [[0.53, 0.09], [0.61, 0.02], [0.72, 0.02]],
  [[0.87, 0.02], [1, 0.13], [1, 0.29]],
  [[1, 0.42], [0.88, 0.64], [0.5, 0.92]],
];

type Neighbors = { t: boolean; r: boolean; b: boolean; l: boolean };
const NONE: Neighbors = { t: false, r: false, b: false, l: false };

/**
 * Одна клетка кода. (x, y) — левый верхний угол клетки, s — доля клетки, которую занимает фигура
 * (в QR-картинке меньше). Центр клетки у всех фигур закрашен — по нему телефон и читает код.
 */
function modulePath(kind: DotStyle, x: number, y: number, s: number, nb: Neighbors): string {
  const cx = x + 0.5;
  const cy = y + 0.5;
  const h = s / 2;
  switch (kind) {
    case "square":
      return rectPath(cx - h, cy - h, s, s);
    case "rounded":
      return rectPath(cx - h * 0.9, cy - h * 0.9, s * 0.9, s * 0.9, s * 0.3);
    case "dots":
      return rectPath(cx - h * 0.9, cy - h * 0.9, s * 0.9, s * 0.9, h * 0.9);
    case "diamond": {
      const d = h * 1.08;
      return `M${n(cx)} ${n(cy - d)}L${n(cx + d)} ${n(cy)}L${n(cx)} ${n(cy + d)}L${n(cx - d)} ${n(cy)}Z`;
    }
    case "star": {
      const pts: string[] = [];
      for (let i = 0; i < 10; i++) {
        const r = i % 2 ? h * 0.5 : h * 1.08;
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        pts.push(`${n(cx + r * Math.cos(a))} ${n(cy + 0.06 * s + r * Math.sin(a))}`);
      }
      return `M${pts.join("L")}Z`;
    }
    case "heart": {
      const k = s * 1.02;
      const o = (1 - k) / 2;
      const pt = ([a, b]: [number, number]) => `${n(x + o + a * k)} ${n(y + o + b * k)}`;
      return `M${pt(HEART[0][0])}` + HEART.slice(1).map((c) => `C${c.map(pt).join(" ")}`).join("") + "Z";
    }
    case "plus": {
      const w = s * 0.38;
      return rectPath(cx - w / 2, cy - h, w, s, w * 0.2) + rectPath(cx - h, cy - w / 2, s, w, w * 0.2);
    }
    case "leaf":
      return roundRect(cx - h * 0.95, cy - h * 0.95, s * 0.95, s * 0.95, [h * 0.95, 0, h * 0.95, 0]);
    case "circuit": {
      // Плата: площадка в центре клетки, дорожки к соседям справа и снизу (каждая — один раз);
      // одинокая клетка — площадка крупнее. Центр клетки всегда закрашен: по нему телефон читает код.
      const lone = !nb.t && !nb.r && !nb.b && !nb.l;
      const pad = lone ? 0.86 : 0.74;
      const w = s * 0.4;
      let d = rectPath(cx - h * pad, cy - h * pad, s * pad, s * pad, h * pad);
      if (nb.r) d += rectPath(cx, cy - w / 2, 1, w);
      if (nb.b) d += rectPath(cx - w / 2, cy, w, 1);
      return d;
    }
    case "liquid": {
      // Угол скругляем, только если с обеих его сторон соседей нет, — соседние клетки сливаются в линии.
      const r = h;
      return roundRect(cx - h, cy - h, s, s, [!nb.t && !nb.l ? r : 0, !nb.t && !nb.r ? r : 0, !nb.b && !nb.r ? r : 0, !nb.b && !nb.l ? r : 0]);
    }
  }
}

type EyePos = "tl" | "tr" | "bl" | "br";
/** Угол глаза, смотрящий в центр кода. */
const INWARD: Record<EyePos, number> = { tl: 2, tr: 3, bl: 1, br: 0 };

/** Скругления внешней рамки глаза (7×7) по углам. */
function eyeRadii(style: EyeStyle, pos: EyePos): Radii {
  switch (style) {
    case "rounded":
      return [1.6, 1.6, 1.6, 1.6];
    case "circle":
      return [3.5, 3.5, 3.5, 3.5];
    case "leaf":
      return pos === "tl" || pos === "br" ? [3, 0, 3, 0] : [0, 3, 0, 3];
    case "drop":
    case "dropOut": {
      // Капля: острый угол к центру кода (drop) или наружу (dropOut).
      const r: Radii = [3, 3, 3, 3];
      r[style === "drop" ? INWARD[pos] : (INWARD[pos] + 2) % 4] = 0.4;
      return r;
    }
    case "mixed":
      return [0.6, 0.6, 0.6, 0.6];
    case "dotted":
      return [1.2, 1.2, 1.2, 1.2];
    default:
      return [0, 0, 0, 0];
  }
}

/** «Глаз»: рамка (вырез середины — по правилу evenodd) и центр 3×3. */
function eyePaths(x: number, y: number, style: EyeStyle, pos: EyePos, dot: DotStyle): { ring: string; ball: string; rule?: "evenodd"; detail?: string; emboss?: string } {
  if (style === "ornate") {
    // Узор: насечки поперёк рамки (как протектор) и цветок в центре — рисуются цветом фона поверх.
    // Насечки узкие, цветок маленький: основа рамки и центра остаётся сплошной — по ней телефон находит угол.
    let detail = "";
    for (let k = 0.9; k < 6.2; k += 0.55) {
      detail += rectPath(x + k, y + 0.22, 0.09, 0.56) + rectPath(x + k, y + 6.22, 0.09, 0.56);
      detail += rectPath(x + 0.22, y + k, 0.56, 0.09) + rectPath(x + 6.22, y + k, 0.56, 0.09);
    }
    const cx = x + 3.5;
    const cy = y + 3.5;
    // Цветок — отдельно: его рисуем не цветом фона, а чуть светлее центра (тиснение), иначе центр
    // перестаёт быть тёмным и телефон не находит угол.
    let emboss = rectPath(cx - 0.17, cy - 0.17, 0.34, 0.34, 0.17);
    for (let i = 0; i < 6; i++) {
      const a = (i * Math.PI) / 3;
      emboss += rectPath(cx + Math.cos(a) * 0.62 - 0.22, cy + Math.sin(a) * 0.62 - 0.22, 0.44, 0.44, 0.22);
    }
    return {
      ring: roundRect(x, y, 7, 7, [2, 2, 2, 2]) + roundRect(x + 1, y + 1, 5, 5, [1.2, 1.2, 1.2, 1.2]),
      ball: rectPath(x + 2, y + 2, 3, 3, 0.9),
      rule: "evenodd",
      detail,
      emboss,
    };
  }
  if (style === "chip") {
    // Корпус микросхемы: рамка с ножками по сторонам, в центре кристалл с меткой первого вывода.
    let pins = "";
    // Ножки не ставим на среднюю линию — по ней телефон ищет угол; метка первого вывода — срезанный уголок.
    for (const k of [1.2, 5.8]) {
      pins += rectPath(x + k - 0.15, y - 0.3, 0.3, 0.3) + rectPath(x + k - 0.15, y + 7, 0.3, 0.3);
      pins += rectPath(x - 0.3, y + k - 0.15, 0.3, 0.3) + rectPath(x + 7, y + k - 0.15, 0.3, 0.3);
    }
    const b = (px: number, py: number) => `${n(px)} ${n(py)}`;
    return {
      ring: roundRect(x, y, 7, 7, [0.5, 0.5, 0.5, 0.5]) + roundRect(x + 1, y + 1, 5, 5, [0.2, 0.2, 0.2, 0.2]) + pins,
      ball: `M${b(x + 2.6, y + 2)}L${b(x + 5, y + 2)}L${b(x + 5, y + 5)}L${b(x + 2, y + 5)}L${b(x + 2, y + 2.6)}Z`,
      rule: "evenodd",
    };
  }
  if (style === "octagon") {
    return { ring: cutRect(x, y, 7, 2) + cutRect(x + 1, y + 1, 5, 1.45), ball: cutRect(x + 2, y + 2, 3, 0.9), rule: "evenodd" };
  }
  if (style === "dotted") {
    // «Как точки»: рамка и центр собраны из той же фигуры, что и весь код, — угол сливается с узором.
    const inRing = (i: number, j: number) => i >= 0 && j >= 0 && i < 7 && j < 7 && (i === 0 || j === 0 || i === 6 || j === 6);
    const inBall = (i: number, j: number) => i >= 2 && j >= 2 && i <= 4 && j <= 4;
    let ring = "";
    let ball = "";
    for (let i = 0; i < 7; i++)
      for (let j = 0; j < 7; j++) {
        const part = inRing(i, j) ? inRing : inBall(i, j) ? inBall : null;
        if (!part) continue;
        // Фигуры чуть крупнее клетки — смыкаются, и рамка читается как сплошная.
        const d = modulePath(dot, x + j, y + i, 1.18, { t: part(i - 1, j), r: part(i, j + 1), b: part(i + 1, j), l: part(i, j - 1) });
        if (part === inRing) ring += d;
        else ball += d;
      }
    // Под фигурами — тонкая сплошная рамка и центр: телефон ищет угол по сплошным линиям,
    // а отдельные сердечки или звёзды дают просветы.
    const base = rectPath(x + 0.2, y + 0.2, 6.6, 6.6, 0.4) + holeRect(x + 0.8, y + 0.8, 5.4, 5.4);
    return { ring: base + ring, ball: rectPath(x + 2.2, y + 2.2, 2.6, 2.6, 0.4) + ball };
  }
  const outer = eyeRadii(style, pos);
  const inner = outer.map((r) => Math.min(2.5, Math.max(0, r - 1))) as Radii;
  const ball = style === "mixed" ? ([1.5, 1.5, 1.5, 1.5] as Radii) : (outer.map((r) => (r * 3) / 7) as Radii);
  return { ring: roundRect(x, y, 7, 7, outer) + roundRect(x + 1, y + 1, 5, 5, inner), ball: roundRect(x + 2, y + 2, 3, 3, ball), rule: "evenodd" };
}

/** Центр глаза (3×3) своей формы. */
function ballPath(kind: Exclude<EyeBall, "auto">, x: number, y: number, pos: EyePos, dot: DotStyle): string {
  const bx = x + 2;
  const by = y + 2;
  const cx = bx + 1.5;
  const cy = by + 1.5;
  switch (kind) {
    case "square":
      return rectPath(bx, by, 3, 3);
    case "rounded":
      return rectPath(bx, by, 3, 3, 0.9);
    case "circle":
      return rectPath(bx, by, 3, 3, 1.5);
    case "leaf":
      return roundRect(bx, by, 3, 3, pos === "tl" || pos === "br" ? [1.4, 0, 1.4, 0] : [0, 1.4, 0, 1.4]);
    case "drop":
    case "dropOut": {
      const r: Radii = [1.3, 1.3, 1.3, 1.3];
      r[kind === "drop" ? INWARD[pos] : (INWARD[pos] + 2) % 4] = 0.15;
      return roundRect(bx, by, 3, 3, r);
    }
    case "octagon":
      return cutRect(bx, by, 3, 0.9);
    case "diamond": {
      const d = 1.9;
      return `M${n(cx)} ${n(cy - d)}L${n(cx + d)} ${n(cy)}L${n(cx)} ${n(cy + d)}L${n(cx - d)} ${n(cy)}Z`;
    }
    case "star": {
      const pts: string[] = [];
      for (let i = 0; i < 10; i++) {
        // Толстые лучи и сплошная середина: тонкая звезда оставляет в центре угла слишком много просвета.
        const r = i % 2 ? 1.2 : 1.95;
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        pts.push(`${n(cx + r * Math.cos(a))} ${n(cy + 0.1 + r * Math.sin(a))}`);
      }
      return `M${pts.join("L")}Z` + rectPath(cx - 1.15, cy - 1.05, 2.3, 2.3, 1.15);
    }
    case "dots": {
      // 3×3 точки той же формы, что и весь код, на тонкой сплошной основе — чтобы центр читался.
      let d = rectPath(bx + 0.1, by + 0.1, 2.8, 2.8, 0.5);
      const inBall = (i: number, j: number) => i >= 0 && j >= 0 && i < 3 && j < 3;
      for (let i = 0; i < 3; i++)
        for (let j = 0; j < 3; j++) d += modulePath(dot, bx + j, by + i, 1.05, { t: inBall(i - 1, j), r: inBall(i, j + 1), b: inBall(i + 1, j), l: inBall(i, j - 1) });
      return d;
    }
  }
}

/** Светлая подложка под глазом: его контур, расширенный на клетку, — фото видно вокруг. */
function eyeBackdrop(x: number, y: number, style: EyeStyle, pos: EyePos): string {
  if (style === "octagon") return cutRect(x - 1, y - 1, 9, 2.4);
  if (style === "chip") return rectPath(x - 1, y - 1, 9, 9, 0.6);
  if (style === "ornate") return rectPath(x - 1, y - 1, 9, 9, 2.6);
  const r = eyeRadii(style, pos).map((v) => (v > 0 ? Math.min(4.5, v + 1) : 0)) as Radii;
  return roundRect(x - 1, y - 1, 9, 9, r);
}

/** Образец формы точек для кнопки выбора (3×3 клетки). */
export function dotSample(kind: DotStyle): string {
  const m = [
    [1, 1, 0],
    [1, 0, 1],
    [0, 1, 1],
  ];
  const on = (r: number, c: number) => !!m[r]?.[c];
  let d = "";
  for (let r = 0; r < 3; r++)
    for (let c = 0; c < 3; c++)
      if (on(r, c)) d += modulePath(kind, c, r, 1, { t: on(r - 1, c), r: on(r, c + 1), b: on(r + 1, c), l: on(r, c - 1) });
  return d;
}

/** Образец центра для кнопки выбора: рамка-квадрат + центр. */
export const ballSample = (kind: Exclude<EyeBall, "auto">, dot: DotStyle) => ({ ring: rectPath(0, 0, 7, 7) + rectPath(1, 1, 5, 5), ball: ballPath(kind, 0, 0, "tl", dot) });

/** Образец глаза для кнопки выбора (7×7, левый верхний). */
export const eyeSample = (kind: EyeStyle, dot: DotStyle) => eyePaths(0, 0, kind, "tl", dot);

/** Средний цвет фото в центральной части клетки (x, y — в клетках всего рисунка размером size). */
function sampleTone(tones: Tones | undefined, size: number, x: number, y: number) {
  if (!tones) return null;
  const k = tones.w / size;
  const x0 = Math.floor((x + 0.2) * k);
  const y0 = Math.floor((y + 0.2) * k);
  const x1 = Math.max(x0 + 1, Math.ceil((x + 0.8) * k));
  const y1 = Math.max(y0 + 1, Math.ceil((y + 0.8) * k));
  let r = 0, g = 0, b = 0, cnt = 0;
  for (let j = y0; j < y1 && j < tones.w; j++)
    for (let i = x0; i < x1 && i < tones.w; i++) {
      const o = (j * tones.w + i) * 4;
      r += tones.data[o];
      g += tones.data[o + 1];
      b += tones.data[o + 2];
      cnt++;
    }
  if (!cnt) return null;
  r /= cnt;
  g /= cnt;
  b /= cnt;
  return { r, g, b, l: lumOf(r, g, b) };
}

export function buildDrawing(text: string, style: QrStyle): Drawing {
  // Логотип и фото закрывают часть клеток — тогда нужен самый сильный запас на ошибки (H, 30 %).
  const ecl = style.logo || style.picture ? "H" : "M";
  const qr = QRCode.create(text, { errorCorrectionLevel: ecl });
  const m = qr.modules;
  const count = m.size;
  const size = count + QUIET * 2;
  const rotate = style.rotate ?? 0;
  const shapes: Shape[] = [];

  // Где клетка (x, y) окажется после поворота кода — по этому месту берём цвет фото под ней.
  const turned = (x: number, y: number, w = 1): [number, number] =>
    rotate === 90 ? [size - y - w, x] : rotate === 180 ? [size - x - w, size - y - w] : rotate === 270 ? [y, size - x - w] : [x, y];

  let dotFill: Fill = style.fg;
  if (style.gradient) {
    const a = (style.gradient.angle * Math.PI) / 180;
    const c = size / 2;
    const dx = (Math.cos(a) * count) / 2;
    const dy = (Math.sin(a) * count) / 2;
    dotFill = { kind: "linear", from: style.fg, to: style.gradient.to, x1: c - dx, y1: c - dy, x2: c + dx, y2: c + dy };
  }
  const eyeColor = style.eyeColor || style.fg;
  const ballColor = style.eyeBallColor || eyeColor;

  // Подпись под кодом: полоса снизу; шрифт — чтобы строка заняла ширину кода, но не крупнее 3,6 клетки.
  const caption = (style.caption ?? "").trim().slice(0, CAPTION_MAX);
  const capFont = caption ? Math.min(3.6, (count * 0.98) / (caption.length * 0.66)) : 0;
  const height = caption ? size + capFont + 1.6 : size;
  shapes.push({ kind: "path", d: rectPath(0, 0, size, height), fill: style.bg, fixed: true });
  if (style.texture && !style.picture) shapes.push({ kind: "image", src: style.texture, x: 0, y: 0, w: size, h: height, fixed: true });
  const fx: Effect | undefined = style.effect && style.effect !== "none" ? style.effect : undefined;

  const inEye = (r: number, c: number) => (r < 7 && c < 7) || (r < 7 && c >= count - 7) || (r >= count - 7 && c < 7);

  // Клетки под логотипом не рисуем — их восстановит запас на ошибки.
  let logoBox: { x: number; y: number; w: number } | null = null;
  if (style.logo) {
    const w = Math.max(3, Math.round(count * style.logo.scale));
    const x = (count - w) / 2;
    logoBox = { x, y: x, w };
  }
  const underLogo = (r: number, c: number) =>
    !!logoBox && c + 1 > logoBox.x - 0.5 && c < logoBox.x + logoBox.w + 0.5 && r + 1 > logoBox.y - 0.5 && r < logoBox.y + logoBox.w + 0.5;
  const drawn = (r: number, c: number) =>
    r >= 0 && c >= 0 && r < count && c < count && !!m.get(r, c) && !inEye(r, c) && !underLogo(r, c);

  if (style.picture) {
    // Фото на весь квадрат, вместе с рамкой; рамку прикрываем полупрозрачным фоном — телефону нужен
    // спокойный край вокруг кода.
    shapes.push({ kind: "image", src: style.picture.src, x: 0, y: 0, w: size, h: size, fixed: true });
    shapes.push({
      kind: "path",
      d: rectPath(0, 0, size, size) + rectPath(QUIET - 0.5, QUIET - 0.5, count + 1, count + 1),
      fill: style.bg,
      rule: "evenodd",
      opacity: 0.82,
      fixed: true,
    });
  }

  let dark = "";
  let light = "";
  const toned = new Map<string, string>();
  const ds = style.picture ? style.picture.dotSize : 1;
  for (let r = 0; r < count; r++) {
    for (let c = 0; c < count; c++) {
      if (inEye(r, c) || underLogo(r, c)) continue;
      const on = !!m.get(r, c);
      const x = QUIET + c;
      const y = QUIET + r;
      if (style.picture) {
        const reserved = !!m.isReserved(r, c);
        const tone = sampleTone(style.picture.tones, size, ...turned(x, y));
        if (tone) {
          // Где фото само уже достаточно тёмное (или светлое) там, где нужно, — точку не рисуем:
          // код держится на самом фото, и шума меньше.
          if (on ? tone.l <= 0.2 : tone.l >= 0.86) continue;
          const d = modulePath(style.dot, x, y, reserved ? Math.max(ds, 0.7) : ds, NONE);
          const color = on ? darkTone(tone.r, tone.g, tone.b) : lightTone(tone.r, tone.g, tone.b);
          toned.set(color, (toned.get(color) ?? "") + d);
          continue;
        }
        // Служебные клетки (полосы синхронизации, выравнивание, формат) — целиком, остальные — точкой.
        const d = reserved ? rectPath(x, y, 1, 1) : modulePath(style.dot, x, y, ds, NONE);
        if (on) dark += d;
        else light += d;
        continue;
      }
      if (on) {
        dark += modulePath(style.dot, x, y, 1, { t: drawn(r - 1, c), r: drawn(r, c + 1), b: drawn(r + 1, c), l: drawn(r, c - 1) });
      } else if (style.dot === "liquid") {
        // «Жидкие»: во внутренних углах между тремя соседями — плавная перемычка, как капли сливаются.
        const f = 0.5;
        if (drawn(r - 1, c) && drawn(r, c - 1) && drawn(r - 1, c - 1)) dark += `M${x} ${y}h${f}A${f} ${f} 0 0 0 ${x} ${y + f}Z`;
        if (drawn(r - 1, c) && drawn(r, c + 1) && drawn(r - 1, c + 1)) dark += `M${x + 1} ${y}v${f}A${f} ${f} 0 0 0 ${x + 1 - f} ${y}Z`;
        if (drawn(r + 1, c) && drawn(r, c + 1) && drawn(r + 1, c + 1)) dark += `M${x + 1} ${y + 1}h${-f}A${f} ${f} 0 0 0 ${x + 1} ${y + 1 - f}Z`;
        if (drawn(r + 1, c) && drawn(r, c - 1) && drawn(r + 1, c - 1)) dark += `M${x} ${y + 1}v${-f}A${f} ${f} 0 0 0 ${x + f} ${y + 1}Z`;
      }
    }
  }
  // Объём — только у тёмных точек: светлые точки на фото остаются плоскими.
  for (const [fill, d] of toned) shapes.push({ kind: "path", d, fill, effect: lumOf(...hexRgb(fill)) < 0.5 ? fx : undefined });
  if (light) shapes.push({ kind: "path", d: light, fill: style.bg });
  if (dark) shapes.push({ kind: "path", d: dark, fill: dotFill, effect: fx });

  const eyes: [number, number, EyePos][] = [
    [0, 0, "tl"],
    [0, count - 7, "tr"],
    [count - 7, 0, "bl"],
  ];
  for (const [er, ec, pos] of eyes) {
    const x = QUIET + ec;
    const y = QUIET + er;
    let ring: Fill = eyeColor;
    let ball: Fill = ballColor;
    let back = style.bg;
    if (style.picture) {
      // На фото глаз берёт тёмный оттенок фото под собой, подложка — светлый: не чёрно-белая плашка.
      const tone = sampleTone(style.picture.tones, size, ...turned(x - 1, y - 1, 9).map((v) => v + 4) as [number, number]);
      if (tone && !style.eyeColor) {
        ring = ball = darkTone(tone.r, tone.g, tone.b);
        back = lightTone(tone.r, tone.g, tone.b);
      }
      if (style.eyeBallColor) ball = style.eyeBallColor;
      shapes.push({ kind: "path", d: eyeBackdrop(x, y, style.eye, pos), fill: back, opacity: 0.9 });
    }
    const p = eyePaths(x, y, style.eye, pos, style.dot);
    if (style.eyeBall && style.eyeBall !== "auto") p.ball = ballPath(style.eyeBall, x, y, pos, style.dot);
    shapes.push({ kind: "path", d: p.ring, fill: ring, rule: p.rule, effect: fx });
    shapes.push({ kind: "path", d: p.ball, fill: ball, effect: fx });
    // Насечки — не чистым фоном, а полутоном между рамкой и фоном: узор виден, рамка остаётся тёмной.
    if (p.detail) shapes.push({ kind: "path", d: p.detail, fill: typeof ring === "string" ? mix(ring, style.picture ? back : style.bg, 0.6) : style.bg });
    // Свой значок заменяет цветок «Узора»; оба — тиснение в центре угла.
    const emboss = style.eyeIcon ? iconPath(style.eyeIcon.mask, x + 2.3, y + 2.3, 2.4) : p.emboss;
    if (emboss && typeof ball === "string")
      shapes.push({ kind: "path", d: emboss, fill: mix(ball, style.picture ? back : style.bg, style.eyeIcon ? style.eyeIcon.strength : 0.18) });
  }

  if (logoBox && style.logo) {
    const { x, w } = logoBox;
    const pad = 0.4;
    shapes.push({ kind: "path", d: rectPath(QUIET + x - pad, QUIET + x - pad, w + 2 * pad, w + 2 * pad, w * 0.18), fill: style.bg, fixed: true });
    shapes.push({ kind: "image", src: style.logo.src, x: QUIET + x + 0.3, y: QUIET + x + 0.3, w: w - 0.6, h: w - 0.6, fixed: true });
  }

  if (caption) shapes.push({ kind: "text", text: caption, x: size / 2, y: size - QUIET / 2 + capFont * 0.82, size: capFont, fill: style.eyeColor || style.fg, fixed: true });

  return { size, shapes, rotate, ...(caption && { height }) };
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

export function toSvg(drawing: Drawing, px = 1024): string {
  const defs: string[] = [];
  const fill = (f: Fill) => {
    if (typeof f === "string") return esc(f);
    const id = `g${defs.length}`;
    defs.push(
      `<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${n(f.x1)}" y1="${n(f.y1)}" x2="${n(f.x2)}" y2="${n(f.y2)}">` +
        `<stop offset="0" stop-color="${esc(f.from)}"/><stop offset="1" stop-color="${esc(f.to)}"/></linearGradient>`,
    );
    return `url(#${id})`;
  };
  const used = new Set(drawing.shapes.flatMap((s) => (s.kind === "path" && s.effect ? [s.effect] : [])));
  // Свет сверху слева. Выпуклые: мягкая тень вправо-вниз. Вырезанные: тень внутри фигуры у верхнего левого края.
  if (used.has("raised"))
    defs.push(`<filter id="fx-raised" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0.1" dy="0.12" stdDeviation="0.08" flood-color="#000" flood-opacity="0.38"/></filter>`);
  if (used.has("carved"))
    defs.push(
      `<filter id="fx-carved" x="-10%" y="-10%" width="120%" height="120%"><feOffset in="SourceAlpha" dx="0.14" dy="0.16"/><feGaussianBlur stdDeviation="0.07" result="s"/>` +
        `<feComposite in="SourceAlpha" in2="s" operator="out" result="rim"/><feFlood flood-color="#000" flood-opacity="0.6"/><feComposite in2="rim" operator="in" result="shade"/>` +
        `<feMerge><feMergeNode in="SourceGraphic"/><feMergeNode in="shade"/></feMerge></filter>`,
    );
  const c = drawing.size / 2;
  const turn = drawing.rotate ? ` transform="rotate(${drawing.rotate} ${c} ${c})"` : "";
  const body = drawing.shapes
    .map((s) => {
      const el =
        s.kind === "path"
          ? `<path d="${s.d}" fill="${fill(s.fill)}"${s.rule ? ` fill-rule="${s.rule}"` : ""}${s.opacity !== undefined ? ` fill-opacity="${s.opacity}"` : ""}/>`
          : s.kind === "text"
            ? `<text x="${n(s.x)}" y="${n(s.y)}" font-size="${n(s.size)}" font-family='${CAPTION_FONT}' font-weight="900" text-anchor="middle" fill="${esc(s.fill)}">${esc(s.text)}</text>`
            : `<image href="${esc(s.src)}" x="${s.x}" y="${s.y}" width="${s.w}" height="${s.h}" preserveAspectRatio="xMidYMid slice"/>`;
      const placed = s.fixed || !turn ? el : `<g${turn}>${el}</g>`;
      // Тень — снаружи поворота, чтобы свет всегда падал сверху слева, как и в PNG.
      return s.kind === "path" && s.effect ? `<g filter="url(#fx-${s.effect})">${placed}</g>` : placed;
    })
    .join("");
  const h = drawing.height ?? drawing.size;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${drawing.size} ${n(h)}" width="${px}" height="${Math.round((px * h) / drawing.size)}" shape-rendering="geometricPrecision">${defs.length ? `<defs>${defs.join("")}</defs>` : ""}${body}</svg>`;
}
