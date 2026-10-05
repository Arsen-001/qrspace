"use client";
// Колокольчик: уведомления на сайте (сообщения, просьбы, ставки, заказы) и дела на сегодня. Обновляется раз в 30 секунд.
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { api, type Notice, type Notices } from "@/lib/codes";
import { fmtDateTime } from "@/lib/format";
import { fill, type Dict, type Lang } from "@/lib/i18n";
import { personName } from "./Avatar";

function text(t: Dict, lang: Lang, n: Notice) {
  const key = `notice.${n.kind}` as keyof Dict;
  const status = n.params.status ? (t[`shopStatus.${n.params.status}` as keyof Dict] ?? n.params.status) : "";
  const base = fill(t[key] ?? n.kind, { ...n.params, status, who: n.params.who ? personName(n.params.who, lang) : "" });
  const extra = n.kind === "message" ? (n.params.preset ? t[`preset.${n.params.preset}` as keyof Dict] : n.params.text) : "";
  return { base, extra };
}

export function Bell({ t, lang }: { t: Dict; lang: Lang }) {
  const [data, setData] = useState<Notices | null>(null);
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let live = true;
    const load = () => api.notices().then((d) => live && setData(d), () => {});
    load();
    const id = setInterval(load, 30_000);
    return () => {
      live = false;
      clearInterval(id);
    };
  }, []);

  // Закрыть по клику мимо и по Esc.
  useEffect(() => {
    if (!open) return;
    const off = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !box.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", off);
    document.addEventListener("keydown", off);
    return () => {
      document.removeEventListener("mousedown", off);
      document.removeEventListener("keydown", off);
    };
  }, [open]);

  const count = (data?.unread ?? 0) + (data?.due ? 1 : 0);
  const toggle = () => {
    const next = !open;
    setOpen(next);
    // Открыли — значит, увидели: отмечаем прочитанными (точки «новое» остаются до закрытия).
    if (next && data?.unread) api.readNotices().then(() => setData((d) => d && { ...d, unread: 0 }), () => {});
  };

  return (
    <div ref={box} className="relative">
      <button type="button" onClick={toggle} aria-label={t.notices} aria-expanded={open} className="relative grid h-10 w-10 place-items-center rounded-xl text-muted hover:bg-card hover:text-ink">
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M6 9a6 6 0 0 1 12 0c0 6 2.5 7.5 2.5 7.5h-17S6 15 6 9" />
          <path d="M10 20a2.2 2.2 0 0 0 4 0" />
        </svg>
        {count > 0 && <span className="absolute right-1 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-warn px-1 text-[10px] font-bold text-on-warn">{count}</span>}
      </button>
      {open && (
        <div className="fixed inset-x-3 top-16 z-50 max-h-[70vh] overflow-y-auto rounded-2xl border border-line bg-card p-2 shadow-xl sm:absolute sm:inset-x-auto sm:right-0 sm:top-12 sm:w-96">
          <div className="px-3 py-2 font-heading font-bold">{t.notices}</div>
          {!!data?.due && (
            <Link href="/codes" onClick={() => setOpen(false)} className="mb-1 block rounded-xl bg-warn-soft px-3 py-2.5 text-sm font-semibold text-warn">
              {fill(t.noticeDue, { n: data.due })}
            </Link>
          )}
          {data?.items.length ? (
            <ul>
              {data.items.map((n) => {
                const { base, extra } = text(t, lang, n);
                return (
                  <li key={n.id}>
                    <Link href={n.link} onClick={() => setOpen(false)} className="flex gap-2.5 rounded-xl px-3 py-2.5 hover:bg-field">
                      <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.read ? "bg-transparent" : "bg-accent"}`} />
                      <span className="min-w-0">
                        <span className="block text-sm">{base}</span>
                        {extra && <span className="block truncate text-xs text-muted">{extra}</span>}
                        <span className="block text-[11px] text-muted">{fmtDateTime(n.at, lang)}</span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : (
            !data?.due && <p className="px-3 pb-3 text-sm text-muted">{t.noNotices}</p>
          )}
        </div>
      )}
    </div>
  );
}
