import { notFound, redirect } from "next/navigation";
import { findByShort, recordVisit } from "@/server/db";
import { currentPerson } from "@/server/session";

/** Короткая ссылка в коде: /K/AB12CD. Код-ссылка — сразу к цели (один переход, скан считаем), остальное — страница кода. */
export default async function Page(props: PageProps<"/K/[s]">) {
  const { s } = await props.params;
  const code = await findByShort(s);
  if (!code) notFound();
  if (code.kind === "link" && code.target && !code.blocked) {
    await recordVisit(code.id, await currentPerson(), true);
    redirect(code.target);
  }
  redirect(`/c/${code.id}`);
}
