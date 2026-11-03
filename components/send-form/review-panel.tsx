"use client";

import { useEmbeddedPresentation } from "@/components/embedded-presentation";
import { useId } from "react";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field-error";
import { formatUsdFromMicros } from "@/lib/money";
import { truncateAddress } from "@/components/send-form/helpers";
import { SendSummaryDetails } from "@/components/send-form/summary-details";
import type { ReviewPayload, SendTransactionProgress } from "@/components/send-form/state";

function getProgressMessage(progress: SendTransactionProgress, confirming: boolean) {
  if (progress.phase === "awaiting-wallet") return progress.label;
  return confirming ? "Sending…" : null;
}

function getActionLabel(progress: SendTransactionProgress, confirming: boolean) {
  if (!confirming) return "Send now";
  if (progress.phase === "awaiting-wallet") return "Waiting for wallet…";
  return "Sending…";
}

export function SendReviewPanel({
  review,
  error,
  blocker,
  confirming,
  canConfirm,
  progress,
  balanceUnavailable,
  onRetryBalance,
  onBack,
  onConfirm,
}: {
  review: ReviewPayload;
  error: string | null;
  blocker: string | null;
  confirming: boolean;
  canConfirm: boolean;
  progress: SendTransactionProgress;
  balanceUnavailable: boolean;
  onRetryBalance: () => void;
  onBack: () => void;
  onConfirm: () => void;
}) {
  const embedded = useEmbeddedPresentation();
  const errorId = useId();
  const blockerId = useId();
  const progressMessage = getProgressMessage(progress, confirming);
  const actionLabel = getActionLabel(progress, confirming);

  return (
    <div className="space-y-5">
      <section className="pr-panel pr-panel--padded space-y-4">
        <div>
          <h2 className="pr-section-title">Review send</h2>
          <p className="mbs-1 text-sm text-muted">
            {review.mode === "massive"
              ? "USDC on Hyperliquid. Each recipient is one instant transfer. No network fees."
              : "USDC on Hyperliquid. Instant, with no network fee."}
          </p>
        </div>

        <SendSummaryDetails review={review} />

        <ul className="space-y-2 border-bs border-border pbs-3">
          {review.recipients.map((r) => (
            <li
              key={`${r.address}-${r.amountUsdMicros}`}
              className="flex items-center justify-between gap-3 text-sm"
            >
              <span className="pr-mono truncate text-muted">{truncateAddress(r.address)}</span>
              <span className="pr-mono shrink-0 font-medium">
                {formatUsdFromMicros(r.amountUsdMicros)} USDC
              </span>
            </li>
          ))}
        </ul>
      </section>

      <FieldError id={errorId} message={error} />
      {progressMessage ? (
        <div
          className="space-y-1 rounded-md border border-border px-3 py-2 text-sm text-muted"
          role="status"
          aria-live="polite"
        >
          <p>{progressMessage}</p>
        </div>
      ) : null}
      {blocker && !confirming && !error ? (
        <div className="space-y-2 text-sm text-muted" role="status">
          <p id={blockerId}>{blocker}</p>
          {balanceUnavailable ? (
            <Button type="button" variant="outline" size="sm" onClick={onRetryBalance}>
              Retry balance check
            </Button>
          ) : null}
        </div>
      ) : null}

      <div
        className={
          embedded
            ? "flex gap-3 py-3"
            : "sticky inset-be-[calc(4.5rem+env(safe-area-inset-bottom))] z-10 flex gap-3 bg-[color-mix(in_oklch,var(--background)_92%,transparent)] py-3 backdrop-blur-sm md:static md:bg-transparent md:p-0 md:backdrop-blur-none"
        }
      >
        <Button
          size="lg"
          type="button"
          variant="outline"
          className="flex-1"
          disabled={confirming}
          onClick={onBack}
        >
          Back
        </Button>
        <Button
          size="lg"
          type="button"
          className="flex-1"
          disabled={confirming || !canConfirm}
          aria-describedby={
            !canConfirm && blocker && !error ? blockerId : error ? errorId : undefined
          }
          onClick={onConfirm}
        >
          {actionLabel}
        </Button>
      </div>
    </div>
  );
}
