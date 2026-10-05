// Кем вошёл человек: подписанная cookie с его id (вход через Google/Apple или демо).
import { cookies } from "next/headers";
import { findUser } from "./db";
import { sign, unsign } from "./users";

export const SESSION_COOKIE = "qr-session";
const YEAR = 60 * 60 * 24 * 365;

export async function currentPerson(): Promise<string | null> {
  const id = await unsign((await cookies()).get(SESSION_COOKIE)?.value);
  return id && (await findUser(id)) ? id : null;
}

export async function startSession(userId: string) {
  (await cookies()).set(SESSION_COOKIE, await sign(userId), { path: "/", sameSite: "lax", httpOnly: true, secure: process.env.NODE_ENV === "production", maxAge: YEAR });
}

export async function endSession() {
  (await cookies()).delete(SESSION_COOKIE);
}
