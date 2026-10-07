import type { MetadataRoute } from "next";

/** Поисковикам — открытые страницы; личное (коды, память под кодом, кабинет, вход) и API — нет. */
export default function robots(): MetadataRoute.Robots {
  const base = process.env.APP_URL || "http://localhost:3720";
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/api/", "/codes", "/c/", "/K/", "/admin", "/profile", "/login", "/brand/auth"] },
    sitemap: `${base}/sitemap.xml`,
  };
}
