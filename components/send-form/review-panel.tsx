"use client";

import { useId } from "react";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field-error";
import { formatUsdFromMicros } from "@/lib/money";
import { truncateAddress } from "@/components/send-form/helpers";
import { SendSummaryDetails } from "@/components/send-form/summary-details";
import type { ReviewPayload, SendTransactionProgress } from "@/components/send-form/state";

function getProgressMessage(progress: SendTransactionProgress, confirming: boolean) {
  switch (progress.phase) {
    case "awaiting-wallet":
      return progress.label;
    case "confirming":
      return `${progress.label ?? "Transaction"} submitted. Waiting for confirmation…`;
    case "pending":
      return "The transaction is still pending. Check its status before starting another send.";
    case "recording":
      return "Transfer confirmed. Updating send activity…";
    default:
      return confirming ? "Preparing your send…" : null;
  }
}

function getActionLabel(progress: SendTransactionProgress, confirming: boolean) {
  if (progress.phase === "pending" && progress.hash !== null) {
    return progress.stage === "approval"
      ? "Check approval and continue"
      : "Check transaction status";
  }
  if (!confirming) return "Confirm send";
  if (progress.phase === "awaiting-wallet") return "Waiting for wallet…";
  if (progress.phase === "recording") return "Updating activity…";
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
  const errorId = useId();
  const blockerId = useId();
  const progressMessage = getProgressMessage(progress, confirming);
  const actionLabel = getActionLabel(progress, confirming);

  return (
    <div className="space-y-5">
      <section className="pr-panel pr-panel--padded space-y-4">
        <div>
          <h2 className="pr-section-title">Review send</h2>
          <p className="mt-1 text-sm text-muted">
            {review.mode === "massive"
              ? "Robinhood Chain · USDG. This batch is one send after you approve USDG for the total. Sandia covers the network fees."
              : "Robinhood Chain · USDG. This is a direct transfer. Sandia covers the network fee."}
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
      {progressMessage ? (
        <div
          className="space-y-1 rounded-md border border-border px-3 py-2 text-sm text-muted"
          role="status"
          aria-live="polite"
        >
          <p>{progressMessage}</p>
          {progress.hash ? (
            <p className="pr-mono text-xs">
              Transaction {progress.hash.slice(0, 10)}…{progress.hash.slice(-6)}
            </p>
          ) : null}
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

      <div className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-10 flex gap-3 bg-[color-mix(in_srgb,var(--background)_92%,transparent)] py-3 backdrop-blur-sm md:static md:bg-transparent md:p-0 md:backdrop-blur-none">
        <Button
          type="button"
          variant="outline"
          className="flex-1"
          disabled={confirming || progress.hash !== null}
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
          {actionLabel}
        </Button>
      </div>
    </div>
  );
}
