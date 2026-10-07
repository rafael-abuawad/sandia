import type { Metadata } from "next";
import { LOCAL_CHAIN_STOCKS } from "@/lib/stocks/assets";

export const SITE_NAME = "Sandia";

const PUBLIC_PAGES = ["/", "/about", "/requests/new", "/send", "/earn", "/stocks"] as const;

/** URLs that describe the product. Account and payment-link URLs stay out. */
export function publicSitemapPaths(): string[] {
  return [
    ...PUBLIC_PAGES,
    ...LOCAL_CHAIN_STOCKS.map((stock) => `/stocks/${encodeURIComponent(stock.symbol)}`),
  ];
}

export function siteOrigin(): URL {
  const explicit = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (explicit) {
    try {
      const url = new URL(explicit);
      if (url.protocol === "http:" || url.protocol === "https:") return url;
    } catch {
      // Ignore a malformed origin and fall through.
    }
  }
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (vercel) return new URL(`https://${vercel}`);
  return new URL("http://localhost:3000");
}

export function jsonLdScript(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

export function pageMetadata({
  title,
  description,
  path,
  index = true,
  absolute = false,
}: {
  title: string;
  description: string;
  path?: string;
  index?: boolean;
  absolute?: boolean;
}): Metadata {
  return {
    title: absolute ? { absolute: title } : title,
    description,
    alternates: path ? { canonical: path } : undefined,
    robots: { index, follow: true },
  };
}
