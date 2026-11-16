import type { MetadataRoute } from "next";
import { siteConfig } from "@/config/site";
import { getCatalog } from "@/lib/catalog";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const products = await getCatalog();
  const base = siteConfig.url.replace(/\/$/, "");
  const pages = ["", "/shop", "/about", "/contact", "/faq", "/shipping-returns"];

  return [
    ...pages.map((path) => ({ url: `${base}${path}`, changeFrequency: "weekly" as const })),
    ...products.map((p) => ({ url: `${base}/product/${p.slug}`, changeFrequency: "weekly" as const })),
  ];
}
