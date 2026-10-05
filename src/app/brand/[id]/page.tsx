import { OrderPage } from "@/components/OrderPage";

export default async function Page(props: PageProps<"/brand/[id]">) {
  const { id } = await props.params;
  return <OrderPage id={id} />;
}
