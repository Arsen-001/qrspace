import type { Visibility } from "@/lib/codes";
import type { Dict } from "@/lib/i18n";

export function VisIcon({ v, className = "h-4 w-4" }: { v: Visibility; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={`shrink-0 ${className}`} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {v === "all" && (
        <>
          <circle cx="12" cy="12" r="9" />
          <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
        </>
      )}
      {v === "people" && (
        <>
          <circle cx="9" cy="8" r="3.5" />
          <path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
          <path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14.2a6.5 6.5 0 0 1 3.5 5.8" />
        </>
      )}
      {v === "me" && (
        <>
          <rect x="5" y="11" width="14" height="10" rx="2" />
          <path d="M8 11V8a4 4 0 0 1 8 0v3" />
        </>
      )}
    </svg>
  );
}

export function VisBadge({ t, v }: { t: Dict; v: Visibility }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-field px-2.5 py-1 text-xs font-medium text-muted">
      <VisIcon v={v} className="h-3.5 w-3.5" />
      {t[`vis.${v}`]}
    </span>
  );
}
