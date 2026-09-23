/** Pure Across fill checks. A request is paid only when every field is present and matches. */

export const ROBINHOOD_CHAIN_ID = 4663;

export const STUCK_AFTER_MS = 30 * 60 * 1000;
export const MAX_ATTEMPTS_PER_REQUEST = 8;
export const RECONCILE_BATCH = 25;

export type FillEvidence = {
  status: string;
  destinationChainId?: number;
  outputToken?: string;
  recipient?: string;
  outputAmount?: string;
  fillTxnRef?: string;
};

export type ExpectedSettlement = {
  destinationChainId: number;
  destinationTokenAddress: string;
  recipientAddress: string;
  outputAmountBaseUnits: string;
};

export type FillDecision =
  | { outcome: "pending" }
  | { outcome: "expired" }
  | { outcome: "refunded" }
  | { outcome: "filled" }
  | { outcome: "incomplete"; reason: string }
  | { outcome: "mismatch"; reason: string };

function hasText(value: string | undefined): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

/** Decide what to persist. Missing proof stays incomplete so a later indexer read can succeed. */
export function evaluateFill(evidence: FillEvidence, expected: ExpectedSettlement): FillDecision {
  const status = evidence.status.toLowerCase();
  if (status === "expired") return { outcome: "expired" };
  if (status === "refunded") return { outcome: "refunded" };
  if (status !== "filled") return { outcome: "pending" };

  if (!hasText(evidence.fillTxnRef)) {
    return { outcome: "incomplete", reason: "Filled status is missing fillTxnRef" };
  }
  if (evidence.destinationChainId === undefined) {
    return { outcome: "incomplete", reason: "Filled status is missing destinationChainId" };
  }
  if (!hasText(evidence.outputToken)) {
    return { outcome: "incomplete", reason: "Filled status is missing outputToken" };
  }
  if (!hasText(evidence.recipient)) {
    return { outcome: "incomplete", reason: "Filled status is missing recipient" };
  }
  if (!hasText(evidence.outputAmount)) {
    return { outcome: "incomplete", reason: "Filled status is missing outputAmount" };
  }

  if (evidence.destinationChainId !== expected.destinationChainId) {
    return {
      outcome: "mismatch",
      reason: `Fill destination chain ${evidence.destinationChainId} is not ${expected.destinationChainId}`,
    };
  }
  if (evidence.destinationChainId !== ROBINHOOD_CHAIN_ID) {
    return { outcome: "mismatch", reason: "Fill destination chain is not Robinhood Chain" };
  }
  if (evidence.outputToken.toLowerCase() !== expected.destinationTokenAddress.toLowerCase()) {
    return { outcome: "mismatch", reason: "Fill output token does not match the request" };
  }
  if (evidence.recipient.toLowerCase() !== expected.recipientAddress.toLowerCase()) {
    return { outcome: "mismatch", reason: "Fill recipient does not match the request" };
  }

  let filled: bigint;
  let required: bigint;
  try {
    filled = BigInt(evidence.outputAmount);
    required = BigInt(expected.outputAmountBaseUnits);
  } catch {
    return { outcome: "mismatch", reason: "Fill amount is not an integer" };
  }
  if (filled < required) {
    return { outcome: "mismatch", reason: "Filled amount is below the requested amount" };
  }

  return { outcome: "filled" };
}

export function isReconciliationStuck(createdAt: number, now: number): boolean {
  return now - createdAt >= STUCK_AFTER_MS;
}

/**
 * A second hash is rejected while one attempt is in flight.
 * Resubmitting the same hash is a duplicate, not a new payment.
 */
export function decideAttemptAcceptance(input: {
  requestStatus: "open" | "pending" | "completed" | "expired" | "cancelled" | "failed";
  existingDepositTxnRef?: string;
  incomingDepositTxnRef: string;
  attemptCount: number;
}):
  | { ok: true; duplicate: boolean }
  | { ok: false; reason: string } {
  if (input.attemptCount >= MAX_ATTEMPTS_PER_REQUEST && !input.existingDepositTxnRef) {
    return { ok: false, reason: "Too many payment attempts for this request" };
  }
  if (input.requestStatus === "completed") {
    return { ok: false, reason: "Payment request already completed" };
  }
  if (input.requestStatus === "cancelled") {
    return { ok: false, reason: "Payment request is cancelled" };
  }
  if (input.requestStatus === "expired") {
    return { ok: false, reason: "Payment request is expired" };
  }
  if (input.requestStatus === "failed") {
    return { ok: false, reason: "Payment request can no longer be paid" };
  }
  if (input.requestStatus === "pending") {
    if (
      input.existingDepositTxnRef &&
      input.existingDepositTxnRef.toLowerCase() === input.incomingDepositTxnRef.toLowerCase()
    ) {
      return { ok: true, duplicate: true };
    }
    return { ok: false, reason: "A payment is already in progress for this request" };
  }
  if (
    input.existingDepositTxnRef &&
    input.existingDepositTxnRef.toLowerCase() === input.incomingDepositTxnRef.toLowerCase()
  ) {
    return { ok: true, duplicate: true };
  }
  return { ok: true, duplicate: false };
}
