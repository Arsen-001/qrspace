import { ScanPage } from "@/components/ScanPage";

/** Сюда ведёт ссылка в каждом коде с памятью. */
export default async function Page(props: PageProps<"/c/[id]">) {
  const { id } = await props.params;
  const { invite } = await props.searchParams;
  return <ScanPage id={id} invite={typeof invite === "string" ? invite : null} />;
}
