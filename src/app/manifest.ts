import type { MetadataRoute } from "next";

/** Сайт ставится на телефон как приложение («На экран „Домой“» / «Установить»). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "QR Studio",
    short_name: "QR Studio",
    description: "Красивые QR-коды с памятью: фото, видео, текст — и вы решаете, кто их видит.",
    start_url: "/codes",
    display: "standalone",
    background_color: "#f6f5f2",
    theme_color: "#2e3fd6",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
