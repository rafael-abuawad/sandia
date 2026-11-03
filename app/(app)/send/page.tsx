import type { Metadata } from "next";
import { SendForm } from "@/components/send-form";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Send",
  description: "Send USDC on Hyperliquid to one address or a batch. Instant and free.",
  path: "/send",
});

export default function SendPage() {
  return (
    <div className="pr-page">
      <h1 className="sr-only">Send</h1>
      <SendForm />
    </div>
  );
}
