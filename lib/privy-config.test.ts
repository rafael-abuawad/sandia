import { describe, expect, it } from "vitest";
import { HL_SIGNATURE_CHAIN_ID } from "./hyperliquid/config";
import { privyConfig } from "./privy-config";

describe("Privy chain configuration", () => {
  it("starts embedded wallets on the chain Hyperliquid user actions are signed for", () => {
    expect(privyConfig.defaultChain?.id).toBe(Number.parseInt(HL_SIGNATURE_CHAIN_ID, 16));
  });
});
