export type BalanceStatus = "loading" | "error" | "ready" | "insufficient";

export function getBalanceStatus({
  loading,
  error,
  balance,
  amountMicros,
}: {
  loading: boolean;
  error: boolean;
  balance: bigint | undefined;
  amountMicros: number | null;
}): BalanceStatus {
  if (loading) return "loading";
  if (error || balance === undefined) return "error";
  if (amountMicros !== null && balance < BigInt(amountMicros)) return "insufficient";
  return "ready";
}

export function getSendBlocker({
  isSignedIn,
  chainReady,
  balanceStatus,
  maxRecipients,
  withinCap,
  sendConfigured,
}: {
  isSignedIn: boolean;
  chainReady: boolean;
  balanceStatus: BalanceStatus;
  maxRecipients: number;
  withinCap: boolean;
  sendConfigured: boolean;
}): string | null {
  if (!isSignedIn) return "Sign in to send USDG.";
  if (!chainReady) return "Switch your wallet to Robinhood Chain, then confirm this send.";
  if (balanceStatus === "error") {
    return "Could not read your USDG balance. Check your connection and try again.";
  }
  if (balanceStatus === "loading") return "Checking your USDG balance…";
  if (balanceStatus === "insufficient") {
    return "This wallet doesn't have enough USDG on Robinhood Chain. Lower the amount or add funds.";
  }
  if (!withinCap) return `A send can include at most ${maxRecipients} recipients.`;
  if (!sendConfigured) return "Sandia Send is not configured.";
  return null;
}
