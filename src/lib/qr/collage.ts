// Коллаж для QR-картинки: как разложить 1–6 фото по квадрату. Клетки — доли стороны (0…1),
// i-я клетка берёт i-е фото.

export const MAX_PHOTOS = 6;

export type Cell = { x: number; y: number; w: number; h: number };
export type CollageLayout = { id: string; cells: Cell[] };

const c = (x: number, y: number, w: number, h: number): Cell => ({ x, y, w, h });
const third = 1 / 3;

/** Раскладки по числу фото; первая — по умолчанию. */
export const LAYOUTS: Record<number, CollageLayout[]> = {
  1: [{ id: "full", cells: [c(0, 0, 1, 1)] }],
  2: [
    { id: "cols", cells: [c(0, 0, 0.5, 1), c(0.5, 0, 0.5, 1)] },
    { id: "rows", cells: [c(0, 0, 1, 0.5), c(0, 0.5, 1, 0.5)] },
  ],
  3: [
    { id: "big-left", cells: [c(0, 0, 0.5, 1), c(0.5, 0, 0.5, 0.5), c(0.5, 0.5, 0.5, 0.5)] },
    { id: "big-top", cells: [c(0, 0, 1, 0.5), c(0, 0.5, 0.5, 0.5), c(0.5, 0.5, 0.5, 0.5)] },
    { id: "cols", cells: [c(0, 0, third, 1), c(third, 0, third, 1), c(2 * third, 0, third, 1)] },
  ],
  4: [
    { id: "grid", cells: [c(0, 0, 0.5, 0.5), c(0.5, 0, 0.5, 0.5), c(0, 0.5, 0.5, 0.5), c(0.5, 0.5, 0.5, 0.5)] },
    { id: "big-left", cells: [c(0, 0, 0.5, 1), c(0.5, 0, 0.5, third), c(0.5, third, 0.5, third), c(0.5, 2 * third, 0.5, third)] },
    { id: "big-top", cells: [c(0, 0, 1, 0.5), c(0, 0.5, third, 0.5), c(third, 0.5, third, 0.5), c(2 * third, 0.5, third, 0.5)] },
  ],
  5: [
    { id: "two-three", cells: [c(0, 0, 0.5, 0.5), c(0.5, 0, 0.5, 0.5), c(0, 0.5, third, 0.5), c(third, 0.5, third, 0.5), c(2 * third, 0.5, third, 0.5)] },
    { id: "big-left", cells: [c(0, 0, 0.5, 1), c(0.5, 0, 0.25, 0.5), c(0.75, 0, 0.25, 0.5), c(0.5, 0.5, 0.25, 0.5), c(0.75, 0.5, 0.25, 0.5)] },
  ],
  6: [
    { id: "grid", cells: [0, 1, 2, 3, 4, 5].map((i) => c((i % 3) * third, Math.floor(i / 3) * 0.5, third, 0.5)) },
    { id: "big-corner", cells: [c(0, 0, 2 * third, 2 * third), c(2 * third, 0, third, third), c(2 * third, third, third, third), c(0, 2 * third, third, third), c(third, 2 * third, third, third), c(2 * third, 2 * third, third, third)] },
  ],
};

export function layoutFor(count: number, id?: string): CollageLayout {
  const list = LAYOUTS[Math.min(Math.max(count, 1), MAX_PHOTOS)];
  return list.find((l) => l.id === id) ?? list[0];
}
