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

/** В скачанном SVG картинки должны быть внутри файла — ссылки на наш сайт заменяем их содержимым. */
async function inlineImages(drawing: Drawing): Promise<Drawing> {
  const shapes = await Promise.all(
    drawing.shapes.map(async (sh) => {
      if (sh.kind !== "image" || sh.src.startsWith("data:")) return sh;
      const blob = await (await fetch(sh.src)).blob();
      const src = await new Promise<string>((r) => {
        const fr = new FileReader();
        fr.onload = () => r(fr.result as string);
        fr.readAsDataURL(blob);
      });
      return { ...sh, src };
    }),
  );
  return { ...drawing, shapes };
}

export async function downloadSvg(drawing: Drawing, name: string) {
  save(new Blob([toSvg(await inlineImages(drawing))], { type: "image/svg+xml" }), `${name}.svg`);
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

// ——— Живой код: короткое видео (4 с, 1080×1080) для Instagram и TikTok ———
// По коду пробегает блик и он чуть «дышит». Перед записью проверяем, что код читается в самых трудных кадрах.

const LIVE = { px: 1080, seconds: 4, fps: 30 };

/** Кадр живого кода: t — от 0 до 1 по кругу. glint — сила блика (0…1). */
function liveFrame(ctx: CanvasRenderingContext2D, base: HTMLCanvasElement, t: number, glint: number) {
  const S = LIVE.px;
  // «Дыхание»: чуть крупнее и обратно (только больше 1 — края остаются заполненными фоном кода).
  const s = 1 + 0.025 * (1 - Math.cos(2 * Math.PI * t)) * 0.5;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = "source-over";
  ctx.drawImage(base, (S - S * s) / 2, (S - S * s) / 2, S * s, S * s);
  // Блик: диагональная полоса проходит раз за цикл; светлее только поверх кода.
  const x = -0.6 * S + t * 2.2 * S;
  const g = ctx.createLinearGradient(x - 0.18 * S, x * 0.2, x + 0.18 * S, x * 0.2 + 0.36 * S);
  g.addColorStop(0, "rgba(255,255,255,0)");
  g.addColorStop(0.5, `rgba(255,255,255,${0.55 * glint})`);
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.globalCompositeOperation = "screen";
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
  ctx.globalCompositeOperation = "source-over";
}

async function liveReads(base: HTMLCanvasElement, glint: number, expected: string): Promise<boolean> {
  const { readBarcodes } = await getReader();
  const c = document.createElement("canvas");
  c.width = c.height = LIVE.px;
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  const small = document.createElement("canvas");
  small.width = small.height = 360;
  const sctx = small.getContext("2d", { willReadFrequently: true })!;
  // Самые трудные кадры — когда блик посередине кода; проверяем «как с камеры» (мелко и чуть размыто).
  for (const t of [0.35, 0.45, 0.5, 0.55, 0.65]) {
    liveFrame(ctx, base, t, glint);
    sctx.filter = "blur(1.2px)";
    sctx.drawImage(c, 0, 0, 360, 360);
    const res = await readBarcodes(sctx.getImageData(0, 0, 360, 360), { formats: ["QRCode"], tryHarder: false, tryInvert: true, maxNumberOfSymbols: 1 });
    if (!res.some((r) => r.isValid && r.text === expected)) return false;
  }
  return true;
}

/** Записать живой код. Блик ослабляем, пока код не читается в каждом кадре. */
export async function recordLive(drawing: Drawing, expected: string, onProgress?: (p: number) => void): Promise<{ blob: Blob; ext: string } | null> {
  const base = await drawToCanvas(drawing, LIVE.px);
  let glint = 1;
  while (glint > 0.15 && !(await liveReads(base, glint, expected))) glint -= 0.25;
  if (!(await liveReads(base, glint, expected))) return null;

  const c = document.createElement("canvas");
  c.width = c.height = LIVE.px;
  const ctx = c.getContext("2d")!;
  liveFrame(ctx, base, 0, glint);
  const type = ["video/mp4;codecs=avc1", "video/mp4", "video/webm;codecs=vp9", "video/webm"].find((m) => MediaRecorder.isTypeSupported(m));
  if (!type) return null;
  const rec = new MediaRecorder(c.captureStream(LIVE.fps), { mimeType: type, videoBitsPerSecond: 8_000_000 });
  const chunks: Blob[] = [];
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  const done = new Promise<void>((r) => (rec.onstop = () => r()));
  rec.start();
  const start = performance.now();
  await new Promise<void>((resolve) => {
    const tick = () => {
      const el = (performance.now() - start) / 1000;
      liveFrame(ctx, base, (el % LIVE.seconds) / LIVE.seconds, glint);
      onProgress?.(Math.min(1, el / LIVE.seconds));
      if (el < LIVE.seconds) requestAnimationFrame(tick);
      else resolve();
    };
    requestAnimationFrame(tick);
  });
  rec.stop();
  await done;
  return { blob: new Blob(chunks, { type: type.split(";")[0] }), ext: type.includes("mp4") ? "mp4" : "webm" };
}

export async function downloadLive(drawing: Drawing, expected: string, name: string, onProgress?: (p: number) => void): Promise<boolean> {
  const r = await recordLive(drawing, expected, onProgress);
  if (!r) return false;
  save(r.blob, `${name}-live.${r.ext}`);
  return true;
}

/** Прочитать QR с картинки (кадр камеры или фото) — для «Проверить код». null — кода не нашли. */
export async function readQr(img: ImageData): Promise<string | null> {
  const { readBarcodes } = await getReader();
  const res = await readBarcodes(img, { formats: ["QRCode"], tryHarder: true, tryInvert: true, maxNumberOfSymbols: 1 });
  return res.find((r) => r.isValid)?.text ?? null;
}
