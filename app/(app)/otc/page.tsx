import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function OtcPage() {
  return (
    <div className="pr-page">
      <div className="space-y-2">
        <h1 className="pr-display text-2xl">OTC</h1>
        <p className="text-sm leading-relaxed text-muted">
          OTC settlement is coming soon. You will negotiate and settle large transfers off the
          public request flow.
        </p>
      </div>

      <div className="pr-panel pr-panel--padded space-y-4">
        <p className="font-medium text-foreground">Not available yet</p>
        <p className="text-sm text-muted">
          Meanwhile, create a payment request or send USDG with the same destination.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button asChild className="w-full sm:w-auto">
            <Link href="/requests/new">Create a request</Link>
          </Button>
          <Button asChild variant="secondary" className="w-full sm:w-auto">
            <Link href="/send">Send USDG</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
