import { tr, type Lang } from "@/lib/i18n";
import { personById } from "@/lib/people";

/** Кружок с первой буквой имени. */
export function Avatar({ id, lang, size = 32 }: { id: string | null; lang: Lang; size?: number }) {
  const p = personById(id);
  return (
    <span
      aria-hidden
      className="grid shrink-0 place-items-center rounded-full font-semibold text-white"
      style={{ width: size, height: size, fontSize: size * 0.42, background: p?.color ?? "var(--muted)" }}
    >
      {p ? tr(p.name, lang).slice(0, 1) : "?"}
    </span>
  );
}

export const personName = (id: string | null, lang: Lang) => (personById(id) ? tr(personById(id)!.name, lang) : "—");
