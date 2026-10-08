import { notFound, redirect } from "next/navigation";
import { findByShort } from "@/server/db";

/** Короткая ссылка в коде: /K/AB12CD → страница кода (там содержимое, кнопки и «кто видит»; скан считается там). */
export default async function Page(props: PageProps<"/K/[s]">) {
  const { s } = await props.params;
  const code = await findByShort(s);
  if (!code) notFound();
  redirect(`/c/${code.id}`);
}
