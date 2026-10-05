// Всё, что делается с кодом в браузере: рисуем на canvas, проверяем, читается ли он, отдаём файлы.
// Данные никуда не отправляются.
import type { CollageLayout } from "./collage";
import { type Drawing, type IconMask, type Tones, toSvg } from "./render";

const cache = new Map<string, Promise<HTMLImageElement>>();

function loadImage(src: string): Promise<HTMLImageElement> {
  let p = cache.get(src);
  if (!p) {
    p = new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("image"));
      img.src = src;
    });
    cache.set(src, p);
  }
  return p;
}

/** То же, что preserveAspectRatio="xMidYMid slice" в SVG. */
function drawCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number) {
  const k = Math.max(w / img.naturalWidth, h / img.naturalHeight);
  const sw = w / k;
  const sh = h / k;
  ctx.drawImage(img, (img.naturalWidth - sw) / 2, (img.naturalHeight - sh) / 2, sw, sh, x, y, w, h);
}

export async function drawToCanvas(drawing: Drawing, px: number): Promise<HTMLCanvasElement> {
  const canvas = document.createElement("canvas");
  canvas.width = px;
  canvas.height = px;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  const k = px / drawing.size;
  ctx.scale(k, k);
  const c = drawing.size / 2;
  for (const s of drawing.shapes) {
    ctx.save();
    if (drawing.rotate && !s.fixed) {
      ctx.translate(c, c);
      ctx.rotate((drawing.rotate * Math.PI) / 180);
      ctx.translate(-c, -c);
    }
    if (s.kind === "path") {
      if (typeof s.fill === "string") ctx.fillStyle = s.fill;
      else {
        const g = ctx.createLinearGradient(s.fill.x1, s.fill.y1, s.fill.x2, s.fill.y2);
        g.addColorStop(0, s.fill.from);
        g.addColorStop(1, s.fill.to);
        ctx.fillStyle = g;
      }
      ctx.globalAlpha = s.opacity ?? 1;
      const path = new Path2D(s.d);
      const rule = s.rule ?? "nonzero";
      // Тени на canvas задаются в пикселях, а рисуем мы в клетках — переводим через k.
      if (s.effect === "raised") {
        ctx.shadowColor = "rgba(0,0,0,0.38)";
        ctx.shadowBlur = 0.16 * k;
        ctx.shadowOffsetX = 0.1 * k;
        ctx.shadowOffsetY = 0.12 * k;
      }
      ctx.fill(path, rule);
      if (s.effect === "carved") {
        // Тень внутрь: внутри фигуры заливаем «всё, кроме фигуры» со сдвинутой тенью — тень падает в фигуру.
        ctx.save();
        ctx.clip(path, rule);
        const outside = new Path2D(`M-1 -1H${drawing.size + 1}V${drawing.size + 1}H-1Z`);
        outside.addPath(path);
        ctx.shadowColor = "rgba(0,0,0,0.6)";
        ctx.shadowBlur = 0.14 * k;
        ctx.shadowOffsetX = 0.14 * k;
        ctx.shadowOffsetY = 0.16 * k;
        ctx.fillStyle = "#000";
        ctx.fill(outside, "evenodd");
        ctx.restore();
      }
    } else {
      drawCover(ctx, await loadImage(s.src), s.x, s.y, s.w, s.h);
    }
    ctx.restore();
  }
  return canvas;
}

// Читаем коды тем же движком (ZXing), что и многие телефоны на Android; файл движка лежит у нас в public.
let reader: Promise<typeof import("zxing-wasm/reader")> | null = null;
function getReader() {
  reader ??= import("zxing-wasm/reader").then((m) => {
    m.prepareZXingModule({ overrides: { locateFile: (path: string, prefix: string) => (path.endsWith(".wasm") ? `/${path}` : prefix + path) } });
    return m;
  });
  return reader;
}

/**
 * Читается ли код: пробуем прочитать его так, как прочитал бы телефон, — крупно и мелко
 * (мелкая версия похожа на код, снятый издалека). Совпасть должен текст целиком.
 */
export async function checkScan(drawing: Drawing, expected: string): Promise<boolean> {
  const { readBarcodes } = await getReader();
  const sharp = await drawToCanvas(drawing, 720);
  // «Как с камеры»: код мельче и чуть размыт — так его видит телефон с полуметра.
  const camera = document.createElement("canvas");
  camera.width = camera.height = 360;
  const cctx = camera.getContext("2d", { willReadFrequently: true })!;
  cctx.filter = "blur(1.2px)";
  cctx.drawImage(sharp, 0, 0, 360, 360);
  for (const c of [sharp, camera]) {
    const data = c.getContext("2d")!.getImageData(0, 0, c.width, c.height);
    const res = await readBarcodes(data, { formats: ["QRCode"], tryHarder: false, tryInvert: true, maxNumberOfSymbols: 1 });
    if (!res.some((r) => r.isValid && r.text === expected)) return false;
  }
  return true;
}

