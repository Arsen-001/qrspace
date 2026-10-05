// Проверка того, что присылает браузер: демо, но мусор в хранилище не пускаем.
import type { Grant, Visibility } from "@/lib/codes";
import type { SavedStyle } from "@/lib/qr/style";
import { isPerson } from "@/server/db";

export function readTitle(v: unknown): string | null {
  const s = typeof v === "string" ? v.trim().slice(0, 80) : "";
  return s || null;
}

export function readText(v: unknown): string {
  return typeof v === "string" ? v.trim().slice(0, 5000) : "";
}

export const readVisibility = (v: unknown): Visibility | null => (v === "all" || v === "people" || v === "me" ? v : null);

export function readPeople(v: unknown, owner: string): Grant[] | null {
  if (!Array.isArray(v)) return null;
  const out: Grant[] = [];
  for (const g of v as Record<string, unknown>[]) {
    if (!isPerson(g?.personId) || g.personId === owner || out.some((o) => o.personId === g.personId)) return null;
    if (g.role !== "view" && g.role !== "edit") return null;
    const until = g.until === null || g.until === undefined || g.until === "" ? null : g.until;
    if (until !== null && !(typeof until === "string" && /^\d{4}-\d{2}-\d{2}$/.test(until))) return null;
    out.push({ personId: g.personId, role: g.role, until });
  }
  return out;
}

/** Оформление — объект не больше ~1,5 МБ (коллаж из фото и его тона). */
export function readStyle(v: unknown): SavedStyle | null {
  if (!v || typeof v !== "object") return null;
  return JSON.stringify(v).length < 1_500_000 ? (v as SavedStyle) : null;
}
