// Где лежат данные сайта. Без DATABASE_URL — один JSON-файл в .data/ (этот компьютер); с DATABASE_URL — Postgres
// (для выкладки: на хостинге вроде Vercel файлы не сохраняются). Данные — один документ с номером версии:
// сохранить можно, только если с момента чтения его никто не поменял (иначе — перечитать и повторить).
import { promises as fs } from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";

export type Loaded = { data: unknown | null; version: number };
export interface DocStore {
  load(): Promise<Loaded>;
  /** Только номер версии — дёшево: если не поменялся, данные можно не перечитывать. */
  version(): Promise<number>;
  /** false — документ успели поменять (версия не та). */
  save(data: unknown, version: number): Promise<boolean>;
}

function fileStore(file: string): DocStore {
  const readFile = async (): Promise<Loaded> => {
    try {
      const raw = JSON.parse(await fs.readFile(file, "utf8")) as { version?: number; data?: unknown; codes?: unknown };
      // Старый формат — сами данные без обёртки.
      return raw.data !== undefined ? { data: raw.data, version: raw.version ?? 1 } : { data: raw, version: 1 };
    } catch {
      return { data: null, version: 0 };
    }
  };
  return {
    load: readFile,
    // Номер версии у файла — время изменения и размер (читать весь файл ради этого не нужно).
    async version() {
      const st = await fs.stat(file).catch(() => null);
      return st ? Math.floor(st.mtimeMs) * 1e3 + (st.size % 1e3) : 0;
    },
    async save(data, version) {
      if ((await readFile()).version !== version) return false;
      await fs.mkdir(path.dirname(file), { recursive: true });
      const tmp = `${file}.${process.pid}.${randomBytes(4).toString("hex")}.tmp`;
      await fs.writeFile(tmp, JSON.stringify({ version: version + 1, data }));
      await fs.rename(tmp, file);
      return true;
    },
  };
}

function pgStore(url: string): DocStore {
  // pg подключаем только когда он нужен (на этом компьютере без базы модуль не грузится).
  const g = globalThis as { __qrPg?: Promise<import("pg").Pool> };
  const pool = (g.__qrPg ??= import("pg").then(async ({ default: pg }) => {
    const p = new pg.Pool({ connectionString: url, max: 5, ssl: /sslmode=require|neon\.tech|supabase|rlwy\.net/.test(url) ? { rejectUnauthorized: false } : undefined });
    await p.query("create table if not exists qr_doc (id int primary key, version int not null, data jsonb not null, updated_at timestamptz not null default now())");
    return p;
  }));
  return {
    async version() {
      const r = await (await pool).query<{ version: number }>("select version from qr_doc where id = 1");
      return r.rows[0]?.version ?? 0;
    },
    async load() {
      const r = await (await pool).query<{ version: number; data: unknown }>("select version, data from qr_doc where id = 1");
      return r.rows[0] ? { data: r.rows[0].data, version: r.rows[0].version } : { data: null, version: 0 };
    },
    async save(data, version) {
      const p = await pool;
      const json = JSON.stringify(data);
      const r =
        version === 0
          ? await p.query("insert into qr_doc (id, version, data) values (1, 1, $1) on conflict (id) do nothing", [json])
          : await p.query("update qr_doc set data = $1, version = version + 1, updated_at = now() where id = 1 and version = $2", [json, version]);
      return r.rowCount === 1;
    },
  };
}

export const store: DocStore = process.env.DATABASE_URL ? pgStore(process.env.DATABASE_URL) : fileStore(path.join(process.cwd(), ".data", "db.json"));
export const storeKind = process.env.DATABASE_URL ? "postgres" : "file";
