import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Activity",
  description: "Transfers and payments on your Sandia account.",
  path: "/activity",
  index: false,
});

export default function ActivityLayout({ children }: { children: React.ReactNode }) {
  return children;
}
