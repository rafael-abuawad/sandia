import { formatTokenAmountGrouped, parseUsdToMicros } from "@/lib/money";
import { MAX_SEND_RECIPIENTS } from "@/lib/send/calls";
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
  if (balanceStatus === "error") return "Could not read your USDG balance.";
  if (balanceStatus === "loading" || balance === undefined) return "Checking your USDG balance…";

  const available = formatTokenAmountGrouped(balance.toString(), decimals);
  return `Available balance: ${available} USDG`;
}

export function canConfirmSend({
  review,
  confirming,
  pendingTransaction,
  isSignedIn,
  chainReady,
  balanceStatus,
  withinCap,
  sendConfigured,
}: {
  review: ReviewPayload | null;
  confirming: boolean;
  pendingTransaction: boolean;
  isSignedIn: boolean;
  chainReady: boolean;
  balanceStatus: BalanceStatus;
  withinCap: boolean;
  sendConfigured: boolean;
}): boolean {
  if (!review || confirming) return false;
  if (pendingTransaction) return true;
  return isSignedIn && chainReady && balanceStatus === "ready" && withinCap && sendConfigured;
}

export function getReviewBlocker({
  review,
  pendingTransaction,
  isSignedIn,
  chainReady,
  balanceStatus,
  withinCap,
  sendConfigured,
}: {
  review: ReviewPayload | null;
  pendingTransaction: boolean;
  isSignedIn: boolean;
  chainReady: boolean;
  balanceStatus: BalanceStatus;
  withinCap: boolean;
  sendConfigured: boolean;
}): string | null {
  if (!review || pendingTransaction) return null;
  return getSendBlocker({
    isSignedIn,
    chainReady,
    balanceStatus,
    maxRecipients: MAX_SEND_RECIPIENTS,
    withinCap,
    sendConfigured,
  });
}

function tryParseAmount(value: string): number | null {
  try {
    return parseUsdToMicros(value);
  } catch {
    return null;
  }
}
