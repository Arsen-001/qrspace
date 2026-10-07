import { connection } from "next/server";

/**
 * Universal Links: iPhone с нашим приложением открывает короткую ссылку кода (/K/…) и страницу кода (/c/…) сразу в нём,
 * без приложения — как сейчас, в браузере. APPLE_APP_IDS — «TEAMID.bundle.id» (через запятую); пока не задан — 404.
 */
export async function GET() {
  await connection();
  const appIDs = (process.env.APPLE_APP_IDS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  if (!appIDs.length) return new Response("Not found", { status: 404 });
  return Response.json({
    applinks: { details: [{ appIDs, components: [{ "/": "/K/*" }, { "/": "/c/*" }] }] },
  });
}
