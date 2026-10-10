import { notFound, redirect } from "next/navigation";
import { Oops } from "@/components/Oops";
import { SAMPLE_SHORT } from "@/lib/codes";
import { findByShort } from "@/server/db";

/** Короткая ссылка в коде: /K/AB12CD → страница кода (там содержимое, кнопки и «кто видит»; скан считается там). */
export default async function Page(props: PageProps<"/K/[s]">) {
  const { s } = await props.params;
  // Рисунок-образец из генератора (до скачивания) — объяснить, а не «ничего нет».
  if (s.toUpperCase() === SAMPLE_SHORT) return <Oops sample />;
  const code = await findByShort(s);
  if (!code) notFound();
  redirect(`/c/${code.id}`);
}
