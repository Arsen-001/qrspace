import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono, Manrope, Noto_Sans_Armenian, Onest, Unbounded } from "next/font/google";
import "./globals.css";

const body = Inter({ variable: "--font-body", subsets: ["latin", "cyrillic"] });
const head = Manrope({ variable: "--font-head", subsets: ["latin", "cyrillic"] });
const armenian = Noto_Sans_Armenian({ variable: "--font-armenian", subsets: ["armenian"] });
// Шрифты нового вида главной страницы (.x-home в globals.css).
const display = Unbounded({ variable: "--font-display", subsets: ["latin", "cyrillic"] });
const text = Onest({ variable: "--font-text", subsets: ["latin", "cyrillic"] });
const mono = JetBrains_Mono({ variable: "--font-code", subsets: ["latin", "cyrillic"] });

export const metadata: Metadata = {
  // Полные адреса для превью ссылок: APP_URL при выкладке, на этом компьютере — localhost.
  metadataBase: new URL(process.env.APP_URL || "http://localhost:3720"),
  title: { default: "QR Studio — QR-код из ссылки, Wi-Fi, контакта или вашей фотографии", template: "%s — QR Studio" },
  description: "Генератор QR-кодов: свои цвета, логотип, QR-картинка из фото, проверка чтения и коды с памятью. Первый простой код — бесплатно.",
  openGraph: { siteName: "QR Studio", type: "website" },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f5f2" },
    { media: "(prefers-color-scheme: dark)", color: "#111114" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ru" className={`${body.variable} ${head.variable} ${armenian.variable} ${display.variable} ${text.variable} ${mono.variable} h-full antialiased`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
