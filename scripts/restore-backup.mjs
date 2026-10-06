// Восстановить данные сайта из ежедневной копии (src/server/backup.ts).
//   1. Скачать копию: vercel blob get backups/db-ГГГГ-ММ-ДД.json.gz (в папке проекта, с доступом к хранилищу).
//   2. DATABASE_URL="<адрес базы>" node scripts/restore-backup.mjs db-ГГГГ-ММ-ДД.json.gz
// Без DATABASE_URL — пишет в .data/db.json этого компьютера. Текущие данные заменяются целиком.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { gunzipSync } from "node:zlib";

const file = process.argv[2];
if (!file) throw new Error("укажите файл копии: node scripts/restore-backup.mjs db-ГГГГ-ММ-ДД.json.gz");
const { at, data } = JSON.parse(gunzipSync(readFileSync(file)).toString("utf8"));
if (!data) throw new Error("в файле нет данных");
const url = process.env.DATABASE_URL;
if (url) {
  const { default: pg } = await import("pg");
  const db = new pg.Client({ connectionString: url, ssl: /sslmode=require|neon\.tech|supabase|rlwy\.net/.test(url) ? { rejectUnauthorized: false } : undefined });
  await db.connect();
  await db.query("create table if not exists qr_doc (id int primary key, version int not null, data jsonb not null, updated_at timestamptz not null default now())");
  // Номер версии растёт — серверы сайта увидят, что данные поменялись, и перечитают их.
  await db.query(
    "insert into qr_doc (id, version, data) values (1, 1, $1) on conflict (id) do update set data = excluded.data, version = qr_doc.version + 1, updated_at = now()",
    [JSON.stringify(data)],
  );
  await db.end();
} else {
  mkdirSync(".data", { recursive: true });
  writeFileSync(".data/db.json", JSON.stringify({ version: Date.now(), data }));
}
console.log(`восстановлено из копии от ${at}${url ? " в базу" : " в .data/db.json"}`);
