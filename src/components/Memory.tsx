"use client";
// Память под кодом: записи (текст, фото, видео) и форма «дописать». Одна и та же в настройках и после скана.
import { useEffect, useRef, useState } from "react";
import { api, buyStorage, fmtBytes, MAX_PHOTO_PX, MAX_VIDEO_MB, FREE_STORAGE, mediaUrl, planFor, STORAGE_PLANS, VIDEO_TYPES, type Block, type CodeView } from "@/lib/codes";
import { fmtDateTime } from "@/lib/format";
import { fill, type Dict, type Lang } from "@/lib/i18n";
import { prepareImage } from "@/lib/qr/raster";
import { Avatar, personName } from "./Avatar";
import { Tasks } from "./Tasks";
import { Info, Segmented } from "./ui";

function KindLabel({ d, text }: { d: string; text: string }) {
  return (
    <span className="inline-flex items-center justify-center gap-2">
      <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d={d} />
      </svg>
      {text}
    </span>
  );
}

type Kind = Block["kind"];

const field = "w-full rounded-xl border border-line bg-field px-3.5 py-2.5 text-base outline-none transition-colors focus:border-accent";

/** Фото уменьшаем в браузере до 1600 px — быстрее грузится и не занимает лишнего места. */
async function shrinkPhoto(file: File): Promise<Blob> {
  const url = await prepareImage(file, { px: MAX_PHOTO_PX, square: false, type: "image/jpeg" });
  return (await fetch(url)).blob();
}

/** Видео на выкладке грузим прямо в хранилище (сервер Vercel не принимает больше 4,5 МБ); имя файла — в форму. */
async function uploadVideo(codeId: string, file: File, onProgress: (pct: number) => void): Promise<string | null> {
  const { direct } = (await fetch(`/api/codes/${codeId}/upload`).then((r) => r.json())) as { direct: boolean };
  if (!direct) return null;
  const abc = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const rand = Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) => abc[b % abc.length]).join("");
  const name = `${codeId}_${rand}.${VIDEO_TYPES[file.type]}`;
  const { upload } = await import("@vercel/blob/client");
  await upload(name, file, {
    access: "private",
    handleUploadUrl: `/api/codes/${codeId}/upload`,
    contentType: file.type,
    // Сервер разрешит загрузить ровно столько байт и только если они влезают в место под кодом.
    clientPayload: JSON.stringify({ size: file.size }),
    multipart: file.size > 8 * 1024 * 1024,
    onUploadProgress: (e) => onProgress(Math.round(e.percentage)),
  });
  return name;
}

/**
 * Не влезает в место под кодом (владелец 09.10.2026: «скидывают большое — смотрим, сколько мегабайт, показываем цену, он
 * платит, потом позволяем загрузить»): размер файла, сколько свободно, какое место нужно и сколько стоит. Платит хозяин —
 * сразу после оплаты файл загружается. Цена — за то место, которое нужно этому файлу; сервер всё равно меряет сам.
 */
