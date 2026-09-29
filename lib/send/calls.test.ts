import { decodeFunctionData } from "viem";
import { afterEach, describe, expect, it } from "vitest";
import { ROBINHOOD_USDG } from "@/lib/destination";
import {
  buildSandiaSendCall,
  buildUsdgPaymentTransfer,
  buildUsdgTransferCalls,
  sandiaSendAbi,
} from "./calls";

const SEND = "0x3333333333333333333333333333333333333333";
const ALICE = "0x1111111111111111111111111111111111111111";
const BOB = "0x2222222222222222222222222222222222222222";

afterEach(() => {
  delete process.env.NEXT_PUBLIC_SANDIA_SEND_ADDRESS;
});

describe("buildUsdgTransferCalls", () => {
  it("rejects a bad address, a zero amount, and more than 128 recipients", () => {
    expect(() => buildUsdgTransferCalls([{ address: "nope", amountUsdMicros: 1 }])).toThrow(
      /valid address/,
    );
    expect(() => buildUsdgTransferCalls([{ address: ALICE, amountUsdMicros: 0 }])).toThrow(
      /greater than zero/,
    );
    const many = Array.from({ length: 129 }, (_, index) => ({
      address: `0x${(index + 1).toString(16).padStart(40, "0")}`,
      amountUsdMicros: 1,
    }));
    expect(() => buildUsdgTransferCalls(many)).toThrow(/128/);
  });

  it("encodes one transfer for a single recipient", () => {
    const calls = buildUsdgTransferCalls([{ address: ALICE, amountUsdMicros: 1_500_000 }]);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.amount).toBe(1_500_000n);
    expect(calls[0]?.data.startsWith("0xa9059cbb")).toBe(true);
  });
});

describe("buildSandiaSendCall", () => {
  it("encodes sandia_send for the batch total", () => {
    process.env.NEXT_PUBLIC_SANDIA_SEND_ADDRESS = SEND;
    const call = buildSandiaSendCall([
      { address: ALICE, amountUsdMicros: 1_500_000 },
      { address: BOB, amountUsdMicros: 2 },
    ]);
    expect(call.to).toBe(SEND);
    expect(call.value).toBe(0n);
    expect(call.total).toBe(1_500_002n);
    const decoded = decodeFunctionData({ abi: sandiaSendAbi, data: call.data });
    expect(decoded.functionName).toBe("sandia_send");
    expect(decoded.args[0]).toEqual([
      { account: ALICE, amount: 1_500_000n },
      { account: BOB, amount: 2n },
    ]);
    expect(decoded.args[1]).toBe(ROBINHOOD_USDG.address);
  });

  it("rejects one recipient, a duplicate, and a missing contract address", () => {
    process.env.NEXT_PUBLIC_SANDIA_SEND_ADDRESS = SEND;
    expect(() => buildSandiaSendCall([{ address: ALICE, amountUsdMicros: 1 }])).toThrow(
      /at least two/,
    );
    expect(() =>
      buildSandiaSendCall([
        { address: ALICE, amountUsdMicros: 1 },
        { address: ALICE.toLowerCase(), amountUsdMicros: 2 },
      ]),
    ).toThrow(/once/);
    delete process.env.NEXT_PUBLIC_SANDIA_SEND_ADDRESS;
    expect(() =>
      buildSandiaSendCall([
        { address: ALICE, amountUsdMicros: 1 },
        { address: BOB, amountUsdMicros: 2 },
      ]),
    ).toThrow(/not configured/);
  });
});

describe("buildUsdgPaymentTransfer", () => {
  it("encodes the request amount in base units", () => {
    const call = buildUsdgPaymentTransfer(ALICE, "2500000");
    expect(call.amount).toBe(2_500_000n);
    expect(call.value).toBe(0n);
    expect(call.data.startsWith("0xa9059cbb")).toBe(true);
  });
});
