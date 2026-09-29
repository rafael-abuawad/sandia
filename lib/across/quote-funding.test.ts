import { describe, expect, it } from "vitest";
import { quoteFundingGap } from "./client";

describe("quoteFundingGap", () => {
  it("reports a short balance before a short allowance", () => {
    expect(
      quoteFundingGap({
        checks: {
          balance: { actual: "0", expected: "100" },
          allowance: { actual: "0", expected: "100" },
        },
      }),
    ).toBe("balance");
  });

  it("reports allowance only when the balance can cover the quote", () => {
    expect(
      quoteFundingGap({
        checks: {
          balance: { actual: "100", expected: "100" },
          allowance: { actual: "0", expected: "100" },
        },
      }),
    ).toBe("allowance");
  });

  it("returns null when the wallet can already pay", () => {
    expect(
      quoteFundingGap({
        checks: {
          balance: { actual: "100", expected: "100" },
          allowance: { actual: "100", expected: "100" },
        },
      }),
    ).toBeNull();
  });
});
