import { NextResponse, type NextRequest } from "next/server";
import { mutate, newId } from "@/server/db";
import { appleUser, appUrl, finish } from "@/server/oauth";
import { startSession } from "@/server/session";
import { upsertUser } from "@/server/users";

/** Apple возвращается POST-ом (form_post): код, state и при первом входе — имя. 303 — чтобы дальше был обычный GET. */
export async function POST(req: NextRequest) {
  const form = await req.formData().catch(() => null);
  const fail = NextResponse.redirect(`${appUrl(req)}/login?error=oauth`, 303);
  const pk = await finish("apple", (form?.get("state") as string | null) ?? null);
  const code = form?.get("code");
  if (!pk || typeof code !== "string") return fail;
  try {
    const a = await appleUser(req, code, pk, (form?.get("user") as string | null) ?? null);
    const user = await mutate((db) => upsertUser(db, "apple", a.sub, a.email, a.name, newId));
    // Заблокированный администратором — без входа, на странице входа объяснение.
    if (user.blocked) return NextResponse.redirect(`${appUrl(req)}/login?error=blocked`, 303);
    await startSession(user.id);
    return NextResponse.redirect(`${appUrl(req)}${pk.next}`, 303);
  } catch {
    return fail;
  }
}
