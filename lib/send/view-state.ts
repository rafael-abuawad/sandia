export type BalanceStatus = "loading" | "error" | "ready" | "insufficient";

/** `available` is USDC in dollars; `amountMicros` is the send total in USD micros. */
export function getBalanceStatus({
  loading,
  error,
  available,
  amountMicros,
}: {
  loading: boolean;
  error: boolean;
  available: number | undefined;
  amountMicros: number | null;
}): BalanceStatus {
  if (loading && available === undefined) return "loading";
  if (error || available === undefined) return "error";
  if (amountMicros !== null && Math.round(available * 1_000_000) < amountMicros)
    return "insufficient";
  return "ready";
}

export function getSendBlocker({
  isSignedIn,
  walletReady,
  balanceStatus,
  maxRecipients,
  withinCap,
}: {
  isSignedIn: boolean;
  walletReady: boolean;
  balanceStatus: BalanceStatus;
  maxRecipients: number;
  withinCap: boolean;
}): string | null {
  if (!isSignedIn) return "Sign in to send USDC.";
  if (!walletReady) return "Your wallet is still loading…";
  if (balanceStatus === "error")
    return "Could not read your balance. Check your connection and try again.";
  if (balanceStatus === "loading") return "Checking your balance…";
  if (balanceStatus === "insufficient") return "Not enough USDC. Lower the amount or add funds.";
  if (!withinCap) return `A send can include at most ${maxRecipients} recipients.`;
  return null;
}
