import { VerifyPage } from "@/components/VerifyPage";

/** Наш сканер (09.10.2026): камера или фото — QR, другие коды и штрихкоды; ссылки проверяем на подделку. */
export default function Page() {
  return <VerifyPage mode="scan" />;
}
