import type { NextRequest } from "next/server";
import { findByShort, findCode, publicBase, viewOf } from "@/server/db";

/**
 * Настоящий ли это код QR Space: ссылка ведёт на наш сайт и такой код есть. Отдаём только то, что видно гостю
 * (у машины и ключей название скрыто).
 */
export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("u") ?? "";
  let url: URL | null = null;
  try {
    url = new URL(raw);
  } catch {}
  if (!url) return Response.json({ result: "text" });
  const ours = new Set([new URL(publicBase(req)).host.toLowerCase(), req.nextUrl.host.toLowerCase(), process.env.APP_URL ? new URL(process.env.APP_URL).host.toLowerCase() : ""]);
  if (!ours.has(url.host.toLowerCase())) return Response.json({ result: "foreign", host: url.host });
  const m = /^\/(c|K|k)\/([A-Za-z0-9]+)\/?$/.exec(url.pathname);
  const code = m ? (m[1] === "c" ? await findCode(m[2]) : await findByShort(m[2])) : null;
  if (!code) return Response.json({ result: m ? "missing" : "site" });
  const v = viewOf(code, null);
  return Response.json({ result: "ours", id: code.id, kind: code.kind, title: v.title });
}
