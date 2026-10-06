import type { Metadata } from "next";
import { StockDetail } from "@/components/stocks/stock-detail";
import { pageMetadata } from "@/lib/seo";

type StockPageProps = { params: Promise<{ symbol: string }> };

export async function generateMetadata({ params }: StockPageProps): Promise<Metadata> {
  const { symbol } = await params;
  const label = decodeURIComponent(symbol).toUpperCase();
  return pageMetadata({
    title: label,
    description: `See the ${label} price on Robinhood Chain and trade it in Sandia when the quote is open.`,
    path: `/stocks/${encodeURIComponent(label)}`,
  });
}

export default function StockDetailPage({ params }: StockPageProps) {
  return <StockDetail params={params} />;
}