function RoomOffer({ t, lang, code, need, busy, onPay, onCancel }: { t: Dict; lang: Lang; code: CodeView; need: number; busy: boolean; onPay: (plan: string) => void; onCancel: () => void }) {
  const st = code.storage!;
  const plan = planFor(st.used + need);
  const owner = code.access === "owner";
  return (
    <div role="alert" className="space-y-3 rounded-2xl bg-stage p-4 text-on-stage sm:p-5">
      <div className="font-heading text-base font-bold">{t.upTooBigTitle}</div>
      <div className="font-mono text-xs text-on-stage/70">
        {fill(t.upSizes, { file: fmtBytes(need, lang), free: fmtBytes(Math.max(0, st.quota - st.used), lang), quota: fmtBytes(st.quota, lang) })}
      </div>
      {!plan ? (
        <p className="text-sm text-on-stage/80">{fill(t.upMax, { max: fmtBytes(STORAGE_PLANS[STORAGE_PLANS.length - 1].bytes, lang) })}</p>
      ) : !owner ? (
        <p className="text-sm text-on-stage/80">{t.upOwnerOnly}</p>
      ) : (
        <>
          <p className="text-sm">
            {fill(t.upNeed, { size: fmtBytes(plan.bytes, lang), price: plan.price })} <span className="text-on-stage/60">{t.buyDemo}</span>
          </p>
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={busy} onClick={() => onPay(plan.id)} className="min-h-11 rounded-xl bg-accent px-5 font-heading text-sm font-bold text-on-accent disabled:opacity-50">
              {fill(t.upPay, { price: plan.price })}
            </button>
            <button type="button" onClick={onCancel} className="min-h-11 rounded-xl px-4 text-sm font-medium text-on-stage/70 hover:text-on-stage">
              {t.cancel}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function Composer({ t, lang, code, onChange }: { t: Dict; lang: Lang; code: CodeView; onChange: (v: CodeView) => void }) {
  const [kind, setKind] = useState<Kind>("text");
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** Сколько байт нужно этой записи, если она не влезает в место под кодом. */
  const [offer, setOffer] = useState<number | null>(null);
  const input = useRef<HTMLInputElement>(null);
  // Телефон (10.10.2026): форма — в самом низу, после всех записей; пока её не видно — круглая «+» поверх страницы.
  const box = useRef<HTMLFormElement>(null);
  const area = useRef<HTMLTextAreaElement>(null);
  const [seen, setSeen] = useState(true);
  useEffect(() => {
    const el = box.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => setSeen(e.isIntersecting || e.boundingClientRect.top < 0));
    io.observe(el);
    return () => io.disconnect();
  }, []);
  const fits = (c: CodeView, need: number) => !c.storage || c.storage.used + need <= c.storage.quota;

  const pickKind = (k: Kind) => {
    setKind(k);
    setFile(null);
    setError(null);
    setOffer(null);
  };

  /** current — код после оплаты места (новое место), иначе — как сейчас. */
  const submit = async (current: CodeView = code) => {
    setBusy(true);
    setError(null);
    // Пока запись уходила, человек мог начать следующую — очищаем только то, что отправили.
    const sentText = text;
    const sentFile = file;
    try {
      const form = new FormData();
      form.set("text", sentText);
      const photo = sentFile && kind === "photo" ? await shrinkPhoto(sentFile) : null;
      if (sentFile && kind === "video" && !VIDEO_TYPES[sentFile.type]) throw new Error("type");
      // Сначала — сколько места нужно и влезает ли; не влезает — показываем цену, файл не грузим.
      const need = (photo?.size ?? (sentFile && kind === "video" ? sentFile.size : 0)) + new Blob([sentText]).size;
      if (!fits(current, need)) {
        setOffer(need);
        return;
      }
      setOffer(null);
      if (photo) form.set("file", photo, "photo.jpg");
      if (sentFile && kind === "video") {
        const uploaded = await uploadVideo(code.id, sentFile, setProgress);
        if (uploaded) form.set("uploaded", uploaded);
        else form.set("file", sentFile);
      }
      onChange(await api.addBlock(code.id, form));
      setText((t) => (t === sentText ? "" : t));
      setFile((f) => (f === sentFile ? null : f));
    } catch (e) {
      setError((e as Error).message === "413" ? t.storageFull : t.uploadError);
    } finally {
      setBusy(false);
      setProgress(null);
    }
  };
  // Оплатили место — сразу загружаем.
  const payAndUpload = async (plan: string) => {
    setBusy(true);
    try {
      const next = await buyStorage(code.id, plan);
      onChange(next);
      await submit(next);
    } catch {
      setError(t.uploadError);
      setBusy(false);
    }
  };

  const ready = kind === "text" ? !!text.trim() : !!file;
  return (
    <form
      ref={box}
      className="scroll-mb-28 space-y-3 rounded-2xl border-2 border-dashed border-line bg-card p-4 sm:p-5"
      onSubmit={(e) => {
        e.preventDefault();
        if (ready) submit();
      }}
    >
      <h3 className="flex items-center gap-2.5 font-heading text-base font-bold">
        <span aria-hidden className="grid h-7 w-7 place-items-center rounded-lg bg-accent text-on-accent">+</span>
        {t.composerTitle}
      </h3>
      <Segmented<Kind>
        value={kind}
        onChange={pickKind}
        options={[
          { id: "text", label: <KindLabel d="M5 6h14M5 10h14M5 14h9M5 18h6" text={t.addText} /> },
          { id: "photo", label: <KindLabel d="M4 7h3l2-2.5h6L17 7h3v12H4zM12 16.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" text={t.addPhoto} /> },
          { id: "video", label: <KindLabel d="M3 6.5h12v11H3zM15 10.5l6-3.5v10l-6-3.5" text={t.addVideo} /> },
        ]}
      />
      {kind !== "text" && (
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={() => input.current?.click()} className="min-h-11 rounded-xl border border-line bg-field px-4 text-sm font-medium hover:border-muted">
            {file ? t.replace : t.upload}
          </button>
          <span className="min-w-0 truncate text-sm text-muted">{file ? file.name : kind === "video" ? t.videoLimit : ""}</span>
          <input
            ref={input}
            type="file"
            accept={kind === "photo" ? "image/*" : "video/mp4,video/quicktime,video/webm"}
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0] ?? null;
              e.target.value = "";
              if (f && kind === "video" && f.size > MAX_VIDEO_MB * 1024 * 1024) {
                setError(t.videoTooBig);
                return;
              }
              setError(null);
              setFile(f);
              // Видео: размер известен сразу — не влезает, цену места показываем ещё до «Сохранить».
              const need = f && kind === "video" ? f.size + new Blob([text]).size : 0;
              setOffer(f && kind === "video" && !fits(code, need) ? need : null);
            }}
          />
        </div>
      )}
      {!seen && (
        <button
          type="button"
          aria-label={t.composerTitle}
          onClick={() => {
            // Фокус — сразу в нажатии, иначе iPhone не откроет клавиатуру.
            area.current?.focus({ preventScroll: true });
            box.current?.scrollIntoView({ behavior: "smooth", block: "center" });
          }}
          className="x-fab fixed right-4 z-30 grid h-14 w-14 place-items-center rounded-2xl bg-accent text-on-accent shadow-[0_14px_30px_-10px_rgba(0,0,0,0.55)] sm:hidden"
        >
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden>
            <path d="M12 5v14M5 12h14" />
          </svg>
        </button>
      )}
      <textarea
        ref={area}
        value={text}
        rows={kind === "text" ? 4 : 2}
        maxLength={5000}
        placeholder={kind === "text" ? t.textPlaceholder : t.captionPlaceholder}
        onChange={(e) => setText(e.target.value)}
        className={`${field} resize-y`}
      />
      {offer !== null && <RoomOffer t={t} lang={lang} code={code} need={offer} busy={busy} onPay={payAndUpload} onCancel={() => setOffer(null)} />}
      {error && <p className="text-sm text-warn">{error}</p>}
      <button type="submit" disabled={!ready || busy} className="min-h-11 rounded-xl bg-accent px-5 text-sm font-semibold text-on-accent disabled:opacity-40">
        {busy ? (progress !== null && progress < 100 ? `${t.uploading} ${progress}%` : t.uploading) : t.save}
      </button>
    </form>
  );
}

