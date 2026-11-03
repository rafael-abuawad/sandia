import { sendErrorMessage } from "@/lib/send/errors";

/** Turn Hyperliquid and wallet errors into one short sentence. */
export function hlErrorMessage(error: unknown, fallback: string): string {
  const raw = error instanceof Error ? error.message : typeof error === "string" ? error : "";
  const text = raw.toLowerCase();
  if (text.includes("must deposit") || text.includes("does not exist")) {
    if (text.includes("api wallet") || text.includes("agent")) {
      return "Trading needs to be re-enabled on this device.";
    }
    return "Add USDC to your account first.";
  }
  if (text.includes("insufficient margin") || text.includes("insufficient balance")) {
    return "Not enough USDC for this trade. Lower the amount or the leverage.";
  }
  if (text.includes("builder fee has not been approved")) {
    return "Trading needs to be re-enabled on this device.";
  }
  if (text.includes("could not immediately match")) {
    return "The price moved before the order filled. Try again.";
  }
  if (text.includes("reduce only")) return "This position is already closed.";
  if (text.includes("minimum value")) return "Orders must be worth at least $10.";
  if (text.includes("market is closed") || text.includes("halted")) {
    return "This market is closed right now.";
  }
  return sendErrorMessage(error, fallback);
}
