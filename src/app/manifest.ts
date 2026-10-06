import type { MetadataRoute } from "next";

/** Сайт ставится на телефон как приложение («На экран „Домой“» / «Установить»). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "QR Space",
    short_name: "QR Space",
    description: "Красивые QR-коды с памятью: фото, видео, текст — и вы решаете, кто их видит.",
    start_url: "/codes",
    display: "standalone",
    background_color: "#0b0b0c",
    theme_color: "#0b0b0c",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
