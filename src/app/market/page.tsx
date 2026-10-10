import { connection } from "next/server";
import { MarketPage } from "@/components/MarketPage";
import { market } from "@/server/db";

/** Маркет — сразу с сервера (с правками администратора): скрытый дизайн не мелькает, новая цена видна сразу. */
export default async function Page() {
  await connection(); // данные — только на запрос, не при сборке
  return <MarketPage initial={await market()} />;
}
