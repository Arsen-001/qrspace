"use client";
// Оформление кода + предпросмотр с проверкой чтения. Один и тот же блок в генераторе и в коде с памятью.
import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import type { Dict } from "@/lib/i18n";
import { buildDrawing, toSvg, type Drawing } from "@/lib/qr/render";
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
  sample,
  steps,
  suggestLogo,
  locked,
  note,
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
  /** Генератор: пример вместо пустого предпросмотра и номера шагов 2 и 3. */
  sample?: boolean;
  steps?: boolean;
  /** Готовый логотип под вид содержимого (генератор). */
  suggestLogo?: string;
  /** Вид закреплён (код уже скачан) — вместо настроек объяснение; скачать снова можно. */
  locked?: boolean;
  /** Пояснение под предпросмотром. */
  note?: string | null;
}) {
  const [imageError, setImageError] = useState(false);
  // Обработчики — постоянные (меняют вид через setStyle от прежнего): панель вида не перерисовывается на каждую букву в шаге 1.
  const patchStyle = useCallback((p: Partial<StyleState>) => setStyle((s) => ({ ...s, ...p })), [setStyle]);
  const { drawing, tooLong } = useDrawing(payload, style);
  const barSvg = useMemo(() => (steps && drawing ? toSvg(drawing, 96) : ""), [steps, drawing]);

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
  // Почти одинаковые цвета точек (углов) и фона: чёткую картинку читалка берёт, а камера на бумаге — нет. Тут проверке не верим.
  const pale = !style.picture && Math.min(...[style.fg, style.eyeColor, style.eyeBallColor, style.gradient?.to ?? style.fg].map((c) => contrast(c, style.bg))) < 2;
  const scan: ScanState = !drawing ? "idle" : checked?.drawing !== drawing ? "checking" : checked.ok && !pale ? "ok" : "bad";

  const onEyeIcon = useCallback(
    async (f: File) => {
      try {
        const [mask, preview] = await Promise.all([iconMask(f), prepareImage(f, { px: 128, square: false, type: "image/png" })]);
        setImageError(false);
        setStyle((s) => ({ ...s, eyeIcon: { mask, preview, strength: s.eyeIcon?.strength ?? 0.18 } }));
      } catch {
        setImageError(true);
      }
    },
    [setStyle],
  );

  const onLogo = useCallback(
    async (f: File, scale?: number) => {
      try {
        const src = await prepareImage(f, { px: 256, square: false, type: "image/png" });
        setImageError(false);
        setStyle((s) => ({ ...s, logo: { src, scale: scale ?? s.logo?.scale ?? 0.22 } }));
      } catch {
        setImageError(true);
      }
    },
    [setStyle],
  );

  // Коллаж собирается асинхронно; если человек успел что-то поменять — старый результат не ставим.
  const pictureJob = useRef(0);
  const [limitHit, setLimitHit] = useState(false);
  const rebuildPicture = useCallback(
    async (files: File[], layoutId: string | undefined, mono: boolean) => {
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
    },
    [patchStyle, setStyle],
  );
  const pic = style.picture;
  const picker = useMemo(
    () => (
      <PicturePicker
        t={t}
        picture={pic}
        limitHit={limitHit}
        onAdd={(added) => {
          const all = [...(pic?.files ?? []), ...added];
          setLimitHit(all.length > MAX_PHOTOS);
          rebuildPicture(all.slice(0, MAX_PHOTOS), undefined, pic?.mono ?? false);
        }}
        onFiles={(files) => {
          setLimitHit(false);
          // Число фото не изменилось (поменяли порядок) — раскладку оставляем.
          rebuildPicture(files, files.length === pic?.files.length ? pic.layout : undefined, pic?.mono ?? false);
        }}
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
    ),
    [t, pic, limitHit, rebuildPicture, patchStyle],
  );

  const lowContrast = !style.picture && contrast(style.fg, style.bg) < 3;

  // Телефон (владелец 08.10.2026): пока человек в шагах 1 и 2, код закреплён сверху — видно, как меняется; у шага 3 уходит.
  const previewRef = useRef<HTMLDivElement>(null);
  const bar = steps && drawing && (
    <div className="sticky top-0 z-30 -mx-4 mb-1 border-b border-line bg-[color-mix(in_oklab,var(--bg)_92%,transparent)] px-4 py-2.5 backdrop-blur lg:hidden">
      <div className="flex items-center gap-3">
        <span className="relative block h-24 w-24 shrink-0 overflow-hidden rounded-xl border border-line bg-field shadow-sm">
          <span aria-hidden className={`block h-full w-full [&>svg]:h-full [&>svg]:w-full ${sample ? "opacity-85" : ""}`} dangerouslySetInnerHTML={{ __html: barSvg }} />
          {sample && <span className="absolute bottom-1 left-1 rounded bg-stage px-1 font-mono text-[11px] font-bold uppercase text-accent">{t.sampleBadge}</span>}
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold" aria-live="polite">
            {gate?.blocked ? <span className="text-warn">! {t.fixStep1}</span> : sample ? <span className="text-muted">{t.sampleBadge}</span> : scan === "ok" ? <span className="text-ok">✓ {t.scanOk}</span> : scan === "bad" ? <span className="text-warn">! {t.scanBad}</span> : <span className="text-muted">{t.checking}</span>}
          </div>
          {gate?.blocked ? (
            // Ошибка в шаге 1 — кнопка ведёт к полю с ошибкой, а не к скачиванию (там всё равно нельзя).
            <button
              type="button"
              onClick={() => {
                const bad = document.querySelector<HTMLElement>("[aria-invalid=true]");
                bad?.scrollIntoView({ behavior: "smooth", block: "center" });
                bad?.focus({ preventScroll: true });
              }}
              className="mt-2 inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-stage px-3.5 font-heading text-sm font-bold text-on-stage"
            >
              {t.fixIt} <span className="text-accent">↑</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => previewRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
              className="mt-2 inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-stage px-3.5 font-heading text-sm font-bold text-on-stage"
            >
              {t.step3} <span className="text-accent">↓</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[minmax(0,1fr)_400px] lg:items-start">
      {/* В генераторе шаги 1 и 2 — один блок и на телефоне: закреплённый сверху код держится только в нём. */}
      <div className={steps ? "min-w-0 space-y-5" : "contents lg:block lg:space-y-5"}>
        {bar}
        {top && <div className="order-1 min-w-0">{top}</div>}
        <div className={`min-w-0 ${steps ? "order-2" : "order-3"}`}>
          {locked ? (
            <section className="flex gap-4 rounded-2xl bg-stage p-5 text-on-stage sm:p-6">
              <span aria-hidden className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-accent text-on-accent">
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="5" y="11" width="14" height="10" rx="2" />
                  <path d="M8 11V8a4 4 0 0 1 8 0v3" />
                </svg>
              </span>
              <div>
                <h2 className="font-heading text-lg font-bold">{t.styleLockedTitle}</h2>
                <p className="mt-1 text-sm leading-relaxed text-on-stage/70">{t.styleLockedText}</p>
              </div>
            </section>
          ) : (
            <StylePanel
              t={t}
              s={style}
              set={patchStyle}
              onLogo={onLogo}
              onEyeIcon={onEyeIcon}
              picturePicker={picker}
              lowContrast={lowContrast}
              step={steps ? 2 : undefined}
              suggestLogo={suggestLogo}
            />
          )}
          {imageError && <p className="mt-2 text-sm text-warn">{t.imageError}</p>}
        </div>
      </div>
      {/* В генераторе шаги идут по порядку и на телефоне: 1, 2, 3. */}
      <div ref={previewRef} className={`min-w-0 space-y-4 lg:sticky lg:top-4 ${steps ? "order-3" : "order-2"}`}>
        <Preview
          key={payload}
          t={t}
          drawing={drawing}
          scan={scan}
          error={tooLong ? t.tooLong : null}
          name={fileName}
          gate={gate}
          payload={payload}
          sample={sample}
          step={steps ? 3 : undefined}
          note={note}
        />
        {side}
      </div>
    </div>
  );
}
