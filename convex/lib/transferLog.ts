import { decodeEventLog, erc20Abi, type Hex, type Log } from "viem";

export type ParsedTransfer = {
  token: `0x${string}`;
  from: `0x${string}`;
  to: `0x${string}`;
  amount: bigint;
};

export function parseTransferLogs(logs: Log[]): ParsedTransfer[] {
  const found: ParsedTransfer[] = [];
  for (const log of logs) {
    if (!log.address) continue;
    try {
      const decoded = decodeEventLog({
        abi: erc20Abi,
        data: log.data,
        topics: log.topics,
      });
      if (decoded.eventName !== "Transfer") continue;
      const args = decoded.args as { from?: Hex; to?: Hex; value?: bigint };
      if (!args.from || !args.to || args.value === undefined) continue;
      found.push({
        token: log.address.toLowerCase() as `0x${string}`,
        from: args.from.toLowerCase() as `0x${string}`,
        to: args.to.toLowerCase() as `0x${string}`,
        amount: args.value,
      });
    } catch {
      // Not an ERC-20 Transfer.
    }
  }
  return found;
}

export function matchTransferToPayment(
  transfers: ParsedTransfer[],
  expected: {
    token: string;
    recipient: string;
    amount: string;
  },
): { ok: true; amount: bigint } | { ok: false; reason: string } {
  let required: bigint;
  try {
    required = BigInt(expected.amount);
  } catch {
    return { ok: false, reason: "Requested amount is not an integer" };
  }
  const match = transfers.find((transfer) => {
    return (
      transfer.token === expected.token.toLowerCase() &&
      transfer.to === expected.recipient.toLowerCase() &&
      transfer.amount >= required
    );
  });
  if (!match) {
    return {
      ok: false,
      reason: "Receipt has no USDG transfer to the recipient for the requested amount",
    };
  }
  return { ok: true, amount: match.amount };
}

export type ExpectedSend = { recipient: string; amount: string };

/** Every recipient must have a transfer for the exact base-unit amount. */
export function matchBatchTransfers(
  transfers: ParsedTransfer[],
  token: string,
  expected: ExpectedSend[],
): { ok: true } | { ok: false; reason: string } {
  const tokenLower = token.toLowerCase();
  for (const row of expected) {
    const amount = BigInt(row.amount);
    const match = transfers.find(
      (transfer) =>
        transfer.token === tokenLower &&
        transfer.to === row.recipient.toLowerCase() &&
        transfer.amount === amount,
    );
    if (!match) {
      return {
        ok: false,
        reason: `Missing USDG transfer of ${row.amount} to ${row.recipient}`,
      };
    }
  }
  return { ok: true };
}
