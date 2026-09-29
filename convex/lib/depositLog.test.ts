import { encodeAbiParameters, encodeEventTopics, type Log } from "viem";
import { describe, expect, it } from "vitest";
import { matchDepositToRequest, parseDepositLogs, v3FundsDeposited } from "./depositLog";

const recipient = "0x1111111111111111111111111111111111111111";
const outputToken = "0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168";
const depositor = "0x2222222222222222222222222222222222222222";

function depositLog(overrides?: {
  recipient?: `0x${string}`;
  chainId?: bigint;
  amount?: bigint;
  message?: `0x${string}`;
}): Log {
  const topics = encodeEventTopics({
    abi: [v3FundsDeposited],
    eventName: "V3FundsDeposited",
    args: {
      destinationChainId: overrides?.chainId ?? 4663n,
      depositId: 1,
      depositor,
    },
  });
  const data = encodeAbiParameters(
    [
      { type: "address" },
      { type: "address" },
      { type: "uint256" },
      { type: "uint256" },
      { type: "uint32" },
      { type: "uint32" },
      { type: "uint32" },
      { type: "address" },
      { type: "address" },
      { type: "bytes" },
    ],
    [
      depositor,
      outputToken,
      1_000_000n,
      overrides?.amount ?? 1_000_000n,
      1,
      2,
      0,
      overrides?.recipient ?? recipient,
      "0x0000000000000000000000000000000000000000",
      overrides?.message ?? "0x",
    ],
  );
  return {
    address: "0x0000000000000000000000000000000000000001",
    topics,
    data,
  } as unknown as Log;
}

const expected = {
  destinationChainId: 4663,
  destinationTokenAddress: outputToken,
  recipientAddress: recipient,
  outputAmountBaseUnits: "1000000",
};

describe("deposit logs", () => {
  it("accepts a matching Across deposit", () => {
    const parsed = parseDepositLogs([depositLog()]);
    expect(matchDepositToRequest(parsed, expected).ok).toBe(true);
  });

  it("rejects an empty receipt, the wrong recipient, and the wrong chain", () => {
    expect(matchDepositToRequest([], expected).ok).toBe(false);
    expect(
      matchDepositToRequest(
        parseDepositLogs([depositLog({ recipient: "0x3333333333333333333333333333333333333333" })]),
        expected,
      ).ok,
    ).toBe(false);
    expect(
      matchDepositToRequest(parseDepositLogs([depositLog({ chainId: 8453n })]), expected).ok,
    ).toBe(false);
  });

  it("accepts a deposit to an Across destination handler that carries a message", () => {
    const handler = "0xa8ad2e87e2043711d8bec77e8bc3e2683c0ab6bd";
    const withMessage = parseDepositLogs([depositLog({ recipient: handler, message: "0x1234" })]);
    expect(matchDepositToRequest(withMessage, expected).ok).toBe(true);

    const short = parseDepositLogs([
      depositLog({ recipient: handler, message: "0x1234", amount: 999_999n }),
    ]);
    expect(matchDepositToRequest(short, expected).ok).toBe(false);
  });
});
