import { NextResponse, type NextRequest } from "next/server";
import { appleAuthUrl, begin, providers } from "@/server/oauth";

/** «Войти через Apple» → на страницу Apple. */
export async function GET(req: NextRequest) {
  if (!providers().apple) return NextResponse.redirect(new URL("/login?error=apple-off", req.url));
  const pk = await begin("apple", req.nextUrl.searchParams.get("next") ?? "/");
  return NextResponse.redirect(appleAuthUrl(req, pk));
}
