"use client";
// Маленький рисунок сохранённого кода (для списков и карточек).
import { useMemo, useSyncExternalStore } from "react";
import { toSvg } from "@/lib/qr/render";
import { DEFAULT_STYLE, fromSaved, type SavedStyle } from "@/lib/qr/style";
import { useDrawing } from "./CodeDesigner";

const noSubscribe = () => () => {};
/** true только в браузере: текстуры рисуются на canvas, на сервере рисунка нет — иначе страницы не совпадут. */
export const useInBrowser = () => useSyncExternalStore(noSubscribe, () => true, () => false);

export function QrThumb({ link, style, className = "" }: { link: string; style: SavedStyle | null; className?: string }) {
  const s = useMemo(() => (style ? fromSaved(style) : DEFAULT_STYLE), [style]);
  const { drawing } = useDrawing(useInBrowser() ? link : "", s);
  const svg = useMemo(() => (drawing ? toSvg(drawing, 240) : ""), [drawing]);
  return <div aria-hidden className={`aspect-square overflow-hidden rounded-xl bg-white [&>svg]:h-full [&>svg]:w-full ${className}`} dangerouslySetInnerHTML={{ __html: svg }} />;
}