function Entry({ t, lang, code, block, me, onChange }: { t: Dict; lang: Lang; code: CodeView; block: Block; me: string | null; onChange: (v: CodeView) => void }) {
  const [editing, setEditing] = useState<string | null>(null);
  const [sure, setSure] = useState(false);
  const [busy, setBusy] = useState(false);
  const canChange = code.access === "owner" || (code.access === "edit" && block.author === me);

  const run = async (fn: () => Promise<CodeView>) => {
    setBusy(true);
    try {
      onChange(await fn());
      setEditing(null);
    } catch {
      setSure(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <li className="rounded-2xl border border-line bg-card p-4 sm:p-5">
      {block.kind === "photo" && block.media && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={mediaUrl(block.media)} alt={block.text} loading="lazy" className="mb-3 max-h-[70vh] w-full rounded-xl bg-field object-contain" />
      )}
      {block.kind === "video" && block.media && <video src={mediaUrl(block.media)} controls playsInline preload="metadata" className="mb-3 max-h-[70vh] w-full rounded-xl bg-black" />}
      {editing !== null ? (
        <textarea value={editing} rows={4} maxLength={5000} onChange={(e) => setEditing(e.target.value)} className={`${field} resize-y`} />
      ) : (
        block.text && <p className="whitespace-pre-wrap break-words">{block.text}</p>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-muted">
        <span className="flex items-center gap-1.5">
          {block.author ? (
            <>
              <Avatar id={block.author} lang={lang} size={20} />
              {block.author === me ? t.you : personName(block.author, lang)} · {fmtDateTime(block.at, lang)}
            </>
          ) : (
            fmtDateTime(block.at, lang)
          )}
        </span>
        {canChange && (
          <span className="ml-auto flex gap-1">
            {editing !== null ? (
              <>
                <button type="button" disabled={busy} onClick={() => run(() => api.editBlock(code.id, block.id, editing))} className="min-h-9 rounded-lg px-2.5 font-semibold text-accent-ink">
                  {t.save}
                </button>
                <button type="button" onClick={() => setEditing(null)} className="min-h-11 rounded-lg px-2.5 font-medium sm:min-h-9 hover:text-ink">
                  {t.cancel}
                </button>
              </>
            ) : sure ? (
              <>
                <button type="button" disabled={busy} onClick={() => run(() => api.removeBlock(code.id, block.id))} className="min-h-9 rounded-lg bg-warn px-2.5 font-semibold text-on-warn">
                  {t.delete}
                </button>
                <button type="button" onClick={() => setSure(false)} className="min-h-11 rounded-lg px-2.5 font-medium sm:min-h-9 hover:text-ink">
                  {t.cancel}
                </button>
              </>
            ) : (
              <>
                <button type="button" onClick={() => setEditing(block.text)} className="min-h-11 rounded-lg px-2.5 font-medium sm:min-h-9 hover:text-ink">
                  {t.edit}
                </button>
                <button type="button" onClick={() => setSure(true)} className="min-h-11 rounded-lg px-2.5 font-medium sm:min-h-9 hover:text-warn">
                  {t.delete}
                </button>
              </>
            )}
          </span>
        )}
      </div>
    </li>
  );
}

/** Место под кодом (владелец 08.10.2026): шкала «занято из всего» и пакеты побольше (хозяину). */
function StorageBar({ t, lang, code, onChange }: { t: Dict; lang: Lang; code: CodeView; onChange: (v: CodeView) => void }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const st = code.storage;
  if (!st) return null;
  const k = Math.min(1, st.used / st.quota);
  // Место помесячно (владелец 09.10.2026): выбрать больше или меньше, тот же пакет — продлить; «Бесплатно» — 1 МБ.
  const change = async (plan: string) => {
    setBusy(true);
    try {
      onChange(await buyStorage(code.id, plan));
      setOpen(false);
    } finally {
      setBusy(false);
    }
  };
  const until = st.until ? new Date(st.until).toLocaleDateString(lang, { day: "numeric", month: "short" }) : null;
  const options = [{ id: "free", bytes: FREE_STORAGE, price: 0 }, ...STORAGE_PLANS];
  return (
    <section className="rounded-2xl border border-line bg-card p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm font-semibold">
            {t.storageTitle}
            <Info text={t.infoStorage} label={t.storageTitle} />
          </div>
          <div className="font-mono text-xs text-muted">
            {fmtBytes(st.used, lang)} / {fmtBytes(st.quota, lang)}
            {until && ` · ${t.storagePaidUntil} ${until}`}
          </div>
        </div>
        {code.access === "owner" && (
          <button type="button" aria-expanded={open} onClick={() => setOpen((v) => !v)} className="min-h-10 shrink-0 rounded-xl bg-stage px-3.5 font-heading text-sm font-bold text-on-stage">
            {t.storageChange}
          </button>
        )}
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-line">
        <div className={`h-full rounded-full ${k > 0.9 ? "bg-warn" : "bg-accent"}`} style={{ width: `${Math.max(2, k * 100)}%` }} />
      </div>
      {open && (
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {options.map((p) => {
            const now = (st.plan ?? "free") === p.id;
            const small = st.used > p.bytes;
            return (
              <button
                key={p.id}
                type="button"
                disabled={busy || small || (now && p.id === "free")}
                onClick={() => change(p.id)}
                aria-label={`${fmtBytes(p.bytes, lang)} — ${p.price ? `$${p.price} / ${t.storageMonth}` : t.storageFreeName}${now ? ` (${t.storageNow})` : ""}`}
                className={`relative flex flex-col items-start gap-1 rounded-xl border px-3.5 py-3 text-left transition-colors disabled:cursor-not-allowed ${
                  now ? "border-accent bg-stage text-on-stage" : "border-line bg-field hover:border-muted disabled:opacity-45"
                }`}
              >
                {now && <span className="absolute right-2.5 top-2.5 rounded-full bg-accent px-2 py-0.5 text-[11px] font-bold uppercase text-on-accent">{t.storageNow}</span>}
                <span className="font-heading text-lg font-extrabold">{fmtBytes(p.bytes, lang)}</span>
                <span className={`font-mono text-xs ${now ? "text-accent" : "text-muted"}`}>{p.price ? `$${p.price} / ${t.storageMonth}` : t.storageFreeName}</span>
                {now && p.id !== "free" && <span className="mt-1 text-xs font-semibold underline underline-offset-2">{t.storageRenew}</span>}
                {small && <span className="mt-1 text-[11px] text-muted">{t.storageTooSmall}</span>}
              </button>
            );
          })}
          <p className="text-xs leading-relaxed text-muted sm:col-span-2 lg:col-span-4">
            {t.storageMonthly} {t.buyDemo}
          </p>
        </div>
      )}
    </section>
  );
}

export function Memory({ t, lang, code, me, onChange }: { t: Dict; lang: Lang; code: CodeView; me: string | null; onChange: (v: CodeView) => void }) {
  const blocks = code.blocks ?? [];
  const canAdd = code.access === "owner" || code.access === "edit";
  return (
    <div className="space-y-3">
      <Tasks t={t} lang={lang} me={me} code={code} onChange={onChange} />
      {blocks.length === 0 && !canAdd && <p className="rounded-2xl border border-line bg-card p-6 text-center text-sm text-muted">{t.memoryEmpty}</p>}
      {blocks.length > 0 && (
        <ul className="space-y-3">
          {blocks.map((b) => (
            <Entry key={b.id} t={t} lang={lang} code={code} block={b} me={me} onChange={onChange} />
          ))}
        </ul>
      )}
      {canAdd && (
        <>
          {blocks.length === 0 && <p className="text-sm text-muted">{t.memoryEmpty}</p>}
          <StorageBar t={t} lang={lang} code={code} onChange={onChange} />
          <Composer t={t} lang={lang} code={code} onChange={onChange} />
        </>
      )}
    </div>
  );
}
