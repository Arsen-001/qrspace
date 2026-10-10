"use client";
import { memo, useEffect, useId, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import type { Dict } from "@/lib/i18n";
import { ballSample, DOT_STYLES, dotSample, EFFECTS, EYE_BALLS, EYE_STYLES, eyeSample, type EyeBall, type DotStyle, type Effect, type EyeStyle, type IconMask, type Rotation } from "@/lib/qr/render";
import { buildDrawing, CAPTION_MAX, toSvg } from "@/lib/qr/render";
import { isPreset, STYLE_PRESETS, type StylePreset } from "@/lib/qr/presets";
import { DEFAULT_STYLE, toQrStyle } from "@/lib/qr/style";
import { TEXTURE_INK, TEXTURES, textureSrc, type TextureId } from "@/lib/qr/textures";
import { useMe } from "@/lib/me";
import { LogoPicker, logoFile } from "./LogoPicker";
import type { PictureState } from "./PicturePicker";
import { Card, GhostButton, Info, Label, Slider, UploadButton } from "./ui";

type Tab = "colors" | "shape" | "bg" | "media";

export type StyleState = {
  fg: string;
  bg: string;
  eyeColor: string;
  dot: DotStyle;
  eye: EyeStyle;
  eyeBall: EyeBall;
  eyeBallColor: string;
  gradient: { to: string; angle: number } | null;
  rotate: Rotation;
  effect: Effect;
  texture: TextureId | null;
  eyeIcon: { mask: IconMask; preview: string; strength: number } | null;
  logo: { src: string; scale: number; band?: boolean } | null;
  picture: PictureState | null;
  /** Текст под кодом (по ширине кода) и номер телефона второй строкой. */
  caption?: string | null;
  captionPhone?: string | null;
};

const PRESETS: [string, string][] = [
  ["#111111", "#ffffff"],
  ["#1b2a4a", "#ffffff"],
  ["#7a1f2b", "#fff8f0"],
  ["#14532d", "#f2fbf4"],
  ["#4c1d95", "#f7f3ff"],
  ["#ffffff", "#111111"],
  ["#0b5132", "#e6f4ea"], // «зелёная плата» — к стилю «Микросхема»
];

/** Плитки выбора формы: образец рисуется тем же кодом, что и сам QR. Выбранная — тёмная, с лаймом (как карточки маркета). */
function ShapeTiles<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: { id: T; name: string; icon: ReactNode }[]; onChange: (v: T) => void }) {
  return (
    <div role="radiogroup" aria-label={label} className="grid grid-cols-3 gap-2 sm:grid-cols-[repeat(auto-fill,minmax(92px,1fr))]">
      {options.map((o) => {
        const on = value === o.id;
        return (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.id)}
            className={`relative flex min-w-0 flex-col items-center gap-2 rounded-2xl border px-1 pb-2.5 pt-3 text-xs font-semibold leading-tight transition-all ${
              on ? "border-accent/70 bg-stage text-on-stage shadow-lg shadow-black/15" : "border-line bg-card hover:-translate-y-0.5 hover:border-ink/25 hover:shadow-md"
            }`}
          >
            {on && <Tick />}
            <span className={`grid h-11 w-11 place-items-center rounded-xl ${on ? "bg-white/10 text-accent" : "bg-field text-ink"}`}>{o.icon}</span>
            <span className="max-w-full truncate px-0.5">{o.name}</span>
          </button>
        );
      })}
    </div>
  );
}

/** Лаймовая галочка в углу выбранного. */
function Tick() {
  return (
    <span aria-hidden className="absolute right-1.5 top-1.5 grid h-4 w-4 place-items-center rounded-full bg-accent text-on-accent">
      <svg viewBox="0 0 12 12" className="h-2.5 w-2.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="m2.5 6.3 2.3 2.2 4.7-5" />
      </svg>
    </span>
  );
}

/** Заголовок раздела в тонкой настройке — моноширинный, как надписи на первом экране. */
function Head({ children, hint }: { children: ReactNode; hint?: string }) {
  return (
    <div className="mb-3">
      <div className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-ink">{children}</div>
      {hint && <div className="mt-1 text-xs leading-relaxed text-muted">{hint}</div>}
    </div>
  );
}

