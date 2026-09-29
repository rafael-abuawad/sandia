import { describe, expect, it } from "vitest";
import { ROBINHOOD_USDG } from "./destination";
import { privyConfig } from "./privy-config";

describe("Privy chain configuration", () => {
  it("starts embedded wallets on the USDG send chain", () => {
    expect(privyConfig.defaultChain?.id).toBe(ROBINHOOD_USDG.chainId);
  });
});
