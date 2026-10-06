// Где лежат фото и видео под кодами. С BLOB_READ_WRITE_TOKEN (выкладка на Vercel) — закрытое хранилище Vercel Blob,
// без него — папка .data/media на этом компьютере. Остальной код знает только put/open/remove.
import { createReadStream, promises as fs } from "node:fs";
import { del, get, head, put } from "@vercel/blob";
import path from "node:path";
import { Readable } from "node:stream";

export interface MediaStore {
  put(name: string, data: Buffer, type: string): Promise<void>;
  remove(name: string): Promise<void>;
  /** Файл целиком или кусок (Range — без него iPhone не играет видео). null — файла нет. */
  open(name: string, range?: { start: number; end?: number }): Promise<{ size: number; start: number; end: number; body: ReadableStream } | null>;
}

const DIR = path.join(process.cwd(), ".data", "media");

const local: MediaStore = {
  async put(name, data) {
    await fs.mkdir(DIR, { recursive: true });
    await fs.writeFile(path.join(DIR, name), data);
  },
  async remove(name) {
    await fs.rm(path.join(DIR, name), { force: true });
  },
  async open(name, range) {
    const file = path.join(DIR, name);
    const size = (await fs.stat(file).catch(() => null))?.size;
    if (size === undefined) return null;
    const start = range?.start ?? 0;
    const end = Math.min(range?.end ?? size - 1, size - 1);
    if (start > end) return { size, start, end, body: new ReadableStream() };
    return { size, start, end, body: Readable.toWeb(createReadStream(file, { start, end })) as ReadableStream };
  },
};

// Файлы закрытые: отдаём только через наш сервер, который сначала проверяет, кому их можно видеть.
const blob: MediaStore = {
  async put(name, data, type) {
    await put(name, data, { access: "private", contentType: type, addRandomSuffix: false, allowOverwrite: true });
  },
  async remove(name) {
    await del(name).catch(() => {});
  },
  async open(name, range) {
    const headers = range ? { Range: `bytes=${range.start}-${range.end ?? ""}` } : undefined;
    const r = await get(name, { access: "private", headers }).catch(() => undefined);
    if (r === undefined) {
      // 416: кусок за концом файла (или файл пустой) — как и у папки, отдаём пустое тело.
      const size = (await head(name).catch(() => null))?.size;
      return size === undefined ? null : { size, start: range?.start ?? 0, end: (range?.start ?? 0) - 1, body: new ReadableStream() };
    }
    if (!r || !r.stream) return null;
    const total = /\/(\d+)$/.exec(r.headers.get("content-range") ?? "")?.[1];
    const size = total ? Number(total) : r.blob.size;
    const start = total ? (range?.start ?? 0) : 0;
    const end = start + Number(r.headers.get("content-length") ?? size - start) - 1;
    return { size, start, end, body: r.stream };
  },
};

export const media: MediaStore = process.env.BLOB_READ_WRITE_TOKEN ? blob : local;