/** Выбор из нескольких: дорожка, выбранное — тёмная таблетка. */
function Pills<T extends string>({ value, options, onChange }: { value: T; options: { id: T; label: ReactNode }[]; onChange: (v: T) => void }) {
  return (
    <div role="radiogroup" className="flex gap-1 rounded-2xl border border-line bg-field p-1">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          role="radio"
          aria-checked={value === o.id}
          onClick={() => onChange(o.id)}
          className={`min-h-10 min-w-0 flex-1 rounded-xl px-2 text-sm font-semibold leading-tight transition-all ${
            value === o.id ? "bg-stage text-on-stage shadow-md shadow-black/15 ring-1 ring-accent/60" : "text-muted hover:bg-card hover:text-ink"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Пара цветов кружком: фон — круг, цвет точек — квадратик в нём (как маленький код). */
function ColorPair({ fg, bg, on, label, onClick }: { fg: string; bg: string; on: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={on}
      onClick={onClick}
      className={`relative grid h-11 w-11 shrink-0 place-items-center rounded-full border border-line shadow-sm transition-all hover:scale-105 ${on ? "ring-2 ring-accent ring-offset-2 ring-offset-[var(--card)]" : ""}`}
      style={{ background: bg }}
    >
      <span className="grid grid-cols-2 gap-[2px]">
        {[1, 0, 1, 1].map((v, i) => (
          <span key={i} className="h-[7px] w-[7px] rounded-[2px]" style={{ background: v ? fg : "transparent" }} />
        ))}
      </span>
    </button>
  );
}

/** Свой цвет: большой кружок (нажал — палитра) и код цвета. */
function ColorPick({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const id = useId();
  return (
    <label htmlFor={id} className="group flex min-w-0 cursor-pointer items-center gap-3 rounded-2xl border border-line bg-card p-2.5 transition-colors hover:border-ink/25">
      <span className="relative h-10 w-10 shrink-0 rounded-full border border-line shadow-inner" style={{ background: value }}>
        <input id={id} type="color" value={value} onChange={(e) => onChange(e.target.value)} className="absolute inset-0 h-full w-full cursor-pointer rounded-full opacity-0" />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-xs font-semibold">{label}</span>
        <span className="block font-mono text-[11px] uppercase text-muted">{value}</span>
      </span>
    </label>
  );
}

/** Переключатель «вкл/выкл» в нашем стиле вместо галочки. */
function Toggle({ label, on, onChange }: { label: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" role="switch" aria-checked={on} onClick={() => onChange(!on)} className="flex min-h-11 w-full items-center justify-between gap-3 rounded-2xl border border-line bg-card px-3.5 text-sm font-semibold hover:border-ink/25">
      {label}
      <span className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${on ? "bg-stage" : "bg-line"}`}>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full shadow transition-all ${on ? "left-[1.375rem] bg-accent" : "left-0.5 bg-white"}`} />
      </span>
    </button>
  );
}

/**
 * Поле, которое меняет рисунок (подпись, номер под кодом): печатаем в своё состояние, в код — после паузы или при выходе
 * из поля. Иначе на телефоне каждая буква перерисовывала бы код, проверку и всю панель — ввод отставал.
 */
function LazyInput({
  value,
  onCommit,
  filter,
  counter,
  ...rest
}: { value: string; onCommit: (v: string) => void; filter?: (v: string) => string; counter?: number } & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange">) {
  const [draft, setDraft] = useState(value);
  // Что пришло снаружи и что отправили сами: снаружи поменяли (черновик, другой код) — показываем новое,
  // вернулось наше — не трогаем (человек мог допечатать).
  const [seen, setSeen] = useState(value);
  const [sent, setSent] = useState(value);
  if (value !== seen) {
    setSeen(value);
    if (value !== sent) setDraft(value);
  }
  const commit = (v: string) => {
    setSent(v);
    onCommit(v);
  };
  useEffect(() => {
    if (draft === value) return;
    const id = setTimeout(() => {
      setSent(draft);
      onCommit(draft);
    }, 300);
    return () => clearTimeout(id);
  }, [draft, value, onCommit]);
  return (
    <>
      <input {...rest} value={draft} onChange={(e) => setDraft(filter ? filter(e.target.value) : e.target.value)} onBlur={() => draft !== value && commit(draft)} />
      {counter && (
        <span className="font-mono text-xs text-muted">
          {draft.length}/{counter}
        </span>
      )}
    </>
  );
}

/** Иконки вкладок тонкой настройки. */
const TAB_ICON: Record<Tab, ReactNode> = {
  colors: <path d="M12 3a9 9 0 1 0 0 18c1.1 0 1.6-.9 1.2-1.8-.5-1-.1-2.2 1.1-2.2H17a4 4 0 0 0 4-4c0-5.5-4-10-9-10ZM7.5 11.5h.01M10 7.5h.01M15 7.5h.01" />,
  shape: <path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM15 15h4v4h-4z" />,
  bg: <path d="m12 3 9 5-9 5-9-5 9-5ZM3 13l9 5 9-5" />,
  media: <path d="M4 5h16v14H4zM4 15l4.5-4.5L13 15m-1.5-1.5L14 11l6 6M15.5 8.5h.01" />,
};

const noSubscribe = () => () => {};

/** Образец текстуры: рисуется только в браузере (на сервере — просто цвет). */
function TextureSwatch({ id }: { id: TextureId }) {
  const src = useSyncExternalStore(noSubscribe, () => textureSrc(id, 64), () => "");
  return (
    <span
      className="block h-10 w-10 rounded-lg border border-line bg-cover"
      style={{ backgroundColor: TEXTURE_INK[id].bg, backgroundImage: src ? `url(${src})` : undefined }}
    >
      <span className="m-3 block h-4 w-4 rounded-sm" style={{ background: TEXTURE_INK[id].fg }} />
    </span>
  );
}

function BallIcon({ kind, dot }: { kind: Exclude<EyeBall, "auto">; dot: DotStyle }) {
  const { ring, ball } = ballSample(kind, dot);
  return (
    <svg viewBox="-0.3 -0.3 7.6 7.6" className="h-7 w-7" aria-hidden>
      <path d={ring} fill="currentColor" fillRule="evenodd" opacity={0.3} />
      <path d={ball} fill="currentColor" />
    </svg>
  );
}

function DotIcon({ kind }: { kind: DotStyle }) {
  return (
    <svg viewBox="-0.15 -0.15 3.3 3.3" className="h-7 w-7" aria-hidden>
      <path d={dotSample(kind)} fill="currentColor" />
    </svg>
  );
}

function EyeIcon({ kind, dot }: { kind: EyeStyle; dot: DotStyle }) {
  const { ring, ball, rule, detail, emboss } = eyeSample(kind, dot);
  return (
    <svg viewBox="-0.3 -0.3 7.6 7.6" className="h-7 w-7" aria-hidden>
      <path d={ring} fill="currentColor" fillRule={rule ?? "nonzero"} />
      <path d={ball} fill="currentColor" />
      {detail && <path d={detail} className="fill-[var(--card)]" />}
      {emboss && <path d={emboss} fill="currentColor" className="opacity-50 mix-blend-luminosity" />}
    </svg>
  );
}

/** Готовые стили: маленький настоящий код каждого стиля, нажал — оформление применилось. */
function PresetGrid({ t, s, set }: { t: Dict; s: StyleState; set: (patch: Partial<StyleState>) => void }) {
  const thumbs = useMemo(
    () => STYLE_PRESETS.map((pr) => ({ pr, svg: toSvg(buildDrawing("HTTPS://QRSPACE.CO/K/ABC123", toQrStyle({ ...DEFAULT_STYLE, ...pr.style })), 96) })),
    [],
  );
  const apply = (pr: StylePreset) => set({ ...pr.style, texture: null });
  return (
    <div role="radiogroup" aria-label={t.styleReady} className="x-noscrollbar -mx-1 flex snap-x gap-2 overflow-x-auto px-1 pb-1 sm:mx-0 sm:grid sm:grid-cols-5 sm:overflow-visible sm:px-0">
      {thumbs.map(({ pr, svg }) => {
        const on = isPreset(s, pr);
        return (
          <button
            key={pr.id}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => apply(pr)}
            className={`w-[84px] shrink-0 snap-start rounded-xl border-2 p-1.5 text-center transition-all sm:w-auto ${on ? "border-accent bg-accent/15" : "border-transparent hover:-translate-y-0.5 hover:border-line"}`}
          >
            <span aria-hidden className="block aspect-square overflow-hidden rounded-lg border border-line shadow-sm [&>svg]:h-full [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: svg }} />
            <span className="mt-1.5 block truncate text-xs font-semibold">{t[`preset.${pr.id}` as keyof Dict]}</span>
          </button>
        );
      })}
    </div>
  );
}

/** Панель вида. memo: пока человек печатает в шаге 1, вид не меняется — панель (сотни плиток и значков) не перерисовываем. */
export const StylePanel = memo(function StylePanel({
  t,
  s,
  set,
  onLogo,
  onEyeIcon,
  picturePicker,
  lowContrast,
  step,
  suggestLogo,
}: {
  t: Dict;
  s: StyleState;
  set: (patch: Partial<StyleState>) => void;
  onLogo: (f: File, scale?: number, band?: boolean) => void;
  onEyeIcon: (f: File) => void;
  picturePicker: ReactNode;
  lowContrast: boolean;
  /** Номер шага в генераторе. */
  step?: number;
  /** Готовый логотип под вид содержимого — первым в строке логотипов. */
  suggestLogo?: string;
}) {
  const [tab, setTab] = useState<Tab>("colors");
  const { colors } = useMe();
  // Какой готовый логотип выбран (свой файл — «own»; логотипа нет — null).
  const [logoId, setLogoId] = useState<string | null>(null);
  const picked = s.logo ? (logoId ?? "own") : null;
  const logoProps = {
    t,
    picked,
    suggest: suggestLogo,
    onPick: (l: Parameters<typeof logoFile>[0]) => {
      setLogoId(l.id);
      onLogo(logoFile(l));
    },
    onNone: () => {
      setLogoId(null);
      set({ logo: null });
    },
  };
  const tabs: { id: Tab; label: string }[] = [
    { id: "colors", label: t.colors },
    { id: "shape", label: t.tabShape },
    { id: "bg", label: t.tabBg },
    { id: "media", label: t.tabMedia },
  ];
  // Неактивные вкладки не убираем, а прячем: загруженные файлы и выбранное остаются на месте.
  const panel = (id: Tab) => ({ role: "tabpanel", id: `style-${id}`, "aria-labelledby": `style-tab-${id}`, hidden: tab !== id, className: "space-y-7 pt-6" }) as const;
  return (
    <Card title={t.step2} step={step} info={t.infoStep2}>
      <Label hint={t.styleReadyHint}>{t.styleReady}</Label>
      <PresetGrid t={t} s={s} set={set} />

      <div className="mt-5">
        <Label hint={t.logoQuickHint} info={t.infoLogo}>{t.logoQuick}</Label>
        <LogoPicker
          {...logoProps}
          mode="quick"
          onMore={() => {
            setTab("media");
            document.getElementById("style-tab-media")?.scrollIntoView({ behavior: "smooth", block: "center" });
          }}
        />
      </div>


      <div className="mt-5">
        <Label hint={t.captionHint} info={t.infoCaption}>{t.captionLabel}</Label>
        <div className="flex min-h-11 max-w-md items-center rounded-xl border border-line bg-field pr-3 focus-within:border-accent">
          <LazyInput
            value={s.caption ?? ""}
            maxLength={CAPTION_MAX}
            counter={CAPTION_MAX}
            onCommit={(v) => set({ caption: v || null })}
            placeholder="Scan me"
            aria-label={t.captionLabel}
            className="min-w-0 flex-1 bg-transparent px-3.5 font-heading font-bold outline-none"
          />
        </div>
        <div className="mt-2 flex min-h-11 max-w-md items-center rounded-xl border border-line bg-field focus-within:border-accent">
          <span aria-hidden className="pl-3.5 text-muted">
            ☎
          </span>
          <LazyInput
            value={s.captionPhone ?? ""}
            maxLength={24}
            inputMode="tel"
            filter={(v) => v.replace(/[^\d+()\s-]/g, "")}
            onCommit={(v) => set({ captionPhone: v || null })}
            placeholder="+374 91 123456"
            aria-label={t.captionPhone}
            className="min-w-0 flex-1 bg-transparent px-3 font-heading font-bold outline-none"
          />
        </div>
      </div>

      <div className="mt-7 border-t border-line pt-6">
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h3 className="flex items-center gap-2 font-heading text-lg font-extrabold">
            {t.moreSettings}
            <Info text={t.infoFineTune} label={t.moreSettings} />
          </h3>
          <span aria-hidden className="shrink-0 whitespace-nowrap font-mono text-[11px] uppercase tracking-[0.14em] text-muted">
            {tabs.findIndex((x) => x.id === tab) + 1} / {tabs.length}
          </span>
        </div>
        <div role="tablist" aria-label={t.moreSettings} className="grid grid-cols-4 gap-1 rounded-2xl bg-stage p-1.5">
          {tabs.map((x) => (
            <button
              key={x.id}
              id={`style-tab-${x.id}`}
              type="button"
              role="tab"
              aria-selected={tab === x.id}
              aria-controls={`style-${x.id}`}
              onClick={() => setTab(x.id)}
              className={`flex min-h-14 min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-1 py-1.5 text-[11px] font-bold leading-tight transition-all sm:min-h-11 sm:flex-row sm:gap-2 sm:text-sm ${
                tab === x.id ? "bg-accent text-on-accent shadow-[0_0_20px_rgba(198,255,46,0.35)]" : "text-on-stage/60 hover:bg-white/5 hover:text-on-stage"
              }`}
            >
              <svg viewBox="0 0 24 24" className="h-[18px] w-[18px] shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                {TAB_ICON[x.id]}
              </svg>
              <span className="max-w-full text-center sm:truncate">{x.label}</span>
            </button>
          ))}
        </div>

        <div {...panel("colors")}>
          {colors.length > 0 && (
            <div>
              <Head>{t.recentColors}</Head>
              <div className="flex flex-wrap gap-2.5">
                {colors.map(({ fg, bg }) => (
                  <ColorPair
                    key={fg + bg}
                    fg={fg}
                    bg={bg}
                    on={s.fg === fg && s.bg === bg}
                    label={`${t.recentColors}: ${fg} / ${bg}`}
                    onClick={() => set({ fg, bg, eyeColor: fg, eyeBallColor: fg, texture: null })}
                  />
                ))}
              </div>
            </div>
          )}
          <div>
            <Head>{t.presets}</Head>
            <div className="flex flex-wrap gap-2.5" aria-label={t.presets}>
              {PRESETS.map(([fg, bg]) => (
                <ColorPair key={fg + bg} fg={fg} bg={bg} on={s.fg === fg && s.bg === bg} label={`${fg} / ${bg}`} onClick={() => set({ fg, bg, eyeColor: fg, eyeBallColor: fg })} />
              ))}
            </div>
          </div>
          <div>
            <div className="mb-3 flex items-center justify-between gap-2">
              <Head>{t.colors}</Head>
              <button
                type="button"
                onClick={() => set({ fg: s.bg, bg: s.fg, eyeColor: s.bg, eyeBallColor: s.bg })}
                className="x-hit -mt-3 flex min-h-9 items-center gap-1.5 rounded-full border border-line bg-card px-3 text-xs font-bold hover:border-ink/25"
              >
                <span aria-hidden>⇄</span> {t.swap}
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <ColorPick
                label={t.fg}
                value={s.fg}
                onChange={(fg) => set({ fg, eyeColor: s.eyeColor === s.fg ? fg : s.eyeColor, eyeBallColor: s.eyeBallColor === s.eyeColor ? (s.eyeColor === s.fg ? fg : s.eyeColor) : s.eyeBallColor })}
              />
              <ColorPick label={t.bg} value={s.bg} onChange={(bg) => set({ bg })} />
              <ColorPick label={t.eyeColor} value={s.eyeColor} onChange={(eyeColor) => set({ eyeColor, eyeBallColor: s.eyeBallColor === s.eyeColor ? eyeColor : s.eyeBallColor })} />
              <ColorPick label={t.eyeBallColor} value={s.eyeBallColor} onChange={(eyeBallColor) => set({ eyeBallColor })} />
            </div>
            {lowContrast && <p className="mt-2 rounded-xl bg-warn/10 px-3 py-2 text-sm font-medium text-warn">{t.lowContrast}</p>}
          </div>
          <div className="space-y-3">
            <Toggle label={t.gradient} on={!!s.gradient} onChange={(v) => set({ gradient: v ? { to: "#2e3fd6", angle: 45 } : null })} />
            {s.gradient && (
              <div className="grid gap-3 rounded-2xl border border-line bg-field p-3 sm:grid-cols-[minmax(0,200px)_1fr] sm:items-center">
                <ColorPick label={t.gradientTo} value={s.gradient.to} onChange={(to) => s.gradient && set({ gradient: { ...s.gradient, to } })} />
                <Slider label={`${t.gradientAngle}: ${s.gradient.angle}°`} value={s.gradient.angle} min={0} max={345} step={15} onChange={(angle) => s.gradient && set({ gradient: { ...s.gradient, angle } })} />
              </div>
            )}
          </div>
        </div>

        <div {...panel("bg")}>
          {!s.picture && (
            <div>
              <Head hint={t.textureHint}>{t.texture}</Head>
              <ShapeTiles<"none" | TextureId>
                label={t.texture}
                value={s.texture ?? "none"}
                onChange={(id) =>
                  id === "none"
                    ? set({ texture: null })
                    : set({ texture: id, bg: TEXTURE_INK[id].bg, fg: TEXTURE_INK[id].fg, eyeColor: TEXTURE_INK[id].fg, eyeBallColor: TEXTURE_INK[id].ball })
                }
                options={[
                  { id: "none" as const, name: t["texture.none"], icon: <span className="block h-10 w-10 rounded-lg border border-dashed border-line" /> },
                  ...TEXTURES.map((id) => ({ id, name: t[`texture.${id}`], icon: <TextureSwatch id={id} /> })),
                ]}
              />
            </div>
          )}

          <div>
            <Head hint={t.effectHint}>{t.effect}</Head>
            <Pills value={s.effect} onChange={(effect) => set({ effect })} options={EFFECTS.map((id) => ({ id, label: t[`effect.${id}`] }))} />
          </div>

        </div>

        <div {...panel("shape")}>
          <div>
            <Head>{t.dots}</Head>
            <ShapeTiles label={t.dots} value={s.dot} onChange={(dot) => set({ dot })} options={DOT_STYLES.map((id) => ({ id, name: t[`dot.${id}`], icon: <DotIcon kind={id} /> }))} />
          </div>

          <div>
            <Head>{t.eyes}</Head>
            <ShapeTiles label={t.eyes} value={s.eye} onChange={(eye) => set({ eye })} options={EYE_STYLES.map((id) => ({ id, name: t[`eye.${id}`], icon: <EyeIcon kind={id} dot={s.dot} /> }))} />
            <div className="mt-6">
              <Head>{t.eyeBall}</Head>
              <ShapeTiles
                label={t.eyeBall}
                value={s.eyeBall}
                onChange={(eyeBall) => set({ eyeBall })}
                options={EYE_BALLS.map((id) => ({
                  id,
                  name: t[`ball.${id}`],
                  icon: id === "auto" ? <EyeIcon kind={s.eye} dot={s.dot} /> : <BallIcon kind={id} dot={s.dot} />,
                }))}
              />
            </div>
            <div className="mt-6">
              <Head hint={t.eyeIconHint}>{t.eyeIcon}</Head>
              <div className="flex flex-wrap items-center gap-2">
                {s.eyeIcon && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={s.eyeIcon.preview} alt="" className="h-10 w-10 rounded-lg border border-line bg-white object-contain p-1" />
                )}
                <UploadButton label={s.eyeIcon ? t.replace : t.upload} onFile={onEyeIcon} />
                {s.eyeIcon && <GhostButton onClick={() => set({ eyeIcon: null })}>{t.remove}</GhostButton>}
              </div>
              {s.eyeIcon && (
                <div className="mt-3">
                  <Slider
                    label={t.eyeIconStrength}
                    value={s.eyeIcon.strength}
                    min={0.1}
                    max={0.24}
                    step={0.02}
                    onChange={(strength) => s.eyeIcon && set({ eyeIcon: { ...s.eyeIcon, strength } })}
                  />
                </div>
              )}
            </div>
            <div className="mt-6">
              <Head hint={t.rotateHint}>{t.rotate}</Head>
              <Pills
                value={String(s.rotate)}
                onChange={(v) => set({ rotate: Number(v) as Rotation })}
                options={["0", "90", "180", "270"].map((id) => ({ id, label: `${id}°` }))}
              />
            </div>
          </div>

        </div>

        <div {...panel("media")}>
          {picturePicker}
          <div>
            <Head hint={t.logoQuickHint}>{t.logo}</Head>
            <LogoPicker {...logoProps} mode="all" />
            <div className="mt-6">
              <Head hint={t.logoHint}>{t.logoOwn}</Head>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {s.logo && picked === "own" && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={s.logo.src} alt="" className="h-10 w-10 rounded-lg border border-line bg-white object-contain" />
              )}
              <UploadButton
                label={picked === "own" ? t.replace : t.upload}
                onFile={(f) => {
                  setLogoId(null);
                  onLogo(f);
                }}
              />
              {s.logo && <GhostButton onClick={logoProps.onNone}>{t.remove}</GhostButton>}
            </div>
            {s.logo && (
              <div className="mt-4">
                <Slider label={t.logoSize} value={s.logo.scale} min={0.12} max={0.3} step={0.02} onChange={(scale) => s.logo && set({ logo: { ...s.logo, scale } })} />
              </div>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
});
