// Форма кода (владелец 10.10.2026: «вид QR-кода не могу полностью изменять, а не сделать его квадратным?»).
// Сам код — квадрат с тремя углами (иначе камера не прочитает), а вокруг него — силуэт: круг, сердце… Силуэт заполняется
// точками-украшениями того же вида; данных в них нет, читалка их не замечает. Тут — только геометрия силуэтов.

export const CODE_SHAPES = ["square", "circle", "hexagon", "heart", "drop", "blob"] as const;
export type CodeShape = (typeof CODE_SHAPES)[number];

type Pt = [number, number];

/** Силуэт в единичном квадрате (y вниз), по часовой; растянут по большей стороне и выровнен по центру. */
function normalize(pts: Pt[]): Pt[] {
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const k = 1 / Math.max(x1 - x0, y1 - y0);
  const dx = (1 - (x1 - x0) * k) / 2;
  const dy = (1 - (y1 - y0) * k) / 2;
  return pts.map(([x, y]) => [dx + (x - x0) * k, dy + (y - y0) * k]);
}

const N = 180;
const around = (f: (t: number) => Pt): Pt[] => Array.from({ length: N }, (_, i) => f((i / N) * Math.PI * 2));

/** Многоугольник со скруглёнными углами (r — доля стороны). */
function roundedPolygon(corners: Pt[], r: number): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i < corners.length; i++) {
    const [p, c, q] = [corners[(i + corners.length - 1) % corners.length], corners[i], corners[(i + 1) % corners.length]];
    const a: Pt = [c[0] + (p[0] - c[0]) * r, c[1] + (p[1] - c[1]) * r];
    const b: Pt = [c[0] + (q[0] - c[0]) * r, c[1] + (q[1] - c[1]) * r];
    // Угол — квадратичная кривая a → c → b, точками.
    for (let s = 0; s <= 8; s++) {
      const t = s / 8;
      out.push([(1 - t) ** 2 * a[0] + 2 * (1 - t) * t * c[0] + t * t * b[0], (1 - t) ** 2 * a[1] + 2 * (1 - t) * t * c[1] + t * t * b[1]]);
    }
  }
  return out;
}

const OUTLINES: Record<Exclude<CodeShape, "square">, () => Pt[]> = {
  circle: () => around((t) => [Math.cos(t), Math.sin(t)]),
  hexagon: () => roundedPolygon(Array.from({ length: 6 }, (_, i) => [Math.cos(-Math.PI / 2 + (i * Math.PI) / 3), Math.sin(-Math.PI / 2 + (i * Math.PI) / 3)] as Pt), 0.18),
  heart: () => around((t) => [16 * Math.sin(t) ** 3, -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t))]),
  // Капля остриём вверх.
  drop: () => around((t) => [Math.sin(t) * Math.sin(t / 2) ** 1.2 * 1.05, -Math.cos(t)]),
  // Клякса: круг с плавными волнами.
  blob: () => around((t) => { const r = 1 + 0.07 * Math.sin(3 * t + 0.5) + 0.05 * Math.cos(5 * t) + 0.03 * Math.sin(7 * t + 1); return [r * Math.cos(t), r * Math.sin(t)]; }),
};

/** Точка внутри многоугольника (чётность пересечений). */
export function inside(pts: Pt[], x: number, y: number): boolean {
  let hit = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i];
    const [xj, yj] = pts[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}

/** Самый большой ровный квадрат внутри силуэта: центр и половина стороны (в долях силуэта). */
function biggestSquare(pts: Pt[]): { cx: number; cy: number; half: number } {
  const fits = (cx: number, cy: number, h: number) => {
    for (let i = 0; i <= 12; i++) {
      const t = -h + (2 * h * i) / 12;
      if (!inside(pts, cx + t, cy - h) || !inside(pts, cx + t, cy + h) || !inside(pts, cx - h, cy + t) || !inside(pts, cx + h, cy + t)) return false;
    }
    return true;
  };
  let best = { cx: 0.5, cy: 0.5, half: 0 };
  for (let ix = 0; ix <= 8; ix++)
    for (let iy = 0; iy <= 16; iy++) {
      const cx = 0.42 + (0.16 * ix) / 8;
      const cy = 0.3 + (0.4 * iy) / 16;
      if (!inside(pts, cx, cy)) continue;
      let [lo, hi] = [0, 0.5];
      for (let k = 0; k < 18; k++) {
        const mid = (lo + hi) / 2;
        if (fits(cx, cy, mid)) lo = mid;
        else hi = mid;
      }
      if (lo > best.half + 1e-6) best = { cx, cy, half: lo };
    }
  return best;
}

export type Silhouette = { pts: Pt[]; cx: number; cy: number; half: number };
const memo = new Map<CodeShape, Silhouette>();

/** Силуэт формы (в единичном квадрате) и где в нём помещается сам код. square — null: код как был. */
export function silhouette(shape: CodeShape | undefined): Silhouette | null {
  if (!shape || shape === "square" || !(shape in OUTLINES)) return null;
  let s = memo.get(shape);
  if (!s) {
    const pts = normalize(OUTLINES[shape as Exclude<CodeShape, "square">]());
    s = { pts, ...biggestSquare(pts) };
    memo.set(shape, s);
  }
  return s;
}

const r3 = (v: number) => Math.round(v * 1000) / 1000;

/** Контур силуэта в координатах рисунка: масштаб k и сдвиг; reverse — обход назад (вырез внутри другого контура). */
export function outlinePath(pts: Pt[], k: number, ox: number, oy: number, reverse = false): string {
  const p = reverse ? [...pts].reverse() : pts;
  return `M${p.map(([x, y]) => `${r3(ox + x * k)} ${r3(oy + y * k)}`).join("L")}Z`;
}

/** Силуэт, сжатый к точке (cx, cy) в f раз — внутренний край рамки и граница, за которую не заходят украшения. */
export const shrink = (pts: Pt[], cx: number, cy: number, f: number): Pt[] => pts.map(([x, y]) => [cx + (x - cx) * f, cy + (y - cy) * f]);
