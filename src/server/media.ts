// Где лежат фото и видео под кодами. Сейчас — папка .data/media на этом компьютере. При выкладке сюда
// добавится хранилище файлов (например, Vercel Blob) — остальной код не меняется: он знает только put/open/remove.
import { createReadStream, promises as fs } from "node:fs";
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

export const media: MediaStore = local;
