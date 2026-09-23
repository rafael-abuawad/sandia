"use client";

import { Button } from "@/components/ui/button";
import { formatUsdFromMicros } from "@/lib/money";
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
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-muted">Mode</dt>
            <dd className="font-medium capitalize">{review.mode}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted">Recipients</dt>
            <dd className="font-medium">{review.recipients.length}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted">Total</dt>
            <dd className="pr-mono font-medium">
              {formatUsdFromMicros(review.totalUsdMicros)} USDG
            </dd>
          </div>
        </dl>
      </section>
      <Button type="button" className="w-full" onClick={onReset}>
        Send again
      </Button>
    </div>
  );
}
