// Ежедневная копия всех данных сайта (раз в сутки, Vercel Cron → /api/cron/backup). Данные — один документ, поэтому
// копия — он же, сжатый: backups/db-ГГГГ-ММ-ДД.json.gz. С BLOB_READ_WRITE_TOKEN — в закрытый Vercel Blob (раздаётся
// только нашим сервером, а маршруты фото и картинок такие имена не отдают), без него — в .data/backups. Храним 14 дней.
// Восстановить: scripts/restore-backup.mjs.
import { promises as fs } from "node:fs";
import path from "node:path";
import { gzipSync } from "node:zlib";
import { del, list, put } from "@vercel/blob";
import { store } from "./store";

const KEEP = 14;
const PREFIX = "backups/db-";
const DIR = path.join(process.cwd(), ".data", "backups");

export async function backupNow(now = new Date()): Promise<{ name: string; bytes: number; removed: string[] }> {
  const { data, version } = await store.load();
  if (data === null) throw new Error("no data");
  const name = `${PREFIX}${now.toISOString().slice(0, 10)}.json.gz`;
  const body = gzipSync(JSON.stringify({ version, at: now.toISOString(), data }));
  // Старше KEEP дней — удаляем (имя с датой, так что сравниваем строки).
  const cutoff = `${PREFIX}${new Date(now.getTime() - KEEP * 86_400_000).toISOString().slice(0, 10)}`;
  let removed: string[];
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    await put(name, body, { access: "private", contentType: "application/gzip", addRandomSuffix: false, allowOverwrite: true });
    const { blobs } = await list({ prefix: PREFIX });
    removed = blobs.map((b) => b.pathname).filter((p) => p < cutoff);
    if (removed.length) await del(removed);
  } else {
    await fs.mkdir(DIR, { recursive: true });
    await fs.writeFile(path.join(DIR, path.basename(name)), body);
    removed = (await fs.readdir(DIR)).map((f) => `backups/${f}`).filter((p) => p.startsWith(PREFIX) && p < cutoff);
    await Promise.all(removed.map((p) => fs.rm(path.join(DIR, path.basename(p)), { force: true })));
  }
  return { name, bytes: body.length, removed };
}
