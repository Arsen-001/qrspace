import type { MetadataRoute } from "next";
import { LEGAL_DOCS } from "@/lib/legal";

/** Открытые страницы сайта для поисковиков. */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.APP_URL || "http://localhost:3720";
  const pages: [string, number][] = [["", 1], ["/market", 0.9], ["/numbers", 0.8], ["/how", 0.7], ["/shop", 0.7], ["/brand", 0.7], ["/verify", 0.5]];
  return [
    ...pages.map(([p, priority]) => ({ url: base + p, changeFrequency: "weekly" as const, priority })),
    ...LEGAL_DOCS.map((d) => ({ url: `${base}/legal/${d}`, changeFrequency: "yearly" as const, priority: 0.2 })),
  ];
}
