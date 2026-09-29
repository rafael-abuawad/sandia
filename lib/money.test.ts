import { describe, expect, it } from "vitest";
import { formatUsdFromMicros, parseUsdToMicros } from "./money";
import { usdMicrosToTokenBaseUnits } from "../convex/paymentRequests";

describe("money", () => {
  it("round-trips USD micros and converts 6-decimal USDG 1:1", () => {
    expect(parseUsdToMicros("12.5")).toBe(12_500_000);
    expect(formatUsdFromMicros(12_500_000)).toBe("12.5");
    expect(usdMicrosToTokenBaseUnits(12_500_000, 6)).toBe("12500000");
  });

  it("rejects a zero amount", () => {
    expect(() => parseUsdToMicros("0")).toThrow(/greater than zero/);
  });
});
