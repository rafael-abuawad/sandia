import type { Metadata } from "next";
import { Suspense } from "react";
import { MarketScreen, MarketScreenSkeleton } from "@/components/trade/market-screen";
import { pageMetadata } from "@/lib/seo";

type MarketPageProps = { params: Promise<{ coin: string }> };

function label(coin: string): string {
  return coin.replace(/^[a-z0-9]+:/, "").toUpperCase();
}

export async function generateMetadata({ params }: MarketPageProps): Promise<Metadata> {
  const coin = decodeURIComponent((await params).coin);
  return pageMetadata({
    title: `${label(coin)} price and trading`,
    description: `Live ${label(coin)} price. Go long or short on Hyperliquid in Sandia.`,
    path: `/trade/${encodeURIComponent(coin)}`,
  });
}

export default async function MarketPage({ params }: MarketPageProps) {
  const coin = decodeURIComponent((await params).coin);
  return (
    <Suspense fallback={<MarketScreenSkeleton />}>
      <MarketScreen coin={coin} />
    </Suspense>
  );
}
