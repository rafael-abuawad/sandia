"use client";

import { Button } from "@/components/ui/button";
import { SendSummaryDetails } from "@/components/send-form/summary-details";
import type { ReviewPayload } from "@/components/send-form/state";

export function SendSuccessPanel({
  review,
  transactionHash,
  activityError,
  activitySyncing,
  onRetryActivity,
  onReset,
}: {
  review: ReviewPayload;
  transactionHash: `0x${string}` | null;
  activityError: string | null;
  activitySyncing: boolean;
  onRetryActivity: () => void;
  onReset: () => void;
}) {
  return (
    <div className="space-y-5">
      <section className="pr-panel pr-panel--padded space-y-3">
        <p className="text-sm font-semibold text-success">USDG sent</p>
        <p className="text-sm leading-relaxed text-muted" role="status">
          {review.recipients.length === 1
            ? "Your USDG transfer is confirmed on Robinhood Chain."
            : "The confirmed receipt includes a USDG transfer for every recipient."}
        </p>
        <SendSummaryDetails review={review} />
        {transactionHash ? (
          <p className="pr-mono break-all border-t border-border pt-3 text-xs text-muted">
            Transaction {transactionHash}
          </p>
        ) : null}
        {activityError ? (
          <div className="space-y-2 rounded-md border border-border p-3" role="status">
            <p className="text-sm text-muted">{activityError}</p>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              disabled={activitySyncing}
              onClick={onRetryActivity}
            >
              {activitySyncing ? "Updating activity…" : "Retry activity update"}
            </Button>
          </div>
        ) : null}
      </section>
      <Button type="button" className="w-full" onClick={onReset}>
        Send again
      </Button>
    </div>
  );
}
