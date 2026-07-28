"use client";

import { Button } from "@/components/ui/button";
import { formatUsdFromMicros } from "@/lib/money";
import { truncateAddress } from "@/components/send-form/helpers";
import type { ReviewPayload } from "@/components/send-form/state";

export function SendReviewPanel({
  review,
  error,
  confirming,
  onBack,
  onConfirm,
}: {
  review: ReviewPayload;
  error: string | null;
  confirming: boolean;
  onBack: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="mx-auto max-w-lg space-y-5">
      <section className="pr-panel space-y-4 p-5">
        <div>
          <h2 className="text-base font-semibold">Review send</h2>
          <p className="mt-1 text-sm text-muted">Confirm details before the demo mock completes.</p>
        </div>

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

        <ul className="space-y-2 border-t border-border pt-3">
          {review.recipients.map((r) => (
            <li
              key={`${r.address}-${r.amountUsdMicros}`}
              className="flex items-center justify-between gap-3 text-sm"
            >
              <span className="pr-mono text-muted">{truncateAddress(r.address)}</span>
              <span className="pr-mono font-medium">
                {formatUsdFromMicros(r.amountUsdMicros)} USDG
              </span>
            </li>
          ))}
        </ul>
      </section>

      {error && <p className="text-sm text-danger">{error}</p>}

      <div className="flex gap-3">
        <Button
          type="button"
          variant="outline"
          className="flex-1"
          disabled={confirming}
          onClick={onBack}
        >
          Back
        </Button>
        <Button type="button" className="flex-1" disabled={confirming} onClick={onConfirm}>
          {confirming ? "Sending…" : "Confirm (demo)"}
        </Button>
      </div>
    </div>
  );
}
