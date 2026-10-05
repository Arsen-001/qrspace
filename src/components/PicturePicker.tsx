"use client";
// QR-картинка: 1–6 фото, раскладка коллажа, чёткость кода, ч/б.
import { useEffect, useMemo } from "react";
import type { Dict } from "@/lib/i18n";
import { LAYOUTS, MAX_PHOTOS, type CollageLayout } from "@/lib/qr/collage";
import { GhostButton, Label, Slider, UploadButton } from "./ui";

import type { Tones } from "@/lib/qr/render";

export type PictureState = { files: File[]; layout: string; src: string; tones: Tones; dotSize: number; mono: boolean };

function LayoutIcon({ layout }: { layout: CollageLayout }) {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden>
      {layout.cells.map((c, i) => (
        <rect
          key={i}
          x={1 + c.x * 22 + 0.75}
          y={1 + c.y * 22 + 0.75}
          width={c.w * 22 - 1.5}
          height={c.h * 22 - 1.5}
          rx={1.5}
          fill="currentColor"
          fillOpacity={i === 0 ? 0.55 : 0.25}
        />
      ))}
    </svg>
  );
}

function Thumbs({ t, files, onMove, onRemove }: { t: Dict; files: File[]; onMove: (i: number) => void; onRemove: (i: number) => void }) {
  const urls = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files]);
  useEffect(() => () => urls.forEach((u) => URL.revokeObjectURL(u)), [urls]);
  return (
    <ul className="flex flex-wrap gap-2">
      {urls.map((u, i) => (
        <li key={u} className="relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={u} alt="" className="h-16 w-16 rounded-xl border border-line object-cover" />
          <span className="absolute left-1 top-1 grid h-5 min-w-5 place-items-center rounded-full bg-black/60 px-1 text-[11px] font-semibold text-white">{i + 1}</span>
          <button
            type="button"
            aria-label={t.removePhoto}
            title={t.removePhoto}
            onClick={() => onRemove(i)}
            className="absolute -right-1.5 -top-1.5 grid h-6 w-6 place-items-center rounded-full border border-line bg-card text-sm leading-none shadow-sm hover:text-warn"
          >
            ×
          </button>
          {i > 0 && (
            <button
              type="button"
              aria-label={t.moveLeft}
              title={t.moveLeft}
              onClick={() => onMove(i)}
              className="absolute -bottom-1.5 -left-1.5 grid h-6 w-6 place-items-center rounded-full border border-line bg-card text-xs leading-none shadow-sm hover:text-accent"
            >
              ←
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}

export function PicturePicker({
  t,
  picture,
  limitHit,
  onAdd,
  onFiles,
  onLayout,
  onMono,
  onDotSize,
}: {
  t: Dict;
  picture: PictureState | null;
  limitHit: boolean;
  onAdd: (files: File[]) => void;
  onFiles: (files: File[]) => void;
  onLayout: (id: string) => void;
  onMono: (mono: boolean) => void;
  onDotSize: (v: number) => void;
}) {
  const files = picture?.files ?? [];
  const layouts = LAYOUTS[files.length] ?? [];
  return (
    <div>
      <Label hint={t.pictureHint}>{t.picture}</Label>
      {picture && files.length === 0 && (
        // Сохранённый код: исходных фото нет, есть готовый коллаж — его можно убрать или заменить.
        <div className="mb-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={picture.src} alt="" className="h-16 w-16 rounded-xl border border-line object-cover" />
        </div>
      )}
      {files.length > 0 && (
        <div className="mb-3">
          <Thumbs
            t={t}
            files={files}
            onRemove={(i) => onFiles(files.filter((_, j) => j !== i))}
            onMove={(i) => {
              const next = [...files];
              [next[i - 1], next[i]] = [next[i], next[i - 1]];
              onFiles(next);
            }}
          />
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        {files.length < MAX_PHOTOS && <UploadButton multiple label={files.length ? t.addPhotos : picture ? t.replace : t.upload} onFiles={onAdd} />}
        {picture && <GhostButton onClick={() => onFiles([])}>{files.length > 1 ? t.removeAll : t.remove}</GhostButton>}
      </div>
      {limitHit && <p className="mt-2 text-sm text-warn">{t.photosLimit}</p>}

      {picture && (
        <div className="mt-4 space-y-4">
          {layouts.length > 1 && (
            <div>
              <div className="mb-1.5 text-sm font-medium">{t.layout}</div>
              <div role="radiogroup" aria-label={t.layout} className="flex flex-wrap gap-1.5">
                {layouts.map((l) => (
                  <button
                    key={l.id}
                    type="button"
                    role="radio"
                    aria-checked={picture.layout === l.id}
                    aria-label={`${t.layout} ${l.id}`}
                    onClick={() => onLayout(l.id)}
                    className={`grid h-12 w-12 place-items-center rounded-xl border ${
                      picture.layout === l.id ? "border-accent bg-accent text-on-accent" : "border-line bg-field hover:border-muted"
                    }`}
                  >
                    <LayoutIcon layout={l} />
                  </button>
                ))}
              </div>
            </div>
          )}
          <Slider label={t.dotSize} hint={t.dotSizeHint} value={picture.dotSize} min={0.25} max={0.7} step={0.05} onChange={onDotSize} />
          {files.length > 0 && <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input type="checkbox" checked={picture.mono} onChange={(e) => onMono(e.target.checked)} className="h-4 w-4 accent-[var(--accent)]" />
            {t.mono}
          </label>}
        </div>
      )}
    </div>
  );
}
