import { matchTransferToPayment, type ParsedTransfer } from "./transferLog";
import { ROBINHOOD_CHAIN_ID } from "./fillProof";

export type AcrossDepositRecord = {
  status?: string;
  fillTxnRef?: string;
  fillTx?: string;
  destinationChainId?: number;
  originChainId?: number;
  depositTxnRef?: string;
  depositTxHash?: string;
  recipient?: string;
  outputToken?: string;
  outputAmount?: string;
};

function asObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function asText(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function asChainId(value: unknown): number | undefined {
  const id = typeof value === "string" ? Number(value) : value;
  return typeof id === "number" && Number.isSafeInteger(id) ? id : undefined;
}

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

/**
 * Fill evidence read from the Robinhood settlement receipt. The payee must receive the
 * requested USDG in that transaction, whether the relayer pays directly or a handler forwards it.
 */
export function transferFillEvidence(
  fillTxnRef: string,
  expected: { token: string; recipient: string; amount: string },
  transfers: ParsedTransfer[],
): AcrossDepositRecord {
  const matched = matchTransferToPayment(transfers, expected);
  return {
    status: "filled",
    fillTxnRef,
    destinationChainId: ROBINHOOD_CHAIN_ID,
    outputToken: expected.token,
    recipient: matched.ok ? expected.recipient : ZERO_ADDRESS,
    outputAmount: matched.ok ? matched.amount.toString() : "0",
  };
}

/** Across `/deposit` nests the record under `deposit` and sends chain ids as strings. */
export function parseAcrossDeposit(body: unknown): AcrossDepositRecord | null {
  const outer = asObject(body);
  const raw = asObject(outer?.deposit) ?? outer;
  const status = asText(raw?.status);
  if (!raw || !status) return null;
  return {
    status,
    fillTxnRef: asText(raw.fillTxnRef),
    fillTx: asText(raw.fillTx),
    destinationChainId: asChainId(raw.destinationChainId),
    originChainId: asChainId(raw.originChainId),
    depositTxnRef: asText(raw.depositTxnRef),
    depositTxHash: asText(raw.depositTxHash),
    recipient: asText(raw.recipient),
    outputToken: asText(raw.outputToken),
    outputAmount: asText(raw.outputAmount),
  };
}
