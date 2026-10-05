// Текстуры фона рисуем сами (шум + узор) прямо в браузере — без чужих картинок и без сервера.
// Готовая текстура — обычная картинка под кодом, поэтому одинаково ложится и в SVG, и в PNG.

export const TEXTURES = ["paper", "parchment", "kraft", "wood", "concrete", "linen", "space"] as const;
export type TextureId = (typeof TEXTURES)[number];

/** Цвета к текстуре: фон (средний тон — для проверки контраста), точки, центры углов. */
export const TEXTURE_INK: Record<TextureId, { bg: string; fg: string; ball: string }> = {
  paper: { bg: "#f3efe6", fg: "#2b2620", ball: "#2b2620" },
  parchment: { bg: "#e9d9b4", fg: "#4a2a14", ball: "#9b1b2a" },
  kraft: { bg: "#c9a578", fg: "#3a2414", ball: "#3a2414" },
  wood: { bg: "#d6b48a", fg: "#3d2412", ball: "#7a1e12" },
  concrete: { bg: "#d4d3cf", fg: "#1f2328", ball: "#1f2328" },
  linen: { bg: "#ece6da", fg: "#283044", ball: "#283044" },
  // Космос — светлая туманность (тёмное небо со светлым кодом читают не все телефоны).
  space: { bg: "#e4e1f4", fg: "#151a3d", ball: "#5b2a86" },
};

// Шум значений с плавной интерполяцией; одинаковый узор при каждом запуске (своё зерно).
function makeNoise(seed: number) {
  const perm = new Uint8Array(512);
  let s = seed;
  const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  const p = Array.from({ length: 256 }, (_, i) => i);
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [p[i], p[j]] = [p[j], p[i]];
  }
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  const val = new Float32Array(256).map(() => rnd());
  const fade = (t: number) => t * t * (3 - 2 * t);
  const at = (x: number, y: number) => val[perm[(perm[x & 255] + y) & 511]];
  const noise = (x: number, y: number) => {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const u = fade(x - xi);
    const v = fade(y - yi);
    const a = at(xi, yi) + (at(xi + 1, yi) - at(xi, yi)) * u;
    const b = at(xi, yi + 1) + (at(xi + 1, yi + 1) - at(xi, yi + 1)) * u;
    return a + (b - a) * v;
  };
  /** Несколько слоёв шума разного масштаба: 0…1. */
  return (x: number, y: number, octaves = 4) => {
    let sum = 0;
    let amp = 0.5;
    let f = 1;
    let norm = 0;
    for (let o = 0; o < octaves; o++) {
      sum += noise(x * f, y * f) * amp;
      norm += amp;
      amp /= 2;
      f *= 2;
    }
    return sum / norm;
  };
}

const hexRgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));

const cache = new Map<TextureId, string>();

export function textureSrc(id: TextureId): string {
  const hit = cache.get(id);
  if (hit) return hit;
  const S = 512;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = S;
  const ctx = canvas.getContext("2d")!;
  const img = ctx.createImageData(S, S);
  const fbm = makeNoise(id.length * 7919 + 17);
  const [br, bg, bb] = hexRgb(TEXTURE_INK[id].bg);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const u = x / S;
      const v = y / S;
      let k = 0; // сдвиг яркости
      let tint = 0; // сдвиг в тёплый/тёмный тон
      switch (id) {
        case "paper":
          k = (fbm(u * 60, v * 60, 3) - 0.5) * 18 + (fbm(u * 6, v * 6, 2) - 0.5) * 10;
          break;
        case "parchment": {
          // Старая бумага: пятна, затемнение к краям.
          const d = Math.hypot(u - 0.5, v - 0.5);
          k = (fbm(u * 5, v * 5, 5) - 0.5) * 60 + (fbm(u * 70, v * 70, 2) - 0.5) * 14 - Math.max(0, d - 0.35) * 60;
          tint = (fbm(u * 3 + 9, v * 3, 3) - 0.5) * 30;
          break;
        }
        case "kraft":
          k = (fbm(u * 80, v * 80, 3) - 0.5) * 30 + (fbm(u * 8, v * 8, 3) - 0.5) * 16;
          if (fbm(u * 140, v * 140, 1) > 0.86) k -= 40; // волокна и крапинки
          break;
        case "wood": {
          // Доска: длинные волокна поперёк, слегка изогнутые; тонкие прожилки вдоль.
          const bend = fbm(u * 1.2, v * 2.5, 3) * 2.2;
          const ring = Math.sin((v * 9 + bend) * Math.PI * 2);
          const streak = fbm(u * 1.5, v * 160, 2) - 0.5;
          k = ring * 12 + streak * 34 + (fbm(u * 4, v * 4, 2) - 0.5) * 14;
          tint = ring * 6 + streak * 10;
          break;
        }
        case "concrete":
          k = (fbm(u * 30, v * 30, 5) - 0.5) * 34;
          if (fbm(u * 200, v * 200, 1) > 0.9) k -= 30; // поры
          break;
        case "space": {
          // Туманность: розовые и голубые облака, звёзды-искры.
          const pink = fbm(u * 3 + 5, v * 3, 5);
          const cyan = fbm(u * 3, v * 3 + 7, 5);
          k = (fbm(u * 6, v * 6, 4) - 0.5) * 16;
          tint = (pink - cyan) * 70;
          const star = fbm(u * 260, v * 260, 1);
          if (star > 0.93) k += (star - 0.93) * 900;
          break;
        }
        case "linen": {
          const warp = Math.sin(x * 1.6) * 0.5 + 0.5;
          const weft = Math.sin(y * 1.6) * 0.5 + 0.5;
          k = (warp * weft - 0.25) * 22 + (fbm(u * 40, v * 40, 3) - 0.5) * 14;
          break;
        }
      }
      const o = (y * S + x) * 4;
      img.data[o] = br + k + tint;
      img.data[o + 1] = bg + k;
      img.data[o + 2] = bb + k - tint;
      img.data[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const src = canvas.toDataURL("image/jpeg", 0.88);
  cache.set(id, src);
  return src;
}
