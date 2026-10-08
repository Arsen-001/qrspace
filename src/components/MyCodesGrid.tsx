"use client";
// «Мои коды» сеткой: у каждого кода — рисунок, имя (переименовать прямо тут) и состояние; порядок — перетаскиванием
// (мышью сразу, на телефоне — долгим нажатием, чтобы не мешать прокрутке) или кнопками «выше/ниже». Порядок — на сервере.
import Link from "next/link";
import { useRef, useState, type ReactNode } from "react";
import {
  closestCenter,
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { arrayMove, rectSortingStrategy, SortableContext, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { linkOf, type CodeView } from "@/lib/codes";
import type { Dict } from "@/lib/i18n";
import { KindIcon } from "./KindIcon";
import { QrThumb } from "./QrThumb";
import { VisIcon } from "./VisBadge";

const saveOrder = (ids: string[]) =>
  fetch("/api/codes/order", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ ids }) }).then((r) => {
    if (!r.ok) throw new Error(String(r.status));
  });

const saveTitle = (id: string, title: string) =>
  fetch(`/api/codes/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ title }) }).then((r) => {
    if (!r.ok) throw new Error(String(r.status));
  });

/** Поле внутри карточки не должно начинать перетаскивание. */
const stop = { onMouseDown: (e: React.SyntheticEvent) => e.stopPropagation(), onTouchStart: (e: React.SyntheticEvent) => e.stopPropagation(), onKeyDown: (e: React.SyntheticEvent) => e.stopPropagation() };

function Chip({ children, tone = "plain", title }: { children: ReactNode; tone?: "plain" | "warn" | "dark" | "soft"; title?: string }) {
  // Низ карточки тёмный (как в маркете): спокойные метки — полупрозрачные, тревожные — красные, тираж — лаймом.
  const cls = { plain: "bg-on-stage/10 text-on-stage/80", warn: "bg-warn text-on-warn", dark: "bg-accent text-on-accent", soft: "bg-warn text-on-warn" }[tone];
  return (
    <span title={title} className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${cls}`}>
      {children}
    </span>
  );
}

function Name({ t, code, onRename }: { t: Dict; code: CodeView; onRename: (title: string) => Promise<void> }) {
  const [edit, setEdit] = useState(false);
  const [value, setValue] = useState(code.title ?? "");
  const [busy, setBusy] = useState(false);
  const commit = async () => {
    const v = value.trim();
    if (!v || v === code.title) {
      setValue(code.title ?? "");
      return setEdit(false);
    }
    setBusy(true);
    try {
      await onRename(v);
      setEdit(false);
    } catch {
      setValue(code.title ?? "");
      setEdit(false);
    } finally {
      setBusy(false);
    }
  };
  if (edit)
    return (
      <input
        autoFocus
        value={value}
        maxLength={80}
        disabled={busy}
        aria-label={t.rename}
        onChange={(e) => setValue(e.target.value)}
        onBlur={commit}
        {...stop}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === "Enter") e.currentTarget.blur();
          if (e.key === "Escape") {
            setValue(code.title ?? "");
            setEdit(false);
          }
        }}
        className="w-full min-w-0 rounded-lg border border-accent bg-on-stage/10 px-2 py-1 font-heading text-sm font-bold text-on-stage outline-none"
      />
    );
  return (
    <div className="flex items-start gap-1">
      <span data-name onDoubleClick={() => setEdit(true)} className="line-clamp-3 min-w-0 flex-1 font-heading text-sm font-bold leading-snug [hyphens:manual] sm:text-[15px]" title={code.title ?? ""}>
        {code.title}
      </span>
      <button
        type="button"
        {...stop}
        onClick={() => setEdit(true)}
        aria-label={`${t.rename}: ${code.title}`}
        title={t.rename}
        className="-mr-1 -mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg text-on-stage/50 hover:bg-on-stage/10 hover:text-on-stage"
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4" />
        </svg>
      </button>
    </div>
  );
}

