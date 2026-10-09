import { HomePage } from "@/components/HomePage";
import { currentPerson } from "@/server/session";

/** Главная: гостю — витрина, вошедшему — свои коды (владелец 09.10.2026). Кто вошёл, знаем уже на сервере — без мелькания. */
export default async function Home() {
  return <HomePage signedIn={!!(await currentPerson())} />;
}
