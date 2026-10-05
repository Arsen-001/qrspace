import { DesignPage } from "@/components/DesignPage";

export default async function Page(props: PageProps<"/market/[id]">) {
  const { id } = await props.params;
  return <DesignPage id={id} />;
}
