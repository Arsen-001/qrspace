"use client";
import { useSyncExternalStore, type ReactNode } from "react";
import type { Dict } from "@/lib/i18n";
import { ballSample, DOT_STYLES, dotSample, EFFECTS, EYE_BALLS, EYE_STYLES, eyeSample, type EyeBall, type DotStyle, type Effect, type EyeStyle, type IconMask, type Rotation } from "@/lib/qr/render";
import { TEXTURE_INK, TEXTURES, textureSrc, type TextureId } from "@/lib/qr/textures";
import type { PictureState } from "./PicturePicker";
import { Card, ColorField, GhostButton, Label, Segmented, Slider, UploadButton } from "./ui";

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
  logo: { src: string; scale: number } | null;
  picture: PictureState | null;
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

/** Плитки выбора формы: образец рисуется тем же кодом, что и сам QR. */
function ShapeTiles<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: { id: T; name: string; icon: ReactNode }[]; onChange: (v: T) => void }) {
  return (
    <div role="radiogroup" aria-label={label} className="grid grid-cols-3 gap-1.5 sm:grid-cols-[repeat(auto-fill,minmax(88px,1fr))]">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          role="radio"
          aria-checked={value === o.id}
          onClick={() => onChange(o.id)}
          className={`flex min-w-0 flex-col items-center gap-1.5 rounded-xl border px-1 py-2.5 text-xs font-medium leading-tight transition-colors ${
            value === o.id ? "border-accent bg-accent text-on-accent" : "border-line bg-field hover:border-muted"
          }`}
        >
          {o.icon}
          <span className="max-w-full truncate">{o.name}</span>
        </button>
      ))}
    </div>
  );
}

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

export function StylePanel({
  t,
  s,
  set,
  onLogo,
  onEyeIcon,
  picturePicker,
  lowContrast,
}: {
  t: Dict;
  s: StyleState;
  set: (patch: Partial<StyleState>) => void;
  onLogo: (f: File) => void;
  onEyeIcon: (f: File) => void;
  picturePicker: ReactNode;
  lowContrast: boolean;
}) {
  return (
    <Card title={t.step2}>
      <div className="space-y-6">
        {picturePicker}

        <div>
          <Label>{t.colors}</Label>
          <div className="mb-3 flex flex-wrap gap-2" aria-label={t.presets}>
            {PRESETS.map(([fg, bg]) => {
              const on = s.fg === fg && s.bg === bg;
              return (
                <button
                  key={fg + bg}
                  type="button"
                  aria-label={`${fg} / ${bg}`}
                  aria-pressed={on}
                  onClick={() => set({ fg, bg, eyeColor: fg, eyeBallColor: fg })}
                  className={`grid h-10 w-10 place-items-center rounded-xl border-2 ${on ? "border-accent" : "border-line"}`}
                  style={{ background: bg }}
                >
                  <span className="h-4 w-4 rounded" style={{ background: fg }} />
                </button>
              );
            })}
          </div>
          <div className="flex flex-wrap gap-2">
            <ColorField
              label={t.fg}
              value={s.fg}
              onChange={(fg) => set({ fg, eyeColor: s.eyeColor === s.fg ? fg : s.eyeColor, eyeBallColor: s.eyeBallColor === s.eyeColor ? (s.eyeColor === s.fg ? fg : s.eyeColor) : s.eyeBallColor })}
            />
            <ColorField label={t.bg} value={s.bg} onChange={(bg) => set({ bg })} />
            <ColorField label={t.eyeColor} value={s.eyeColor} onChange={(eyeColor) => set({ eyeColor, eyeBallColor: s.eyeBallColor === s.eyeColor ? eyeColor : s.eyeBallColor })} />
            <ColorField label={t.eyeBallColor} value={s.eyeBallColor} onChange={(eyeBallColor) => set({ eyeBallColor })} />
          </div>
          <div className="mt-2 flex items-center justify-between gap-2">
            <GhostButton onClick={() => set({ fg: s.bg, bg: s.fg, eyeColor: s.bg, eyeBallColor: s.bg })}>⇄ {t.swap}</GhostButton>
          </div>
          {lowContrast && <p className="mt-1 text-sm text-warn">{t.lowContrast}</p>}
          <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={!!s.gradient}
              onChange={(e) => set({ gradient: e.target.checked ? { to: "#2e3fd6", angle: 45 } : null })}
              className="h-4 w-4 accent-[var(--accent)]"
            />
            {t.gradient}
          </label>
          {s.gradient && (
            <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,180px)_1fr] sm:items-end">
              <ColorField label={t.gradientTo} value={s.gradient.to} onChange={(to) => s.gradient && set({ gradient: { ...s.gradient, to } })} />
              <Slider label={`${t.gradientAngle}: ${s.gradient.angle}°`} value={s.gradient.angle} min={0} max={345} step={15} onChange={(angle) => s.gradient && set({ gradient: { ...s.gradient, angle } })} />
            </div>
          )}
        </div>

        {!s.picture && (
          <div>
            <Label hint={t.textureHint}>{t.texture}</Label>
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
          <Label hint={t.effectHint}>{t.effect}</Label>
          <Segmented value={s.effect} onChange={(effect) => set({ effect })} options={EFFECTS.map((id) => ({ id, label: t[`effect.${id}`] }))} />
        </div>

        <div>
          <Label>{t.dots}</Label>
          <ShapeTiles label={t.dots} value={s.dot} onChange={(dot) => set({ dot })} options={DOT_STYLES.map((id) => ({ id, name: t[`dot.${id}`], icon: <DotIcon kind={id} /> }))} />
        </div>

        <div>
          <Label>{t.eyes}</Label>
          <ShapeTiles label={t.eyes} value={s.eye} onChange={(eye) => set({ eye })} options={EYE_STYLES.map((id) => ({ id, name: t[`eye.${id}`], icon: <EyeIcon kind={id} dot={s.dot} /> }))} />
          <div className="mt-4">
            <Label>{t.eyeBall}</Label>
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
          <div className="mt-4">
            <Label hint={t.eyeIconHint}>{t.eyeIcon}</Label>
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
          <div className="mt-4">
            <div className="mb-1.5 text-sm font-medium">{t.rotate}</div>
            <Segmented
              value={String(s.rotate)}
              onChange={(v) => set({ rotate: Number(v) as Rotation })}
              options={["0", "90", "180", "270"].map((id) => ({ id, label: `${id}°` }))}
            />
            <div className="mt-1 text-xs text-muted">{t.rotateHint}</div>
          </div>
        </div>

        <div>
          <Label hint={t.logoHint}>{t.logo}</Label>
          <div className="flex flex-wrap items-center gap-2">
            {s.logo && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={s.logo.src} alt="" className="h-10 w-10 rounded-lg border border-line bg-white object-contain" />
            )}
            <UploadButton label={s.logo ? t.replace : t.upload} onFile={onLogo} />
            {s.logo && <GhostButton onClick={() => set({ logo: null })}>{t.remove}</GhostButton>}
          </div>
          {s.logo && (
            <div className="mt-4">
              <Slider label={t.logoSize} value={s.logo.scale} min={0.12} max={0.3} step={0.02} onChange={(scale) => s.logo && set({ logo: { ...s.logo, scale } })} />
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
