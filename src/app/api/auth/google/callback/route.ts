import { NextResponse, type NextRequest } from "next/server";
import { mutate, newId } from "@/server/db";
import { appUrl, finish, googleUser } from "@/server/oauth";
import { startSession } from "@/server/session";
import { upsertUser } from "@/server/users";

/** Google вернул код → меняем на данные человека → входим. */
export async function GET(req: NextRequest) {
  const fail = NextResponse.redirect(`${appUrl(req)}/login?error=oauth`);
  const pk = await finish("google", req.nextUrl.searchParams.get("state"));
  const code = req.nextUrl.searchParams.get("code");
  if (!pk || !code) return fail;
  try {
    const g = await googleUser(req, code, pk);
    const user = await mutate((db) => upsertUser(db, "google", g.sub, g.email, g.name, newId));
    // Заблокированный администратором — без входа, на странице входа объяснение.
    if (user.blocked) return NextResponse.redirect(`${appUrl(req)}/login?error=blocked`);
    await startSession(user.id);
    return NextResponse.redirect(`${appUrl(req)}${pk.next}`);
  } catch {
    return fail;
  }
}
