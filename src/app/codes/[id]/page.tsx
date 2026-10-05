import { CodeEditor } from "@/components/CodeEditor";

export default async function Page(props: PageProps<"/codes/[id]">) {
  const { id } = await props.params;
  return <CodeEditor id={id} />;
}
