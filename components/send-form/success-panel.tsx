"use client";

import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SendSummaryDetails } from "@/components/send-form/summary-details";
import type { ReviewPayload } from "@/components/send-form/state";

export function SendSuccessPanel({
  review,
  onReset,
}: {
  review: ReviewPayload;
  onReset: () => void;
}) {
  return (
    <div className="space-y-5">
      <section className="pr-panel pr-panel--padded space-y-4">
        <div className="flex items-center gap-3">
          <CheckCircle2 className="size-8 text-success" strokeWidth={1.5} aria-hidden />
          <div>
            <p className="font-semibold">USDC sent</p>
            <p className="text-sm text-muted" role="status">
              {review.recipients.length === 1
                ? "It's already in their Hyperliquid account."
                : `All ${review.recipients.length} transfers landed on Hyperliquid.`}
            </p>
          </div>
        </div>
        <SendSummaryDetails review={review} />
      </section>
      <div className="grid grid-cols-2 gap-2">
        <Button asChild variant="secondary" size="lg">
          <Link href="/activity">Activity</Link>
        </Button>
        <Button type="button" size="lg" onClick={onReset}>
          Send again
        </Button>
      </div>
    </div>
  );
}
