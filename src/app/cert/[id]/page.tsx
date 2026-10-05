import { CertPage } from "@/components/CertPage";

export default async function Page(props: PageProps<"/cert/[id]">) {
  const { id } = await props.params;
  return <CertPage id={id} />;
}
