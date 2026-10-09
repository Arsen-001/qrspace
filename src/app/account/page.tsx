import { AccountPage } from "@/components/AccountPage";
import { ACC_TABS, type AccTab } from "@/lib/account";

/** Кабинет; ?tab=purchases — сразу нужный раздел (из меню под аватаркой). */
export default async function Page(props: PageProps<"/account">) {
  const { tab } = await props.searchParams;
  const start = typeof tab === "string" && (ACC_TABS as readonly string[]).includes(tab) ? (tab as AccTab) : "overview";
  return <AccountPage tab={start} />;
}
