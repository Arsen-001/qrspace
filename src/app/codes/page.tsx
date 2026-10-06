import { CodesPage } from "@/components/CodesPage";
import { KINDS, type Kind } from "@/lib/codes";

/** ?new=link — сразу открыть «Новый код» с этим шаблоном (например, из генератора). */
export default async function Page(props: PageProps<"/codes">) {
  const { new: kind } = await props.searchParams;
  const start = typeof kind === "string" && (KINDS as readonly string[]).includes(kind) && kind !== "item" ? (kind as Kind) : null;
  return <CodesPage startNew={start} />;
}
