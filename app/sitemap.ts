import type { MetadataRoute } from "next";
import { publicSitemapPaths, siteOrigin } from "@/lib/seo";

export default function sitemap(): MetadataRoute.Sitemap {
  const origin = siteOrigin();
  const lastModified = new Date();
  return publicSitemapPaths().map((path) => ({
    url: new URL(path, origin).toString(),
    lastModified,
    changeFrequency: path === "/" ? "weekly" : "daily",
    priority: path === "/" ? 1 : 0.7,
  }));
}
