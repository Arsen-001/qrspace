import { LANGS, type Lang } from "@/lib/i18n";
import { findUser, mutate } from "@/server/db";
import { currentPerson } from "@/server/session";

/**
 * Телефон с нашим приложением — для уведомлений (сообщение по коду, просьба доступа, ставка, напоминание). Приложение
 * присылает токен APNs (iOS) или FCM (Android) после входа; при выходе — удаляет. Отправка — когда владелец даст ключи
 * Apple / Firebase. Не больше 10 телефонов на человека: новые вытесняют старые.
 */
async function read(req: Request) {
  const b = (await req.json().catch(() => ({}))) as { token?: unknown; platform?: unknown; lang?: unknown };
  const token = typeof b.token === "string" && /^[A-Za-z0-9:_\-.]{20,4096}$/.test(b.token) ? b.token : null;
  const platform: "ios" | "android" | null = b.platform === "ios" || b.platform === "android" ? b.platform : null;
  const lang = LANGS.find((l) => l.id === b.lang)?.id as Lang | undefined;
  return { token, platform, lang };
}

/** Мои телефоны (без самих токенов — только конец, чтобы приложение узнало себя). */
export async function GET() {
  const me = await currentPerson();
  if (!me) return Response.json({ error: "login" }, { status: 401 });
  const u = await findUser(me);
  return Response.json({ devices: (u?.devices ?? []).map((d) => ({ platform: d.platform, at: d.at, end: d.token.slice(-6) })) });
}

export async function POST(req: Request) {
  const me = await currentPerson();
  if (!me) return Response.json({ error: "login" }, { status: 401 });
  const { token, platform, lang } = await read(req);
  if (!token || !platform) return Response.json({ error: "bad" }, { status: 400 });
  const count = await mutate((db) => {
    // Один телефон — у одного человека: вошёл другой — токен переходит к нему.
    for (const u of db.users) if (u.devices) u.devices = u.devices.filter((d) => d.token !== token);
    const u = db.users.find((x) => x.id === me)!;
    const devices = [...(u.devices ?? []), { token, platform, at: new Date().toISOString(), ...(lang && { lang }) }].slice(-10);
    u.devices = devices;
    return devices.length;
  });
  return Response.json({ ok: true, devices: count });
}

export async function DELETE(req: Request) {
  const me = await currentPerson();
  if (!me) return Response.json({ error: "login" }, { status: 401 });
  const { token } = await read(req);
  if (!token) return Response.json({ error: "bad" }, { status: 400 });
  await mutate((db) => {
    const u = db.users.find((x) => x.id === me)!;
    u.devices = (u.devices ?? []).filter((d) => d.token !== token);
  });
  return Response.json({ ok: true });
}
