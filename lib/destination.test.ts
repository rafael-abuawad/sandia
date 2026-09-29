import { describe, expect, it } from "vitest";
import { isDirectUsdgPay, isRobinhoodUsdgAddress, ROBINHOOD_USDG } from "./destination";

describe("isRobinhoodUsdgAddress", () => {
  it("accepts the lowercase address stored on payment requests", () => {
    expect(isRobinhoodUsdgAddress(ROBINHOOD_USDG.address.toLowerCase())).toBe(true);
  });

  it("accepts the checksummed USDG address", () => {
    expect(isRobinhoodUsdgAddress(ROBINHOOD_USDG.address)).toBe(true);
  });

  it("rejects a different token", () => {
    expect(isRobinhoodUsdgAddress("0x833589fcd6edb6e08f4c7c32d4f71b54bda02913")).toBe(false);
  });
});

describe("isDirectUsdgPay", () => {
  it("is a same-chain USDG transfer on Robinhood", () => {
    expect(isDirectUsdgPay(ROBINHOOD_USDG.chainId, ROBINHOOD_USDG.address.toLowerCase())).toBe(
      true,
    );
    expect(isDirectUsdgPay(8453, ROBINHOOD_USDG.address)).toBe(false);
  });
});
