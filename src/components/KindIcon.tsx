import type { Kind } from "@/lib/codes";

/** Значок шаблона кода: память, машина, ключ, лапа. */
export function KindIcon({ kind, className = "h-5 w-5" }: { kind: Kind; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={`shrink-0 ${className}`} fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {kind === "memory" && (
        <>
          <rect x="4" y="3" width="16" height="18" rx="2.5" />
          <path d="M8 8h8M8 12h8M8 16h5" />
        </>
      )}
      {kind === "car" && (
        <>
          <path d="M3 16v-3.5l2.2-5A2 2 0 0 1 7 6.3h10a2 2 0 0 1 1.8 1.2l2.2 5V16a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1Z" />
          <path d="M3.5 12.5h17" />
          <circle cx="7.5" cy="17" r="1.8" />
          <circle cx="16.5" cy="17" r="1.8" />
        </>
      )}
      {kind === "lost" && (
        <>
          <circle cx="8" cy="15" r="4.5" />
          <path d="m11.2 11.8 8.3-8.3M16.5 6.5l2.5 2.5M14 9l2 2" />
        </>
      )}
      {kind === "item" && (
        <>
          <path d="M3.5 12.6 11.4 4.7a2 2 0 0 1 1.4-.6H19a1 1 0 0 1 1 1v6.2a2 2 0 0 1-.6 1.4l-7.9 7.9a1.5 1.5 0 0 1-2.1 0l-5.9-5.9a1.5 1.5 0 0 1 0-2.1Z" />
          <path d="m9 13 2 2 4-4" />
        </>
      )}
      {kind === "pet" && (
        <>
          <ellipse cx="12" cy="16" rx="4.5" ry="3.8" />
          <circle cx="5.5" cy="10.5" r="1.9" />
          <circle cx="18.5" cy="10.5" r="1.9" />
          <circle cx="9" cy="6" r="1.9" />
          <circle cx="15" cy="6" r="1.9" />
        </>
      )}
    </svg>
  );
}
