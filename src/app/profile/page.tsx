import { permanentRedirect } from "next/navigation";

/** Профиль стал кабинетом (владелец 09.10.2026) — старые ссылки ведут туда. */
export default function Page() {
  permanentRedirect("/account");
}
