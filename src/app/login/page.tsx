import { LoginPage } from "@/components/LoginPage";

export default async function Page(props: PageProps<"/login">) {
  const { next, error } = await props.searchParams;
  return <LoginPage next={typeof next === "string" ? next : null} error={typeof error === "string" ? error : null} />;
}
