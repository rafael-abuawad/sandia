import type { Metadata } from "next";
import { PortfolioView } from "@/components/portfolio/portfolio-view";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Portfolio",
  description: "Your Hyperliquid balance, positions and performance in Sandia.",
  path: "/portfolio",
  index: false,
});

export default function PortfolioPage() {
  return <PortfolioView />;
}
