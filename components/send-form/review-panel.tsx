"use client";

import { useId } from "react";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field-error";
import { formatUsdFromMicros } from "@/lib/money";
import { truncateAddress } from "@/components/send-form/helpers";
import { SendSummaryDetails } from "@/components/send-form/summary-details";
import type { ReviewPayload } from "@/components/send-form/state";

export function SendReviewPanel({
  review,
  error,
  blocker,
  confirming,
  canConfirm,
  onBack,
  onConfirm,
}: {
  review: ReviewPayload;
  error: string | null;
  blocker: string | null;
  confirming: boolean;
  canConfirm: boolean;
  onBack: () => void;
  onConfirm: () => void;
}) {
  const errorId = useId();
  const blockerId = useId();

  return (
    <div className="space-y-5">
      <section className="pr-panel pr-panel--padded space-y-4">
        <div>
          <h2 className="pr-section-title">Review send</h2>
          <p className="mt-1 text-sm text-muted">
            Robinhood Chain · USDG. Each recipient is a separate transfer. Your wallet needs ETH on
            Robinhood Chain for gas.
          </p>
        </div>

        <SendSummaryDetails review={review} />

        <ul className="space-y-2 border-t border-border pt-3">
          {review.recipients.map((r) => (
            <li
              key={`${r.address}-${r.amountUsdMicros}`}
              className="flex items-center justify-between gap-3 text-sm"
            >
              <span className="pr-mono truncate text-muted">{truncateAddress(r.address)}</span>
              <span className="pr-mono shrink-0 font-medium">
                {formatUsdFromMicros(r.amountUsdMicros)} USDG
              </span>
            </li>
          ))}
        </ul>
      </section>

      <FieldError id={errorId} message={error} />
      {blocker && !confirming && !error ? (
        <p id={blockerId} className="text-sm text-muted" role="status">
          {blocker}
        </p>
      ) : null}

      <div className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-10 flex gap-3 bg-[color-mix(in_srgb,var(--background)_92%,transparent)] py-3 backdrop-blur-sm md:static md:bg-transparent md:p-0 md:backdrop-blur-none">
        <Button
          type="button"
          variant="outline"
          className="flex-1"
          disabled={confirming}
          onClick={onBack}
        >
          Back
        </Button>
        <Button
          type="button"
          className="flex-1"
          disabled={confirming || !canConfirm}
          aria-describedby={
            !canConfirm && blocker && !error ? blockerId : error ? errorId : undefined
          }
          onClick={onConfirm}
        >
          {confirming ? "Sending…" : "Confirm send"}
        </Button>
      </div>
    </div>
  );
}
