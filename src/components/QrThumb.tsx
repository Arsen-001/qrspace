"use client";
// Маленький рисунок сохранённого кода (для списков и карточек).
import { useMemo } from "react";
import { toSvg } from "@/lib/qr/render";
import { DEFAULT_STYLE, fromSaved, type SavedStyle } from "@/lib/qr/style";
import { useDrawing } from "./CodeDesigner";

export function QrThumb({ link, style, className = "" }: { link: string; style: SavedStyle | null; className?: string }) {
  const s = useMemo(() => (style ? fromSaved(style) : DEFAULT_STYLE), [style]);
  const { drawing } = useDrawing(link, s);
  const svg = useMemo(() => (drawing ? toSvg(drawing, 240) : ""), [drawing]);
  return <div aria-hidden className={`aspect-square overflow-hidden rounded-xl bg-white [&>svg]:h-full [&>svg]:w-full ${className}`} dangerouslySetInnerHTML={{ __html: svg }} />;
}
