import { describe, expect, it } from "vitest";
import { vaultDepositGate } from "./vault-gate";

const usdg = "0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168";

describe("vaultDepositGate", () => {
  it("disables deposit when maxDeposit is zero", () => {
    expect(vaultDepositGate({ asset: usdg, usdg, maxDeposit: 0n }).depositEnabled).toBe(false);
  });

  it("enables deposit only for USDG with room", () => {
    expect(vaultDepositGate({ asset: usdg, usdg, maxDeposit: 1n }).depositEnabled).toBe(true);
    expect(
      vaultDepositGate({
        asset: "0x0000000000000000000000000000000000000001",
        usdg,
        maxDeposit: 10n,
      }).depositEnabled,
    ).toBe(false);
  });
});
