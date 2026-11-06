import { describe, expect, it } from "vitest";
import { amountToStroops, parseUsdcStroops, stroopsToAmount, usdMicrosToStroops } from "./amount";

describe("Stellar amounts", () => {
  it("scales 6-decimal USD micros to 7-decimal USDC", () => {
    expect(usdMicrosToStroops(1_000_000)).toBe(10_000_000n);
    expect(usdMicrosToStroops(1)).toBe(10n);
    expect(() => usdMicrosToStroops(0)).toThrow();
    expect(() => usdMicrosToStroops(1.5)).toThrow();
  });

  it("formats and parses operation amounts", () => {
    expect(stroopsToAmount(125_000_000n)).toBe("12.5000000");
    expect(stroopsToAmount(1n)).toBe("0.0000001");
    expect(amountToStroops("12.5000000")).toBe(125_000_000n);
    expect(amountToStroops("7")).toBe(70_000_000n);
    expect(() => amountToStroops("1.00000001")).toThrow();
  });

  it("parses USD input", () => {
    expect(parseUsdcStroops("1,000.50")).toBe(10_005_000_000n);
    expect(() => parseUsdcStroops("0")).toThrow();
    expect(() => parseUsdcStroops("1.0000001")).toThrow();
  });
});
