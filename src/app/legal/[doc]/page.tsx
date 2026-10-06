import { notFound } from "next/navigation";
import { LegalPage } from "@/components/LegalPage";
import { LEGAL_DOCS, type LegalDoc } from "@/lib/legal";

export default async function Page(props: PageProps<"/legal/[doc]">) {
  const { doc } = await props.params;
  if (!(LEGAL_DOCS as readonly string[]).includes(doc)) notFound();
  return <LegalPage doc={doc as LegalDoc} />;
}
