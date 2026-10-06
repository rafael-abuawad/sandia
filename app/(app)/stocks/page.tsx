import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { StocksMarket } from "@/components/stocks/stocks-market";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Stocks",
  description:
    "See stock token prices on Robinhood Chain and open a trade when the quote says the market is open.",
  path: "/stocks",
});

export default function StocksPage() {
  return (
    <div className="pr-page">
      <Breadcrumbs
        items={[
          { href: "/", label: "Home" },
          { href: "/stocks", label: "Stocks" },
        ]}
      />
      <StocksMarket />
    </div>
  );
}
