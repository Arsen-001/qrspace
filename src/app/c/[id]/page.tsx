import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ScanPage } from "@/components/ScanPage";
import { findCode, recordVisit, viewOf } from "@/server/db";
import { currentPerson } from "@/server/session";

/** Превью ссылки: только то, что видно гостю (у машины и ключей название скрыто). */
export async function generateMetadata(props: PageProps<"/c/[id]">): Promise<Metadata> {
  const { id } = await props.params;
  const code = await findCode(id);
  const view = code && viewOf(code, null);
  const title = view?.title && view.access !== "closed" ? view.title : { absolute: "QR Space" };
  return { title, description: "Отсканировали код? Откройте — здесь память, которую для вас оставили.", robots: { index: false } };
}

/** Сюда ведёт ссылка в каждом коде. Код-ссылка сразу переадресует на адрес хозяина (скан считаем). */
export default async function Page(props: PageProps<"/c/[id]">) {
  const { id } = await props.params;
  const { invite } = await props.searchParams;
  const code = await findCode(id);
  if (code?.kind === "link" && code.target && !code.blocked) {
    await recordVisit(id, await currentPerson(), true);
    redirect(code.target);
  }
  return <ScanPage id={id} invite={typeof invite === "string" ? invite : null} />;
}
