import type { Metadata } from "next";
import { DesignPage } from "@/components/DesignPage";
import { DESIGNS } from "@/lib/market";
import { market } from "@/server/db";

export async function generateMetadata(props: PageProps<"/market/[id]">): Promise<Metadata> {
  const { id } = await props.params;
  const d = (await market()).designs.find((x) => x.id === id) ?? DESIGNS.find((x) => x.id === id);
  return d ? { title: `${d.name.ru} — маркет`, description: d.about.ru } : { title: "Маркет" };
}

export default async function Page(props: PageProps<"/market/[id]">) {
  const { id } = await props.params;
  return <DesignPage id={id} />;
}
