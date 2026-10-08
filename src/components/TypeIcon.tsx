// Значки видов содержимого в генераторе — чтобы с первого взгляда было ясно, что откроет код.
import type { ContentType } from "@/lib/qr/payload";

const P: Record<ContentType, React.ReactNode> = {
  url: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3Z" />
    </>
  ),
  text: <path d="M5 6h14M5 10h14M5 14h9M5 18h6" />,
  wifi: (
    <>
      <path d="M2.5 9a14 14 0 0 1 19 0M5.5 12.5a9.5 9.5 0 0 1 13 0M8.6 16a5 5 0 0 1 6.8 0" />
      <circle cx="12" cy="19.2" r="1" fill="currentColor" />
    </>
  ),
  contact: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="3" />
      <circle cx="9" cy="10.5" r="2.5" />
      <path d="M5.5 17c.6-2 2-3 3.5-3s2.9 1 3.5 3M15 9h3M15 13h3" />
    </>
  ),
  location: (
    <>
      <path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21Z" />
      <circle cx="12" cy="9.5" r="2.5" />
    </>
  ),
  event: (
    <>
      <rect x="3.5" y="5" width="17" height="15" rx="3" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
      <path d="M8 14h2M12 14h2M8 17h2" />
    </>
  ),
  phone: <path d="M6.5 3.5h3l1.5 4-2 1.5a11 11 0 0 0 6 6l1.5-2 4 1.5v3a2 2 0 0 1-2 2A16 16 0 0 1 4.5 5.5a2 2 0 0 1 2-2Z" />,
  sms: (
    <>
      <path d="M4 5h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H9l-4 3.5V17H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z" />
      <path d="M7.5 11h.01M12 11h.01M16.5 11h.01" strokeWidth="2.6" />
    </>
  ),
  email: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2.5" />
      <path d="m4 7 8 6 8-6" />
    </>
  ),
  whatsapp: (
    <>
      <path d="M4 20.5 5.2 16.6A8.5 8.5 0 1 1 8.4 19.6Z" />
      <path d="M9.2 8.6c.3-.5.6-.5.9-.5h.5c.2 0 .4 0 .5.4l.7 1.6c0 .2 0 .4-.1.5l-.5.6c-.1.1-.2.3 0 .5.5.8 1.6 1.9 2.5 2.3.2.1.4.1.5-.1l.6-.7c.2-.2.3-.2.5-.1l1.6.8c.2.1.3.2.3.4 0 .9-.6 1.6-1.4 1.8-.8.2-2.5-.1-4.2-1.6-1.8-1.6-2.6-3.3-2.7-4.1-.1-.7.1-1.3.3-1.8Z" fill="currentColor" strokeWidth="0" />
    </>
  ),
  telegram: <path d="M21 4 3 11l6 2.2M21 4l-3 16-6.5-5M21 4 9 13.2m0 0v5.3l2.5-3.5" />,
  viber: (
    <>
      <path d="M12 3c5 0 8 2 8 7.5S17 18 12 18c-.7 0-1.4 0-2-.1L7 21v-3.6C5 16.3 4 14 4 10.5 4 5 7 3 12 3Z" />
      <path d="M9.6 8.2c.4-.4.9-.3 1.1 0l.7 1.1c.2.3.1.7-.2.9l-.3.3c.4 1.1 1.3 2 2.4 2.4l.3-.3c.2-.3.6-.4.9-.2l1.1.7c.3.2.4.7 0 1.1-.6.7-1.5.8-2.3.4a7 7 0 0 1-3.4-3.4c-.4-.8-.3-1.7.4-2.3Z" fill="currentColor" strokeWidth="0" />
    </>
  ),
  instagram: (
    <>
      <rect x="3.5" y="3.5" width="17" height="17" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17" cy="7" r="1" fill="currentColor" />
    </>
  ),
  facebook: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M13 21v-8h3l.4-3H13V8.5c0-.9.3-1.5 1.6-1.5H16.5V4.4A20 20 0 0 0 14 4.2c-2.4 0-4 1.5-4 4.1V10H7.5v3H10v8" />
    </>
  ),
  tiktok: <path d="M14 3v11.5a3.5 3.5 0 1 1-3.5-3.5M14 3c.4 2.6 2.2 4.4 5 4.6" />,
  youtube: (
    <>
      <rect x="2.5" y="5.5" width="19" height="13" rx="4" />
      <path d="m10 9 5 3-5 3Z" fill="currentColor" />
    </>
  ),
  linkedin: (
    <>
      <rect x="3.5" y="3.5" width="17" height="17" rx="3" />
      <path d="M8 10.5v6M8 7.5v.01M12 16.5v-6M12 13c0-1.6 1-2.6 2.3-2.6s2 .9 2 2.6v3.5" />
    </>
  ),
  x: <path d="M4 4h4.5L20 20h-4.5ZM20 4l-6.6 7.3M4 20l6.6-7.3" />,
};

export function TypeIcon({ type, className = "h-6 w-6" }: { type: ContentType; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {P[type]}
    </svg>
  );
}
