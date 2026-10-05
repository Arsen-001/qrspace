import type { Metadata } from "next";
import { ScanPage } from "@/components/ScanPage";
import { findCode, viewOf } from "@/server/db";

/** Превью ссылки: только то, что видно гостю (у машины и ключей название скрыто). */
export async function generateMetadata(props: PageProps<"/c/[id]">): Promise<Metadata> {
  const { id } = await props.params;
  const code = await findCode(id);
  const view = code && viewOf(code, null);
  const title = view?.title && view.access !== "closed" ? view.title : { absolute: "QR Studio" };
  return { title, description: "Отсканировали код? Откройте — здесь память, которую для вас оставили.", robots: { index: false } };
}

/** Сюда ведёт ссылка в каждом коде с памятью. */
export default async function Page(props: PageProps<"/c/[id]">) {
  const { id } = await props.params;
  const { invite } = await props.searchParams;
  return <ScanPage id={id} invite={typeof invite === "string" ? invite : null} />;
}
