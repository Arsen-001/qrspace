import type { Metadata, Viewport } from "next";
import { Inter, Manrope, Noto_Sans_Armenian } from "next/font/google";
import "./globals.css";

const body = Inter({ variable: "--font-body", subsets: ["latin", "cyrillic"] });
const head = Manrope({ variable: "--font-head", subsets: ["latin", "cyrillic"] });
const armenian = Noto_Sans_Armenian({ variable: "--font-armenian", subsets: ["armenian"] });

export const metadata: Metadata = {
  title: "QR Studio — QR-код из ссылки, Wi-Fi, контакта или вашей фотографии",
  description: "Генератор QR-кодов: свои цвета, логотип, QR-картинка из фото, проверка чтения и коды с памятью. Первый простой код — бесплатно.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f5f2" },
    { media: "(prefers-color-scheme: dark)", color: "#111114" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ru" className={`${body.variable} ${head.variable} ${armenian.variable} h-full antialiased`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
