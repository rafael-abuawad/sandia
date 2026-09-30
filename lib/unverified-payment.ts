import type { Hex } from "viem";
import type { SentPayment } from "@/components/pay-flow/state";
import { userFacingError } from "@/lib/user-facing-error";

const HASH = /^0x[a-fA-F0-9]{64}$/;
const ADDRESS = /^0x[a-fA-F0-9]{40}$/;

function isTxHash(value: unknown): value is Hex {
  return typeof value === "string" && HASH.test(value);
}

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readDetails(value: unknown): SentPayment | null {
  if (!isRecord(value)) return null;
  const { hash, chainId, payerAddress, kind } = value;
  if (!isTxHash(hash)) return null;
  if (typeof payerAddress !== "string" || !ADDRESS.test(payerAddress)) return null;
  if (typeof chainId !== "number" || !Number.isInteger(chainId)) return null;
  if (kind === "direct" || kind === "eth") {
    return { kind, hash, chainId, payerAddress };
  }
  if (kind !== "across" || !isRecord(value.details)) return null;
  const details = value.details;
  if (typeof details.originChainId !== "number" || !Number.isInteger(details.originChainId)) {
    return null;
  }
  if (typeof details.inputToken !== "string" || !details.inputToken) return null;
  if (typeof details.quotedInputAmount !== "string") return null;
  if (typeof details.expectedOutputAmount !== "string") return null;
  if (typeof details.minOutputAmount !== "string") return null;
  if (typeof details.feesJson !== "string") return null;
  return {
    kind: "across",
    hash,
    chainId,
    payerAddress,
    details: {
      originChainId: details.originChainId,
      inputToken: details.inputToken,
      quotedInputAmount: details.quotedInputAmount,
      expectedOutputAmount: details.expectedOutputAmount,
      minOutputAmount: details.minOutputAmount,
      feesJson: details.feesJson,
      quoteId: typeof details.quoteId === "string" ? details.quoteId : undefined,
    },
  };
}

/** Restore a wallet payment that was sent but not yet recorded. Invalid JSON is dropped. */
export function parseStoredSentPayment(raw: string): SentPayment | null {
  try {
    return readDetails(JSON.parse(raw) as unknown);
  } catch {
    return null;
  }
}
