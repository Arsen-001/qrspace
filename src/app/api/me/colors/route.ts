import { mutate } from "@/server/db";
import { currentPerson } from "@/server/session";

const hex = (v: unknown) => (typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v) ? v.toLowerCase() : null);

/** Последние цвета человека (владелец 08.10.2026): после скачивания — первыми в «Тонкой настройке» и по умолчанию. */
export async function POST(req: Request) {
  const me = await currentPerson();
  if (!me) return Response.json({ error: "login" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const fg = hex(body.fg);
  const bg = hex(body.bg);
  if (!fg || !bg) return Response.json({ error: "bad" }, { status: 400 });
  const colors = await mutate((db) => {
    const user = db.users.find((u) => u.id === me);
    if (!user) return null;
    user.recentColors = [{ fg, bg }, ...(user.recentColors ?? []).filter((c) => c.fg !== fg || c.bg !== bg)].slice(0, 8);
    return user.recentColors;
  });
  if (!colors) return Response.json({ error: "not found" }, { status: 404 });
  return Response.json({ colors });
}
