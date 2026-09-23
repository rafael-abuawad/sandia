import { describe, expect, it } from "vitest";
import { buildUsdgTransferCalls } from "./calls";

describe("buildUsdgTransferCalls", () => {
  it("rejects a bad address, a zero amount, and more than 20 recipients", () => {
    expect(() => buildUsdgTransferCalls([{ address: "nope", amountUsdMicros: 1 }])).toThrow(
      /valid address/,
    );
    expect(() =>
      buildUsdgTransferCalls([
        { address: "0x1111111111111111111111111111111111111111", amountUsdMicros: 0 },
      ]),
    ).toThrow(/greater than zero/);
    const many = Array.from({ length: 21 }, (_, index) => ({
      address: `0x${(index + 1).toString(16).padStart(40, "0")}`,
      amountUsdMicros: 1,
    }));
    expect(() => buildUsdgTransferCalls(many)).toThrow(/20/);
  });

  it("encodes one transfer per recipient", () => {
    const calls = buildUsdgTransferCalls([
      { address: "0x1111111111111111111111111111111111111111", amountUsdMicros: 1_500_000 },
      { address: "0x2222222222222222222222222222222222222222", amountUsdMicros: 2 },
    ]);
    expect(calls).toHaveLength(2);
    expect(calls[0]?.amount).toBe(1_500_000n);
    expect(calls[1]?.data.startsWith("0x")).toBe(true);
  });
});
