import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { mutate, newId, notify } from "@/server/db";
import { currentPerson } from "@/server/session";
import { PRESETS } from "@/lib/codes";
import { readShort, readText } from "../../validate";

const ANON_COOKIE = "qr-anon";
const HOUR = 60 * 60 * 1000;
/** Против спама: от одного человека — 5 сообщений в час на код, всего на код — 30 в час. */
const PER_SENDER = 5;
const PER_CODE = 30;

// Кто прислал (для лимита): вошедший — по имени, без входа — по случайной метке в cookie. Хозяину не показываем.
const g = globalThis as { __qrSenders?: Map<string, number[]> };
const senders: Map<string, number[]> = (g.__qrSenders ??= new Map());

/** «Связь через нас»: написать владельцу после скана — можно и без входа; номер владельца не раскрывается. */
export async function POST(req: NextRequest, ctx: RouteContext<"/api/codes/[id]/messages">) {
  const { id } = await ctx.params;
  const me = await currentPerson();
  const jar = await cookies();
  let anon = jar.get(ANON_COOKIE)?.value;
  if (!me && !anon) {
    anon = newId(12);
    jar.set(ANON_COOKIE, anon, { path: "/", sameSite: "lax", httpOnly: true, maxAge: 60 * 60 * 24 * 365 });
  }
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const text = readText(body.text).slice(0, 500);
  const reply = readShort(body.reply, 100);

  const now = Date.now();
  const key = `${id}:${me ?? anon}`;
  const recent = (senders.get(key) ?? []).filter((t) => now - t < HOUR);
  if (recent.length >= PER_SENDER) return Response.json({ error: "limit" }, { status: 429 });

  const result = await mutate((db) => {
    const c = db.codes.find((x) => x.id === id);
    if (!c || !c.contact.enabled) return 404;
    if (c.owner === me) return 400;
    const preset = typeof body.preset === "string" && PRESETS[c.kind].includes(body.preset) ? body.preset : null;
    if (!preset && !text) return 400;
    if (c.messages.filter((m) => now - Date.parse(m.at) < HOUR).length >= PER_CODE) return 429;
    c.messages.push({ id: newId(), from: me, preset, text, reply, at: new Date(now).toISOString(), read: false });
    c.messages = c.messages.slice(-200);
    notify(db, c.owner, me, "message", { title: c.title, preset: preset ?? "", text: text.slice(0, 80) }, `/codes/${c.id}`);
    return 200;
  });
  if (result !== 200) return Response.json({ error: result }, { status: result });
  senders.set(key, [...recent, now]);
  return Response.json({ ok: true });
}
