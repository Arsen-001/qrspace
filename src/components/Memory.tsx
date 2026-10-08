"use client";
// Память под кодом: записи (текст, фото, видео) и форма «дописать». Одна и та же в настройках и после скана.
import { useRef, useState } from "react";
import { api, MAX_PHOTO_PX, MAX_VIDEO_MB, mediaUrl, VIDEO_TYPES, type Block, type CodeView } from "@/lib/codes";
import { fmtDateTime } from "@/lib/format";
import type { Dict, Lang } from "@/lib/i18n";
import { prepareImage } from "@/lib/qr/raster";
import { Avatar, personName } from "./Avatar";
import { Tasks } from "./Tasks";
import { Segmented } from "./ui";

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
    multipart: file.size > 8 * 1024 * 1024,
    onUploadProgress: (e) => onProgress(Math.round(e.percentage)),
  });
  return name;
}

function Composer({ t, code, onChange }: { t: Dict; code: CodeView; onChange: (v: CodeView) => void }) {
  const [kind, setKind] = useState<Kind>("text");
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const pickKind = (k: Kind) => {
    setKind(k);
    setFile(null);
    setError(null);
  };

  const submit = async () => {
    setBusy(true);
    setError(null);
    // Пока запись уходила, человек мог начать следующую — очищаем только то, что отправили.
    const sentText = text;
    const sentFile = file;
    try {
      const form = new FormData();
      form.set("text", sentText);
      if (sentFile && kind === "photo") form.set("file", await shrinkPhoto(sentFile), "photo.jpg");
      if (sentFile && kind === "video") {
        if (!VIDEO_TYPES[sentFile.type]) throw new Error("type");
        const uploaded = await uploadVideo(code.id, sentFile, setProgress);
        if (uploaded) form.set("uploaded", uploaded);
        else form.set("file", sentFile);
      }
      onChange(await api.addBlock(code.id, form));
      setText((t) => (t === sentText ? "" : t));
      setFile((f) => (f === sentFile ? null : f));
    } catch {
      setError(t.uploadError);
    } finally {
      setBusy(false);
      setProgress(null);
    }
  };

  const ready = kind === "text" ? !!text.trim() : !!file;
  return (
    <form
      className="space-y-3 rounded-2xl border-2 border-dashed border-line bg-card p-4 sm:p-5"
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
            }}
          />
        </div>
      )}
      <textarea
        value={text}
        rows={kind === "text" ? 4 : 2}
        maxLength={5000}
        placeholder={kind === "text" ? t.textPlaceholder : t.captionPlaceholder}
        onChange={(e) => setText(e.target.value)}
        className={`${field} resize-y`}
      />
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
                <button type="button" onClick={() => setEditing(null)} className="min-h-9 rounded-lg px-2.5 font-medium hover:text-ink">
                  {t.cancel}
                </button>
              </>
            ) : sure ? (
              <>
                <button type="button" disabled={busy} onClick={() => run(() => api.removeBlock(code.id, block.id))} className="min-h-9 rounded-lg bg-warn px-2.5 font-semibold text-on-warn">
                  {t.delete}
                </button>
                <button type="button" onClick={() => setSure(false)} className="min-h-9 rounded-lg px-2.5 font-medium hover:text-ink">
                  {t.cancel}
                </button>
              </>
            ) : (
              <>
                <button type="button" onClick={() => setEditing(block.text)} className="min-h-9 rounded-lg px-2.5 font-medium hover:text-ink">
                  {t.edit}
                </button>
                <button type="button" onClick={() => setSure(true)} className="min-h-9 rounded-lg px-2.5 font-medium hover:text-warn">
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
          <Composer t={t} code={code} onChange={onChange} />
        </>
      )}
    </div>
  );
}
