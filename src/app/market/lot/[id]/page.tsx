import { LotPage } from "@/components/LotPage";

export default async function Page(props: PageProps<"/market/lot/[id]">) {
  const { id } = await props.params;
  return <LotPage id={id} />;
}
