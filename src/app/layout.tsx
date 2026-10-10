import type { Metadata, Viewport } from "next";
import { JetBrains_Mono, Noto_Sans_Armenian, Onest, Unbounded } from "next/font/google";
import { DICTS } from "@/lib/i18n";
import { LangProvider } from "@/lib/lang";
import { serverLang } from "@/lib/lang-server";
import "./globals.css";

const armenian = Noto_Sans_Armenian({ variable: "--font-armenian", subsets: ["armenian"] });
// Заголовки — широкий Unbounded, текст — Onest, номера и подписи — JetBrains Mono; армянский — Noto.
const display = Unbounded({ variable: "--font-display", subsets: ["latin", "cyrillic"] });
const text = Onest({ variable: "--font-text", subsets: ["latin", "cyrillic"] });
const mono = JetBrains_Mono({ variable: "--font-code", subsets: ["latin", "cyrillic"] });

// Название и описание — на языке страницы (поисковики и превью ссылок видят свой язык).
export async function generateMetadata(): Promise<Metadata> {
  const t = DICTS[await serverLang()];
  return {
    // Полные адреса для превью ссылок: APP_URL при выкладке, на этом компьютере — localhost.
    metadataBase: new URL(process.env.APP_URL || "http://localhost:3720"),
    title: { default: `${t.appName} — ${t.tagline}`, template: `%s — ${t.appName}` },
    description: t.homeLead,
    openGraph: { siteName: t.appName, type: "website" },
    twitter: { card: "summary_large_image" },
  };
}

export const viewport: Viewport = {
  // Во весь экран iPhone (под вырез и полосу «домой»): отступы — env(safe-area-inset-*) в globals.css и TabBar.
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#edebe4" },
    { media: "(prefers-color-scheme: dark)", color: "#0b0b0c" },
  ],
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const lang = await serverLang();
  return (
    <html lang={lang} className={`${armenian.variable} ${display.variable} ${text.variable} ${mono.variable} h-full antialiased`}>
      <body className="min-h-full">
        <LangProvider lang={lang}>{children}</LangProvider>
      </body>
    </html>
  );
}
