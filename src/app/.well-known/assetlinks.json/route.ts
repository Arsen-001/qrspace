import { connection } from "next/server";

/**
 * App Links: Android с нашим приложением открывает ссылки кодов сразу в нём (пути задаёт само приложение).
 * ANDROID_APP_LINKS — «пакет:отпечаток SHA-256[:отпечаток…]» (отпечаток — с двоеточиями, как в Play Console,
 * несколько — через «|»); пока не задан — 404.
 */
export async function GET() {
  await connection();
  const raw = (process.env.ANDROID_APP_LINKS ?? "").trim();
  const at = raw.indexOf(":");
  const pkg = at > 0 ? raw.slice(0, at) : "";
  const prints = at > 0 ? raw.slice(at + 1).split("|").map((s) => s.trim().toUpperCase()).filter(Boolean) : [];
  if (!pkg || !prints.length) return new Response("Not found", { status: 404 });
  return Response.json([
    {
      relation: ["delegate_permission/common.handle_all_urls"],
      target: { namespace: "android_app", package_name: pkg, sha256_cert_fingerprints: prints },
    },
  ]);
}
