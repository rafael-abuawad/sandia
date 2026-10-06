import type { Metadata } from "next";
import { SendForm } from "@/components/send-form";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Send",
  description: "Send USDG to one address or a batch, and review the transfer before it is submitted.",
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
