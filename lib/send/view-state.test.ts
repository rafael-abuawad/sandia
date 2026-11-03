import { describe, expect, it } from "vitest";
import { getBalanceStatus, getSendBlocker } from "./view-state";

describe("getBalanceStatus", () => {
  it("compares dollars against micros", () => {
    expect(
      getBalanceStatus({ loading: false, error: false, available: 10, amountMicros: 10_000_000 }),
    ).toBe("ready");
    expect(
      getBalanceStatus({ loading: false, error: false, available: 9.99, amountMicros: 10_000_000 }),
    ).toBe("insufficient");
  });

  it("keeps a known balance while refetching", () => {
    expect(
      getBalanceStatus({ loading: true, error: false, available: 5, amountMicros: null }),
    ).toBe("ready");
    expect(
      getBalanceStatus({ loading: true, error: false, available: undefined, amountMicros: null }),
    ).toBe("loading");
  });
});

describe("getSendBlocker", () => {
  const base = {
    isSignedIn: true,
    walletReady: true,
    balanceStatus: "ready" as const,
    maxRecipients: 20,
    withinCap: true,
  };
  it("allows a ready send", () => {
    expect(getSendBlocker(base)).toBeNull();
  });
  it("explains each blocker", () => {
    expect(getSendBlocker({ ...base, isSignedIn: false })).toBe("Sign in to send USDC.");
    expect(getSendBlocker({ ...base, balanceStatus: "insufficient" })).toMatch(/Not enough USDC/);
    expect(getSendBlocker({ ...base, withinCap: false })).toMatch(/at most 20/);
  });
});
