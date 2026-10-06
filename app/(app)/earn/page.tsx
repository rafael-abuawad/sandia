import type { Metadata } from "next";
import { EarnPanel } from "@/components/earn-panel";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Earn",
  description: "Deposit, withdraw, and redeem USDG in Sandia Earn.",
  path: "/earn",
});

export default function EarnPage() {
  return <EarnPanel />;
}
