"use client";

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
      <section className="pr-panel pr-panel--padded space-y-3">
        <p className="text-sm font-semibold text-success">USDG sent</p>
        <p className="text-sm leading-relaxed text-muted">
          The Robinhood receipt included a USDG transfer for every recipient in this batch.
        </p>
        <SendSummaryDetails review={review} />
      </section>
      <Button type="button" className="w-full" onClick={onReset}>
        Send again
      </Button>
    </div>
  );
}