function CardBody({ t, base, code, onRename, dragging }: { t: Dict; base: string; code: CodeView; onRename: (title: string) => Promise<void>; dragging?: boolean }) {
  const unread = code.messages?.filter((m) => !m.read).length ?? 0;
  const requests = code.requests?.length ?? 0;
  const notSet = code.kind === "link" && !code.content;
  return (
    <>
      {/* Код — на своём цвете, как на витрине маркета. */}
      <Link
        href={`/codes/${code.id}`}
        aria-label={code.title ?? undefined}
        draggable={false}
        className="relative block p-3 sm:p-4"
        style={{ background: code.style?.bg ?? "#ffffff" }}
        tabIndex={dragging ? -1 : undefined}
      >
        <QrThumb link={linkOf(base, code)} style={code.style} className={`w-full rounded-xl shadow-[0_10px_30px_-14px_rgba(0,0,0,0.45)] transition-transform duration-300 group-hover:scale-[1.03] ${code.blocked ? "opacity-40" : ""}`} />
        {(unread > 0 || requests > 0) && (
          <span className="absolute right-2 top-2 grid h-6 min-w-6 place-items-center rounded-full bg-warn px-1.5 text-xs font-bold text-on-warn shadow">{unread + requests}</span>
        )}
      </Link>
      <div className="flex flex-1 flex-col gap-2 p-3 sm:p-4">
        <div className="flex items-start gap-1.5">
          <KindIcon kind={code.kind} className="mt-0.5 h-4 w-4 shrink-0 text-on-stage/50" />
          <div className="min-w-0 flex-1">
            <Name t={t} code={code} onRename={onRename} />
          </div>
        </div>
        <div className="flex flex-wrap gap-1">
          <Chip title={t[`vis.${code.visibility}`]}>
            <VisIcon v={code.visibility} className="h-3 w-3" />
            {t[`vis.${code.visibility}`]}
          </Chip>
          {code.blocked && <Chip tone="warn">⛔ {t.blockedShort}</Chip>}
          {notSet && <Chip tone="soft">{t.notSetUp}</Chip>}
          {unread > 0 && <Chip tone="soft">{t.messagesBadge}: {unread}</Chip>}
          {requests > 0 && <Chip tone="soft">{t.requestsTitle}: {requests}</Chip>}
          {code.edition && <Chip tone="dark">{code.edition.design === "number" ? t.numberCode : `№ ${code.edition.no}${code.edition.of !== null ? `/${code.edition.of}` : ""}`}</Chip>}
          {code.lost && <Chip tone="warn">{t.lostMode}</Chip>}
        </div>
        <div className="mt-auto flex items-baseline gap-1.5 font-mono text-xs text-on-stage/60">
          <span className="font-heading text-lg font-extrabold text-on-stage">{code.stats?.total ?? 0}</span>
          {t.scansCount.toLowerCase()}
          {!!code.stats?.week && <span className="rounded-md bg-accent px-1.5 font-bold text-on-accent">+{code.stats.week}</span>}
        </div>
      </div>
    </>
  );
}

function SortableCard({ t, base, code, index, count, move, onRename, guard }: { t: Dict; base: string; code: CodeView; index: number; count: number; move: (from: number, to: number) => void; onRename: (title: string) => Promise<void>; guard: React.MutableRefObject<boolean> }) {
  // Тащить — мышью или долгим нажатием по карточке; с клавиатуры — кнопки «раньше / дальше» (карточка не кнопка,
  // иначе ссылки и кнопки внутри неё оказались бы «кнопкой в кнопке»).
  const { listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: code.id });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      {...listeners}
      // После перетаскивания отпускание не должно открыть код.
      onClickCapture={(e) => {
        if (guard.current) {
          e.preventDefault();
          e.stopPropagation();
        }
      }}
      onContextMenu={(e) => e.preventDefault()}
      className={`group relative flex touch-manipulation select-none flex-col overflow-hidden rounded-3xl bg-stage text-on-stage shadow-[0_18px_40px_-24px_rgba(0,0,0,0.6)] outline-none transition-[transform,box-shadow] duration-300 [-webkit-touch-callout:none] focus-within:ring-2 focus-within:ring-accent ${
        isDragging ? "opacity-30" : "hover:-translate-y-1 hover:shadow-[0_30px_60px_-24px_rgba(0,0,0,0.7)]"
      }`}
    >
      <CardBody t={t} base={base} code={code} onRename={onRename} />
      {/* Для клавиатуры и тех, кому неудобно тащить: «выше / ниже». */}
      <div className="flex justify-end gap-1 px-3 pb-3 opacity-60 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 sm:px-4">
        <button type="button" {...stop} disabled={index === 0} onClick={() => move(index, index - 1)} aria-label={`${t.moveUp}: ${code.title}`} title={t.moveUp} className="grid h-8 w-8 place-items-center rounded-lg border border-stage-line text-sm hover:border-on-stage/60 disabled:opacity-30">
          ←
        </button>
        <button type="button" {...stop} disabled={index === count - 1} onClick={() => move(index, index + 1)} aria-label={`${t.moveDown}: ${code.title}`} title={t.moveDown} className="grid h-8 w-8 place-items-center rounded-lg border border-stage-line text-sm hover:border-on-stage/60 disabled:opacity-30">
          →
        </button>
      </div>
    </li>
  );
}

