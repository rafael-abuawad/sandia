import { usdMicrosToStroops } from "@/lib/stellar/amount";

export type BalanceStatus = "loading" | "error" | "ready" | "insufficient";

export function getBalanceStatus({
  loading,
  error,
  balance,
  amountMicros,
}: {
  loading: boolean;
  error: boolean;
  /** USDC stroops (7 decimals). */
  balance: bigint | undefined;
  amountMicros: number | null;
}): BalanceStatus {
  if (loading) return "loading";
  if (error || balance === undefined) return "error";
  if (amountMicros !== null && balance < usdMicrosToStroops(amountMicros)) return "insufficient";
  return "ready";
}

export function getSendBlocker({
  isSignedIn,
  balanceStatus,
  maxRecipients,
  withinCap,
}: {
  isSignedIn: boolean;
  balanceStatus: BalanceStatus;
  maxRecipients: number;
  withinCap: boolean;
}): string | null {
  if (!isSignedIn) return "Sign in to send USDC.";
  if (balanceStatus === "error") {
    return "Could not read your USDC balance. Check your connection and try again.";
  }
  if (balanceStatus === "loading") return "Checking your USDC balance…";
  if (balanceStatus === "insufficient") {
    return "This wallet doesn't have enough USDC. Lower the amount or add funds.";
  }
  if (!withinCap) return `A send can include at most ${maxRecipients} recipients.`;
  return null;
}
