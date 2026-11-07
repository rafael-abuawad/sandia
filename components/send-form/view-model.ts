import { formatTokenAmountGrouped, parseUsdToMicros } from "@/lib/money";
import { MAX_SEND_RECIPIENTS } from "@/lib/stellar/constants";
import { getSendBlocker, type BalanceStatus } from "@/lib/send/view-state";
import type { RecipientRow, ReviewPayload } from "@/components/send-form/state";

export function getLiveTotalMicros(
  mode: "single" | "massive",
  singleAmount: string,
  rows: RecipientRow[],
): number | null {
  if (mode === "single") return tryParseAmount(singleAmount);

  let total = 0n;
  for (const row of rows) {
    const amount = tryParseAmount(row.amount);
    if (amount === null) return null;
    total += BigInt(amount);
  }
  return total > 0n && total <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(total) : null;
}

export function getBalanceMessage({
  isSignedIn,
  balanceStatus,
  balance,
  decimals,
}: {
  isSignedIn: boolean;
  balanceStatus: BalanceStatus;
  balance: bigint | undefined;
  decimals: number;
}): string | null {
  if (!isSignedIn) return null;
  if (balanceStatus === "error") return "Could not read your USDC balance.";
  if (balanceStatus === "loading" || balance === undefined) return "Checking your USDC balance…";

  const available = formatTokenAmountGrouped(balance.toString(), decimals);
  return `Available balance: ${available} USDC`;
}

export function canConfirmSend({
  review,
  confirming,
  pendingTransaction,
  isSignedIn,
  balanceStatus,
  withinCap,
}: {
  review: ReviewPayload | null;
  confirming: boolean;
  pendingTransaction: boolean;
  isSignedIn: boolean;
  balanceStatus: BalanceStatus;
  withinCap: boolean;
}): boolean {
  if (!review || confirming) return false;
  if (pendingTransaction) return true;
  return isSignedIn && balanceStatus === "ready" && withinCap;
}

export function getReviewBlocker({
  review,
  pendingTransaction,
  isSignedIn,
  balanceStatus,
  withinCap,
}: {
  review: ReviewPayload | null;
  pendingTransaction: boolean;
  isSignedIn: boolean;
  balanceStatus: BalanceStatus;
  withinCap: boolean;
}): string | null {
  if (!review || pendingTransaction) return null;
  return getSendBlocker({
    isSignedIn,
    balanceStatus,
    maxRecipients: MAX_SEND_RECIPIENTS,
    withinCap,
  });
}

function tryParseAmount(value: string): number | null {
  try {
    return parseUsdToMicros(value);
  } catch {
    return null;
  }
}
