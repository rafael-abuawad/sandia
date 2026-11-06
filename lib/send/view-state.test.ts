import { describe, expect, it } from "vitest";
import { getBalanceStatus, getSendBlocker } from "./view-state";

describe("getBalanceStatus", () => {
  it("compares 6-decimal amounts with the 7-decimal balance", () => {
    const amountMicros = 1_000_000;
    expect(
      getBalanceStatus({ loading: false, error: false, balance: 10_000_000n, amountMicros }),
    ).toBe("ready");
    expect(
      getBalanceStatus({ loading: false, error: false, balance: 9_999_999n, amountMicros }),
    ).toBe("insufficient");
  });

  it("reports loading and error states", () => {
    expect(
      getBalanceStatus({ loading: true, error: false, balance: undefined, amountMicros: 1 }),
    ).toBe("loading");
    expect(
      getBalanceStatus({ loading: false, error: true, balance: undefined, amountMicros: 1 }),
    ).toBe("error");
  });
});

describe("getSendBlocker", () => {
  const base = {
    isSignedIn: true,
    balanceStatus: "ready" as const,
    maxRecipients: 100,
    withinCap: true,
  };

  it("allows a ready send", () => {
    expect(getSendBlocker(base)).toBeNull();
  });

  it("explains each blocker", () => {
    expect(getSendBlocker({ ...base, isSignedIn: false })).toContain("Sign in");
    expect(getSendBlocker({ ...base, balanceStatus: "insufficient" })).toContain("enough USDC");
    expect(getSendBlocker({ ...base, withinCap: false })).toContain("at most 100");
  });
});
