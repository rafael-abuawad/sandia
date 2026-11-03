import { parseUsdToMicros } from "@/lib/money";
import { formatUsd } from "@/lib/hyperliquid/math";
import type { BalanceStatus } from "@/lib/send/view-state";
import type { RecipientRow } from "@/components/send-form/state";

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
  available,
}: {
  isSignedIn: boolean;
  balanceStatus: BalanceStatus;
  available: number | undefined;
}): string | null {
  if (!isSignedIn) return null;
  if (balanceStatus === "error") return "Could not read your USDC balance.";
  if (balanceStatus === "loading" || available === undefined) return "Checking your balance…";
  return `${formatUsd(available)} available`;
}

function tryParseAmount(value: string): number | null {
  try {
    return parseUsdToMicros(value);
  } catch {
    return null;
  }
}
