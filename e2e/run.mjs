// Все проверки в браузере по очереди. Нужен запущенный дев-сервер: npm run dev -- -p 3720.
// ВНИМАНИЕ: перед каждой проверкой демо-данные (.data) стираются — сайт заполнит их заново.
// Запуск: npm run e2e            — всё
//         npm run e2e -- tags pay — только эти
import { spawnSync } from "node:child_process";
import { generateKeyPairSync } from "node:crypto";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { startChain } from "./chain.mjs";

const root = path.resolve(import.meta.dirname, "..");
const ALL = ["flow", "order", "video", "redirect", "tags", "look", "market", "designer", "tasks", "pay", "print", "resale", "cert", "live", "security", "a11y", "starters", "verify", "links", "moderation", "admin", "legal", "langs", "packs", "account", "room", "appapi", "scan", "create", "inputs", "lookread", "typing", "camera", "nft", "shapes", "mobile"];
// Вход через Google проверяем с подставным сервером Google (только на этом компьютере).
const WITH_GOOGLE = ["google", "notify", "batch1", "push", "iap", "review"];
const ENV = "GOOGLE_CLIENT_ID=test-client.apps.googleusercontent.com\nGOOGLE_CLIENT_SECRET=test-secret\nOAUTH_TEST_TOKEN_URL=http://127.0.0.1:3729/token\nDESIGNER_EMAILS=studio.designer@gmail.com\n";
// Вход проверяющих магазинов (e2e/review.mjs).
const REVIEW_ENV = "REVIEW_LOGIN=appreview\nREVIEW_LOGIN_CODE=test-review-code-01\n";
// Уведомления на телефон: тестовые ключи Apple и Firebase (каждый запуск — новые) и подставные серверы (e2e/push.mjs).
const pemLine = (k) => k.export({ type: "pkcs8", format: "pem" }).trim().replace(/\n/g, "\\n");
const apnsKey = generateKeyPairSync("ec", { namedCurve: "P-256" }).privateKey;
const fcmKey = generateKeyPairSync("rsa", { modulusLength: 2048 }).privateKey;
const fcmAccount = { client_email: "push@qrspace-test.iam.gserviceaccount.com", private_key: fcmKey.export({ type: "pkcs8", format: "pem" }), project_id: "qrspace-test", token_uri: "http://127.0.0.1:3731/token" };
const PUSH_ENV = `APNS_KEY_ID=TESTKEY001\nAPNS_TEAM_ID=TESTTEAM01\nAPNS_PRIVATE_KEY="${pemLine(apnsKey)}"\nAPNS_TEST_URL=http://127.0.0.1:3730\nFCM_SERVICE_ACCOUNT='${JSON.stringify(fcmAccount)}'\nFCM_TEST_URL=http://127.0.0.1:3731\nFCM_TEST_TOKEN_URL=http://127.0.0.1:3731/token\n` +
  // Встроенная оплата (e2e/iap.mjs): покупки «из Xcode» и подставной Google Play (3732).
  `IAP_ALLOW_XCODE=1\nGOOGLE_PLAY_SERVICE_ACCOUNT='${JSON.stringify({ ...fcmAccount, token_uri: "http://127.0.0.1:3732/token" })}'\nGOOGLE_PLAY_TEST_URL=http://127.0.0.1:3732\nGOOGLE_PLAY_TEST_TOKEN_URL=http://127.0.0.1:3732/token\n`;
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
  // NFT: учебный блокчейн и свежий контракт (e2e/chain.mjs).
  const chain = s === "nft" ? await startChain() : null;
  if (google || chain) {
    writeFileSync(path.join(root, ".env.local"), (google ? ENV + PUSH_ENV + REVIEW_ENV : "") + (chain?.env ?? ""));
    await sleep(8000); // сервер перечитывает .env.local и перезапускается
  }
  const r = spawnSync("node", [path.join(import.meta.dirname, `${s}.mjs`)], { encoding: "utf8", timeout: 600_000 });
  const outText = (r.stdout ?? "") + (r.stderr ?? "");
  const bad = r.status !== 0 || /✗|OVERFLOW|errors: \[/.test(outText);
  console.log(`${bad ? "✗" : "✓"} ${s}`);
  if (bad) {
    failed.push(s);
    console.log(outText.split("\n").filter((l) => /✗|OVERFLOW|errors|Error|waiting for/.test(l)).slice(0, 6).join("\n"));
  }
  // Удалённый .env.local сервер не замечает (тестовые ключи остались бы до перезапуска) — пустой файл сбрасывает их.
  chain?.stop();
  const next = suites[suites.indexOf(s) + 1];
  if ((google && !WITH_GOOGLE.includes(next)) || chain) {
    writeFileSync(path.join(root, ".env.local"), "");
    await sleep(8000);
    rmSync(path.join(root, ".env.local"), { force: true });
  }
}
reset();
console.log(failed.length ? `\nНе прошли: ${failed.join(", ")}` : `\nПройдено: ${suites.length} из ${suites.length}`);
process.exit(failed.length ? 1 : 0);
