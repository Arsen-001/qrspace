import { AuthLabelsPage } from "@/components/AuthBatches";

export default async function Page(props: PageProps<"/brand/auth/[batch]">) {
  const { batch } = await props.params;
  return <AuthLabelsPage id={batch} />;
}
