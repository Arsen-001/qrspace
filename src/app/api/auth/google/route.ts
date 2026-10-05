import { NextResponse, type NextRequest } from "next/server";
import { begin, googleAuthUrl, providers } from "@/server/oauth";

/** «Войти через Google» → на страницу Google. */
export async function GET(req: NextRequest) {
  if (!providers().google) return NextResponse.redirect(new URL("/login?error=google-off", req.url));
  const pk = await begin("google", req.nextUrl.searchParams.get("next") ?? "/codes");
  return NextResponse.redirect(googleAuthUrl(req, pk));
}
