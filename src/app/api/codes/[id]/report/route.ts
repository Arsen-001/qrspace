import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { mutate, newId } from "@/server/db";
import { currentPerson } from "@/server/session";
import { REPORT_REASONS, type ReportReason } from "@/lib/codes";
import { readText } from "../../validate";

const HOUR = 60 * 60 * 1000;
const g = globalThis as { __qrReports?: Map<string, number[]> };
const recent: Map<string, number[]> = (g.__qrReports ??= new Map());

/** «Пожаловаться»: мошенничество, спам, оскорбления. Можно без входа; от одного человека — 3 жалобы в час. */
export async function POST(req: NextRequest, ctx: RouteContext<"/api/codes/[id]/report">) {
  const { id } = await ctx.params;
  const me = await currentPerson();
  // Лимит — на человека: вошедший — по id, гость — по своей метке в cookie (ставим, если её ещё нет).
  const jar = await cookies();
  let anon = jar.get("qr-anon")?.value;
  if (!me && !anon) {
    anon = newId(12);
    jar.set("qr-anon", anon, { path: "/", sameSite: "lax", httpOnly: true, maxAge: 60 * 60 * 24 * 365 });
  }
  const key = me ?? `anon:${anon}`;
  const now = Date.now();
  const mine = (recent.get(key) ?? []).filter((t) => now - t < HOUR);
  if (mine.length >= 3) return Response.json({ error: "limit" }, { status: 429 });
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const reason = (REPORT_REASONS as readonly unknown[]).includes(b.reason) ? (b.reason as ReportReason) : null;
  if (!reason) return Response.json({ error: "bad" }, { status: 400 });
  const ok = await mutate((db) => {
    if (!db.codes.some((c) => c.id === id)) return false;
    db.reports.push({ id: newId(), code: id, reason, text: readText(b.text).slice(0, 1000), from: me, at: new Date(now).toISOString(), status: "open" });
    db.reports = db.reports.slice(-5000);
    return true;
  });
  if (!ok) return Response.json({ error: "not-found" }, { status: 404 });
  recent.set(key, [...mine, now]);
  return Response.json({ ok: true });
}
