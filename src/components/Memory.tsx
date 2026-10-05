"use client";
// Память под кодом: записи (текст, фото, видео) и форма «дописать». Одна и та же в настройках и после скана.
import { useRef, useState } from "react";
import { api, MAX_PHOTO_PX, MAX_VIDEO_MB, mediaUrl, type Block, type CodeView } from "@/lib/codes";
import { fmtDateTime } from "@/lib/format";
import type { Dict, Lang } from "@/lib/i18n";
import { prepareImage } from "@/lib/qr/raster";
import { Avatar, personName } from "./Avatar";
import { Tasks } from "./Tasks";
import { Segmented } from "./ui";

type Kind = Block["kind"];

const field = "w-full rounded-xl border border-line bg-field px-3.5 py-2.5 text-base outline-none transition-colors focus:border-accent";

/** Фото уменьшаем в браузере до 1600 px — быстрее грузится и не занимает лишнего места. */
async function shrinkPhoto(file: File): Promise<Blob> {
  const url = await prepareImage(file, { px: MAX_PHOTO_PX, square: false, type: "image/jpeg" });
  return (await fetch(url)).blob();
}

function Composer({ t, code, onChange }: { t: Dict; code: CodeView; onChange: (v: CodeView) => void }) {
  const [kind, setKind] = useState<Kind>("text");
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
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
    try {
      const form = new FormData();
      form.set("text", text);
      if (file && kind === "photo") form.set("file", await shrinkPhoto(file), "photo.jpg");
      if (file && kind === "video") form.set("file", file);
      onChange(await api.addBlock(code.id, form));
      setText("");
      setFile(null);
    } catch {
      setError(t.uploadError);
    } finally {
      setBusy(false);
    }
  };

  const ready = kind === "text" ? !!text.trim() : !!file;
  return (
    <form
      className="space-y-3 rounded-2xl border border-line bg-card p-4 sm:p-5"
      onSubmit={(e) => {
        e.preventDefault();
        if (ready) submit();
      }}
    >
      <Segmented<Kind>
        value={kind}
        onChange={pickKind}
        options={[
          { id: "text", label: t.addText },
          { id: "photo", label: t.addPhoto },
          { id: "video", label: t.addVideo },
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
        {busy ? t.uploading : t.save}
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
                <button type="button" disabled={busy} onClick={() => run(() => api.editBlock(code.id, block.id, editing))} className="min-h-9 rounded-lg px-2.5 font-semibold text-accent">
                  {t.save}
                </button>
                <button type="button" onClick={() => setEditing(null)} className="min-h-9 rounded-lg px-2.5 font-medium hover:text-ink">
                  {t.cancel}
                </button>
              </>
            ) : sure ? (
              <>
                <button type="button" disabled={busy} onClick={() => run(() => api.removeBlock(code.id, block.id))} className="min-h-9 rounded-lg bg-warn px-2.5 font-semibold text-white">
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
