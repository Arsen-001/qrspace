// Все проверки в браузере по очереди. Нужен запущенный дев-сервер: npm run dev -- -p 3720.
// ВНИМАНИЕ: перед каждой проверкой демо-данные (.data) стираются — сайт заполнит их заново.
// Запуск: npm run e2e            — всё
//         npm run e2e -- tags pay — только эти
import { spawnSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const ALL = ["flow", "order", "video", "redirect", "tags", "look", "market", "designer", "tasks", "pay", "print", "resale", "cert", "live", "security", "a11y", "starters", "verify", "numbers", "links", "moderation", "legal", "langs", "packs"];
// Вход через Google проверяем с подставным сервером Google (только на этом компьютере).
const WITH_GOOGLE = ["google", "notify", "batch1"];
const ENV = "GOOGLE_CLIENT_ID=test-client.apps.googleusercontent.com\nGOOGLE_CLIENT_SECRET=test-secret\nOAUTH_TEST_TOKEN_URL=http://127.0.0.1:3729/token\nDESIGNER_EMAILS=studio.designer@gmail.com\n";
const pick = process.argv.slice(2);
const suites = pick.length ? pick : [...ALL, ...WITH_GOOGLE];

mkdirSync(path.join(import.meta.dirname, "out"), { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const failed = [];
// С базой (DATABASE_URL — тот же, с каким запущен сервер) стираем и её.
const reset = () => {
  rmSync(path.join(root, ".data"), { recursive: true, force: true });
  if (process.env.DATABASE_URL) spawnSync("psql", [process.env.DATABASE_URL, "-qc", "delete from qr_doc"], { stdio: "ignore" });
};
for (const s of suites) {
  reset();
  const google = WITH_GOOGLE.includes(s);
  if (google) {
    writeFileSync(path.join(root, ".env.local"), ENV);
    await sleep(3000); // сервер перечитывает .env.local
  }
  const r = spawnSync("node", [path.join(import.meta.dirname, `${s}.mjs`)], { encoding: "utf8", timeout: 600_000 });
  const outText = (r.stdout ?? "") + (r.stderr ?? "");
  const bad = r.status !== 0 || /✗|OVERFLOW|errors: \[/.test(outText);
  console.log(`${bad ? "✗" : "✓"} ${s}`);
  if (bad) {
    failed.push(s);
    console.log(outText.split("\n").filter((l) => /✗|OVERFLOW|errors|Error|waiting for/.test(l)).slice(0, 6).join("\n"));
  }
  if (google) rmSync(path.join(root, ".env.local"), { force: true });
}
reset();
console.log(failed.length ? `\nНе прошли: ${failed.join(", ")}` : `\nПройдено: ${suites.length} из ${suites.length}`);
process.exit(failed.length ? 1 : 0);