export function MyCodesGrid({ t, base, codes, leading }: { t: Dict; base: string; codes: CodeView[]; leading?: ReactNode }) {
  const [list, setList] = useState(codes);
  const [active, setActive] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");
  const guard = useRef(false);
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    // Телефон: тащим только после долгого нажатия — обычный свайп прокручивает страницу.
    useSensor(TouchSensor, { activationConstraint: { delay: 350, tolerance: 8 } }),
  );

  const commit = (next: CodeView[]) => {
    setList(next);
    saveOrder(next.map((c) => c.id)).then(
      () => setStatus("saved"),
      () => setStatus("error"),
    );
  };
  const move = (from: number, to: number) => {
    if (to < 0 || to >= list.length) return;
    commit(arrayMove(list, from, to));
  };
  const rename = (id: string) => async (title: string) => {
    await saveTitle(id, title);
    setList((l) => l.map((c) => (c.id === id ? { ...c, title } : c)));
  };

  const onStart = (e: DragStartEvent) => {
    setActive(String(e.active.id));
    guard.current = true;
    setStatus("idle");
    if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate?.(15);
  };
  const onEnd = (e: DragEndEvent) => {
    setActive(null);
    setTimeout(() => (guard.current = false), 0);
    const { active: a, over } = e;
    if (!over || a.id === over.id) return;
    const from = list.findIndex((c) => c.id === a.id);
    const to = list.findIndex((c) => c.id === over.id);
    if (from >= 0 && to >= 0) commit(arrayMove(list, from, to));
  };
  const activeCode = active ? list.find((c) => c.id === active) : null;

  return (
    <div>
      <p className="mb-3 flex items-center gap-2 text-xs text-muted" aria-live="polite">
        <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
          <path d="M9 5h.01M15 5h.01M9 12h.01M15 12h.01M9 19h.01M15 19h.01" strokeWidth="3" />
        </svg>
        {status === "saved" ? <span className="font-semibold text-ok">✓ {t.orderSaved}</span> : status === "error" ? <span className="text-warn">{t.saveError}</span> : t.dragHint}
      </p>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={onStart} onDragEnd={onEnd} onDragCancel={() => setActive(null)}>
        <SortableContext items={list.map((c) => c.id)} strategy={rectSortingStrategy}>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4" data-testid="my-codes">
            {leading}
            {list.map((c, i) => (
              <SortableCard key={c.id} t={t} base={base} code={c} index={i} count={list.length} move={move} onRename={rename(c.id)} guard={guard} />
            ))}
          </ul>
        </SortableContext>
        {/* Карточка «в руке»: приподнята, чуть повёрнута, с тенью. */}
        <DragOverlay dropAnimation={{ duration: 180, easing: "cubic-bezier(0.2, 0, 0, 1)" }}>
          {activeCode && (
            <div className="flex scale-[1.04] -rotate-2 cursor-grabbing flex-col overflow-hidden rounded-3xl bg-stage text-on-stage shadow-[0_30px_60px_-16px_rgba(0,0,0,0.55)] ring-2 ring-accent">
              <CardBody t={t} base={base} code={activeCode} onRename={async () => {}} dragging />
            </div>
          )}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
