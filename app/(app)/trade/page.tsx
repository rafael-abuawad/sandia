import type { Metadata } from "next";
import { Suspense } from "react";
import { MarketListSkeleton, TradeHome } from "@/components/trade/trade-home";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Trade",
  description:
    "Trade crypto and stock perpetuals on Hyperliquid from your phone. Long or short with up to 50x leverage.",
  path: "/trade",
});

export default function TradePage() {
  return (
    <Suspense
      fallback={
        <div className="pr-app-page">
          <MarketListSkeleton />
        </div>
      }
    >
      <TradeHome />
    </Suspense>
  );
}