function save(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function downloadPng(drawing: Drawing, px: number, name: string) {
  const canvas = await drawToCanvas(drawing, px);
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/png"));
  if (blob) save(blob, `${name}.png`);
}

export function downloadSvg(drawing: Drawing, name: string) {
  save(new Blob([toSvg(drawing)], { type: "image/svg+xml" }), `${name}.svg`);
}

/** Несколько фото — в один квадратный коллаж по раскладке; mono — в оттенки серого. */
export async function composeCollage(files: File[], layout: CollageLayout, opts: { px: number; mono: boolean }): Promise<{ src: string; tones: Tones }> {
  const urls = files.map((f) => URL.createObjectURL(f));
  try {
    const imgs = await Promise.all(
      urls.map(
        (u) =>
          new Promise<HTMLImageElement>((resolve, reject) => {
            const i = new Image();
            i.onload = () => resolve(i);
            i.onerror = () => reject(new Error("image"));
            i.src = u;
          }),
      ),
    );
    const { px } = opts;
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = px;
    const ctx = canvas.getContext("2d")!;
    if (opts.mono) ctx.filter = "grayscale(1) contrast(1.15)";
    layout.cells.forEach((cell, i) => {
      const img = imgs.at(i);
      if (!img) return;
      // Края клеток округляем до пикселя, чтобы между фото не было щелей.
      const x0 = Math.round(cell.x * px);
      const y0 = Math.round(cell.y * px);
      drawCover(ctx, img, x0, y0, Math.round((cell.x + cell.w) * px) - x0, Math.round((cell.y + cell.h) * px) - y0);
    });
    // Маленькая копия — по ней код берёт цвета точек.
    const w = 160;
    const small = document.createElement("canvas");
    small.width = small.height = w;
    const sctx = small.getContext("2d", { willReadFrequently: true })!;
    sctx.drawImage(canvas, 0, 0, w, w);
    return { src: canvas.toDataURL("image/jpeg", 0.9), tones: { w, data: sctx.getImageData(0, 0, w, w).data } };
  } finally {
    urls.forEach((u) => URL.revokeObjectURL(u));
  }
}

/** Картинку пользователя приводим к квадрату нужного размера; mono — в оттенки серого. */
export async function prepareImage(file: File, opts: { px: number; square: boolean; mono?: boolean; type: "image/png" | "image/jpeg" }): Promise<string> {
  const src = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error("image"));
      i.src = src;
    });
    const k = Math.min(1, opts.px / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement("canvas");
    if (opts.square) {
      canvas.width = canvas.height = opts.px;
    } else {
      canvas.width = Math.round(img.naturalWidth * k);
      canvas.height = Math.round(img.naturalHeight * k);
    }
    const ctx = canvas.getContext("2d")!;
    if (opts.mono) ctx.filter = "grayscale(1) contrast(1.15)";
    if (opts.square) drawCover(ctx, img, 0, 0, opts.px, opts.px);
    else ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL(opts.type, 0.9);
  } finally {
    URL.revokeObjectURL(src);
  }
}

/**
 * Силуэт значка для углов: прозрачная картинка — по непрозрачным пикселям,
 * непрозрачная — по тёмным (темнее среднего). w×w клеток.
 */
export async function iconMask(file: File, w = 28): Promise<IconMask> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error("image"));
      i.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = w;
    const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
    const k = Math.min(w / img.naturalWidth, w / img.naturalHeight);
    const dw = img.naturalWidth * k;
    const dh = img.naturalHeight * k;
    ctx.drawImage(img, (w - dw) / 2, (w - dh) / 2, dw, dh);
    const px = ctx.getImageData(0, 0, w, w).data;
    let transparent = 0;
    let lumSum = 0;
    for (let i = 0; i < w * w; i++) {
      if (px[i * 4 + 3] < 200) transparent++;
      lumSum += (0.2126 * px[i * 4] + 0.7152 * px[i * 4 + 1] + 0.0722 * px[i * 4 + 2]) / 255;
    }
    const useAlpha = transparent > w * w * 0.05;
    const mean = lumSum / (w * w);
    const data = new Uint8Array(w * w);
    for (let i = 0; i < w * w; i++) {
      const lum = (0.2126 * px[i * 4] + 0.7152 * px[i * 4 + 1] + 0.0722 * px[i * 4 + 2]) / 255;
      data[i] = useAlpha ? (px[i * 4 + 3] > 128 ? 1 : 0) : lum < mean - 0.05 ? 1 : 0;
    }
    return { w, data };
  } finally {
    URL.revokeObjectURL(url);
  }
}
