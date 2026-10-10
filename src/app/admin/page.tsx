import { AdminPage } from "@/components/AdminPage";
import { ADMIN_TABS, type AdminTab } from "@/lib/admin";

/** Кабинет администратора; ?tab=users|codes|market|purchases — сразу нужный раздел, ?user=<id> — сразу этот человек. */
export default async function Page(props: PageProps<"/admin">) {
  const { tab, user } = await props.searchParams;
  const start = typeof tab === "string" && (ADMIN_TABS as readonly string[]).includes(tab) ? (tab as AdminTab) : "overview";
  const person = start === "users" && typeof user === "string" && /^[\w-]{1,40}$/.test(user) ? user : null;
  return <AdminPage tab={start} user={person} />;
}
