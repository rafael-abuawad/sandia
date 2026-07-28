import { StockDetail } from "@/components/stocks/stock-detail";

export default function StockDetailPage({ params }: { params: Promise<{ symbol: string }> }) {
  return <StockDetail params={params} />;
}
