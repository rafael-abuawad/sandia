import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "AI Agent",
  description: "Ask Sandia to draft a payment request or a send.",
  path: "/agent",
  index: false,
});

export default function AgentLayout({ children }: { children: React.ReactNode }) {
  return children;
}
