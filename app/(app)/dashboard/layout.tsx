import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Your requests",
  description: "Payment requests you created in Sandia.",
  path: "/dashboard",
  index: false,
});

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return children;
}
