import type { Metadata } from "next";
import { connection } from "next/server";
import { DesignPage } from "@/components/DesignPage";
import { market } from "@/server/db";

export async function generateMetadata(props: PageProps<"/market/[id]">): Promise<Metadata> {
  const { id } = await props.params;
  const d = (await market()).designs.find((x) => x.id === id);
  return d ? { title: `${d.name.ru} — маркет`, description: d.about.ru } : { title: "Маркет" };
}

/** Маркет — сразу с сервера (с правками администратора): скрытый дизайн не мелькает, новая цена видна сразу. */
export default async function Page(props: PageProps<"/market/[id]">) {
  const { id } = await props.params;
  await connection();
  return <DesignPage id={id} initial={await market()} />;
}
