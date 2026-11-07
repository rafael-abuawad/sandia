import { userFacingError } from "@/lib/user-facing-error";
import { isStellarAccount } from "@/lib/stellar/strkey";

/** A signed Stellar payment that may already be on the network. It's verified, never paid again. */
export type SentPayment = {
  hash: string;
  payerAddress: string;
  /** Unix seconds. After this, a payment the network hasn't seen can never land. */
  expiresAt: number;
};

const HASH = /^[0-9a-f]{64}$/;

export function unverifiedPaymentKey(publicId: string): string {
  return `sandia-unverified:${publicId}`;
}

export function trackedDepositKey(publicId: string): string {
  return `sandia-deposit:${publicId}`;
}

/** Keep the warning and the retry instruction in two sentences. */
export function unverifiedPaymentMessage(error: unknown): string {
  const detail = userFacingError(error, "The payment could not be confirmed yet.").replace(
    /[.?!]\s*$/,
    "",
  );
  return `${detail}. Your payment was already sent, so don't pay again.`;
}

export const RESTORED_PAYMENT_MESSAGE =
  "Your payment was already sent, so don't pay again. Check it again to confirm it.";

/** Restore a wallet payment that was sent but not yet recorded. Invalid JSON is dropped. */
export function parseStoredSentPayment(raw: string): SentPayment | null {
  try {
    const value = JSON.parse(raw) as Partial<SentPayment> | null;
    if (typeof value !== "object" || value === null) return null;
    const { hash, payerAddress, expiresAt } = value;
    if (typeof hash !== "string" || !HASH.test(hash)) return null;
    if (typeof payerAddress !== "string" || !isStellarAccount(payerAddress)) return null;
    if (typeof expiresAt !== "number" || !Number.isInteger(expiresAt)) return null;
    return { hash, payerAddress, expiresAt };
  } catch {
    return null;
  }
}
