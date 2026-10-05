"use client";
// Оформление кода + предпросмотр с проверкой чтения. Один и тот же блок в генераторе и в коде с памятью.
import { useEffect, useMemo, useRef, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import type { Dict } from "@/lib/i18n";
import { buildDrawing, type Drawing } from "@/lib/qr/render";
import { layoutFor, MAX_PHOTOS } from "@/lib/qr/collage";
import { toQrStyle } from "@/lib/qr/style";
import { checkScan, composeCollage, iconMask, prepareImage } from "@/lib/qr/raster";
import { PicturePicker } from "./PicturePicker";
import { Preview, type Gate, type ScanState } from "./Preview";
import { StylePanel, type StyleState } from "./StylePanel";

function luminance(hex: string): number {
  const v = hex.replace("#", "");
  const ch = [0, 2, 4].map((i) => parseInt(v.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}

function contrast(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

/** Рисунок кода; null — пусто, «too-long» — не влезает. */
export function useDrawing(payload: string, style: StyleState): { drawing: Drawing | null; tooLong: boolean } {
  return useMemo(() => {
    if (!payload) return { drawing: null, tooLong: false };
    try {
      return { drawing: buildDrawing(payload, toQrStyle(style)), tooLong: false };
    } catch {
      return { drawing: null, tooLong: true };
    }
  }, [payload, style]);
}

export function CodeDesigner({
  t,
  payload,
  style,
  setStyle,
  top,
  side,
  fileName,
  gate,
}: {
  t: Dict;
  payload: string;
  style: StyleState;
  setStyle: Dispatch<SetStateAction<StyleState>>;
  /** Что над оформлением (например, «что будет в коде»). */
  top?: ReactNode;
  /** Что под предпросмотром. */
  side?: ReactNode;
  fileName?: string;
  gate?: Gate | null;
}) {
  const [imageError, setImageError] = useState(false);
  const patchStyle = (p: Partial<StyleState>) => setStyle((s) => ({ ...s, ...p }));
  const { drawing, tooLong } = useDrawing(payload, style);

  // Проверяем чтение после паузы — не на каждое изменение. Результат помним вместе с рисунком,
  // к которому он относится: пока проверка нового рисунка не закончилась — «проверяем».
  const [checked, setChecked] = useState<{ drawing: Drawing; ok: boolean } | null>(null);
  useEffect(() => {
    if (!drawing) return;
    let live = true;
    const id = setTimeout(() => {
      checkScan(drawing, payload)
        .then((ok) => live && setChecked({ drawing, ok }))
        .catch(() => live && setChecked({ drawing, ok: false }));
    }, 300);
    return () => {
      live = false;
      clearTimeout(id);
    };
  }, [drawing, payload]);
  const scan: ScanState = !drawing ? "idle" : checked?.drawing !== drawing ? "checking" : checked.ok ? "ok" : "bad";

  const onEyeIcon = async (f: File) => {
    try {
      const [mask, preview] = await Promise.all([iconMask(f), prepareImage(f, { px: 128, square: false, type: "image/png" })]);
      setImageError(false);
      patchStyle({ eyeIcon: { mask, preview, strength: style.eyeIcon?.strength ?? 0.18 } });
    } catch {
      setImageError(true);
    }
  };

  const onLogo = async (f: File) => {
    try {
      const src = await prepareImage(f, { px: 256, square: false, type: "image/png" });
      setImageError(false);
      patchStyle({ logo: { src, scale: style.logo?.scale ?? 0.22 } });
    } catch {
      setImageError(true);
    }
  };

  // Коллаж собирается асинхронно; если человек успел что-то поменять — старый результат не ставим.
  const pictureJob = useRef(0);
  const [limitHit, setLimitHit] = useState(false);
  const rebuildPicture = async (files: File[], layoutId: string | undefined, mono: boolean) => {
    const job = ++pictureJob.current;
    if (!files.length) {
      patchStyle({ picture: null });
      return;
    }
    const layout = layoutFor(files.length, layoutId);
    try {
      const { src, tones } = await composeCollage(files, layout, { px: 720, mono });
      if (job !== pictureJob.current) return;
      setImageError(false);
      setStyle((s) => ({ ...s, picture: { files, layout: layout.id, src, tones, mono, dotSize: s.picture?.dotSize ?? 0.45 } }));
    } catch {
      if (job === pictureJob.current) setImageError(true);
    }
  };
  const pic = style.picture;
  const mono = pic?.mono ?? false;
  const onAddPhotos = (added: File[]) => {
    const all = [...(pic?.files ?? []), ...added];
    setLimitHit(all.length > MAX_PHOTOS);
    rebuildPicture(all.slice(0, MAX_PHOTOS), undefined, mono);
  };
  const onPhotos = (files: File[]) => {
    setLimitHit(false);
    // Число фото не изменилось (поменяли порядок) — раскладку оставляем.
    rebuildPicture(files, files.length === pic?.files.length ? pic.layout : undefined, mono);
  };

  const lowContrast = !style.picture && contrast(style.fg, style.bg) < 3;

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[minmax(0,1fr)_400px] lg:items-start">
      <div className="contents lg:block lg:space-y-5">
        {top && <div className="order-1 min-w-0">{top}</div>}
        <div className="order-3 min-w-0">
          <StylePanel
            t={t}
            s={style}
            set={patchStyle}
            onLogo={onLogo}
            onEyeIcon={onEyeIcon}
            picturePicker={
              <PicturePicker
                t={t}
                picture={pic}
                limitHit={limitHit}
                onAdd={onAddPhotos}
                onFiles={onPhotos}
                onLayout={(id) => {
                  if (!pic) return;
                  patchStyle({ picture: { ...pic, layout: id } }); // переключатель отвечает сразу, коллаж догонит
                  rebuildPicture(pic.files, id, pic.mono);
                }}
                onMono={(m) => {
                  if (!pic) return;
                  patchStyle({ picture: { ...pic, mono: m } });
                  rebuildPicture(pic.files, pic.layout, m);
                }}
                onDotSize={(dotSize) => pic && patchStyle({ picture: { ...pic, dotSize } })}
              />
            }
            lowContrast={lowContrast}
          />
          {imageError && <p className="mt-2 text-sm text-warn">{t.imageError}</p>}
        </div>
      </div>
      <div className="order-2 min-w-0 space-y-4 lg:sticky lg:top-4">
        <Preview key={payload} t={t} drawing={drawing} scan={scan} error={tooLong ? t.tooLong : null} name={fileName} gate={gate} payload={payload} />
        {side}
      </div>
    </div>
  );
}
