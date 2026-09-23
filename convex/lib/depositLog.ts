import {
  decodeEventLog,
  type Hex,
  type Log,
} from "viem";

export type ParsedDeposit = {
  outputToken: `0x${string}`;
  outputAmount: bigint;
  destinationChainId: number;
  recipient: `0x${string}`;
  depositor: `0x${string}`;
};

export type DepositMatch =
  | { ok: true; deposit: ParsedDeposit }
  | { ok: false; reason: string };

export const v3FundsDeposited = {
  type: "event",
  name: "V3FundsDeposited",
  inputs: [
    { name: "inputToken", type: "address", indexed: false },
    { name: "outputToken", type: "address", indexed: false },
    { name: "inputAmount", type: "uint256", indexed: false },
    { name: "outputAmount", type: "uint256", indexed: false },
    { name: "destinationChainId", type: "uint256", indexed: true },
    { name: "depositId", type: "uint32", indexed: true },
    { name: "quoteTimestamp", type: "uint32", indexed: false },
    { name: "fillDeadline", type: "uint32", indexed: false },
    { name: "exclusivityDeadline", type: "uint32", indexed: false },
    { name: "depositor", type: "address", indexed: true },
    { name: "recipient", type: "address", indexed: false },
    { name: "exclusiveRelayer", type: "address", indexed: false },
    { name: "message", type: "bytes", indexed: false },
  ],
} as const;

const fundsDepositedBytes32 = {
  type: "event",
  name: "FundsDeposited",
  inputs: [
    { name: "inputToken", type: "bytes32", indexed: false },
    { name: "outputToken", type: "bytes32", indexed: false },
    { name: "inputAmount", type: "uint256", indexed: false },
    { name: "outputAmount", type: "uint256", indexed: false },
    { name: "destinationChainId", type: "uint256", indexed: true },
    { name: "depositId", type: "uint256", indexed: true },
    { name: "quoteTimestamp", type: "uint32", indexed: false },
    { name: "fillDeadline", type: "uint32", indexed: false },
    { name: "exclusivityDeadline", type: "uint32", indexed: false },
    { name: "depositor", type: "bytes32", indexed: true },
    { name: "recipient", type: "bytes32", indexed: false },
    { name: "exclusiveRelayer", type: "bytes32", indexed: false },
    { name: "message", type: "bytes", indexed: false },
  ],
} as const;

function addressFromBytes32(value: Hex): `0x${string}` {
  const hex = value.toLowerCase().replace(/^0x/, "");
  return `0x${hex.slice(-40)}` as `0x${string}`;
}

function asAddress(value: unknown): `0x${string}` | null {
  if (typeof value !== "string" || !value.startsWith("0x")) return null;
  if (value.length === 42) return value.toLowerCase() as `0x${string}`;
  if (value.length === 66) return addressFromBytes32(value as Hex);
  return null;
}

export function parseDepositLogs(logs: Log[]): ParsedDeposit[] {
  const found: ParsedDeposit[] = [];
  for (const log of logs) {
    for (const abi of [v3FundsDeposited, fundsDepositedBytes32]) {
      try {
        const decoded = decodeEventLog({
          abi: [abi],
          data: log.data,
          topics: log.topics,
        });
        const args = decoded.args as {
          outputToken?: unknown;
          outputAmount?: bigint;
          destinationChainId?: bigint;
          recipient?: unknown;
          depositor?: unknown;
        };
        const outputToken = asAddress(args.outputToken);
        const recipient = asAddress(args.recipient);
        const depositor = asAddress(args.depositor);
        if (!outputToken || !recipient || !depositor) continue;
        if (args.outputAmount === undefined || args.destinationChainId === undefined) continue;
        found.push({
          outputToken,
          outputAmount: args.outputAmount,
          destinationChainId: Number(args.destinationChainId),
          recipient,
          depositor,
        });
        break;
      } catch {
        // This log is not the event we tried.
      }
    }
  }
  return found;
}

export function matchDepositToRequest(
  deposits: ParsedDeposit[],
  expected: {
    destinationChainId: number;
    destinationTokenAddress: string;
    recipientAddress: string;
    outputAmountBaseUnits: string;
  },
): DepositMatch {
  if (deposits.length === 0) {
    return { ok: false, reason: "Deposit transaction has no Across deposit event" };
  }
  const required = BigInt(expected.outputAmountBaseUnits);
  const match = deposits.find((deposit) => {
    return (
      deposit.destinationChainId === expected.destinationChainId &&
      deposit.outputToken.toLowerCase() === expected.destinationTokenAddress.toLowerCase() &&
      deposit.recipient.toLowerCase() === expected.recipientAddress.toLowerCase() &&
      deposit.outputAmount >= required
    );
  });
  if (!match) {
    return {
      ok: false,
      reason: "Deposit transaction does not pay this request's recipient, token, chain, and amount",
    };
  }
  return { ok: true, deposit: match };
}
