import type { MetadataRoute } from "next";
import { siteConfig } from "@/config/site";

export default function robots(): MetadataRoute.Robots {
  const base = siteConfig.url.replace(/\/$/, "");
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/admin", "/account", "/checkout", "/order", "/api", "/auth", "/reset-password", "/forgot-password"] },
    sitemap: `${base}/sitemap.xml`,
  };
}
