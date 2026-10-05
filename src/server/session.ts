// Демо-вход: кем человек вошёл — в cookie. Настоящий вход (телефон или почта) будет позже.
import { cookies } from "next/headers";
import { isPerson } from "./db";

export const SESSION_COOKIE = "qr-demo-person";

export async function currentPerson(): Promise<string | null> {
  const v = (await cookies()).get(SESSION_COOKIE)?.value;
  return isPerson(v) ? v : null;
}
