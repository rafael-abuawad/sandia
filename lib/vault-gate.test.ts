import { describe, expect, it } from "vitest";
import { vaultDepositGate, vaultExitGate } from "./vault-gate";

describe("vaultDepositGate", () => {
  it("allows a deposit when both gates are open", () => {
    expect(vaultDepositGate({ canSendAssets: true, canReceiveShares: true }).enabled).toBe(true);
  });

  it("blocks a deposit when either gate is closed", () => {
    expect(vaultDepositGate({ canSendAssets: false, canReceiveShares: true }).enabled).toBe(false);
    expect(vaultDepositGate({ canSendAssets: true, canReceiveShares: false }).enabled).toBe(false);
  });
});

describe("vaultExitGate", () => {
  it("allows an exit when both gates are open", () => {
    expect(vaultExitGate({ canSendShares: true, canReceiveAssets: true }).enabled).toBe(true);
  });

  it("blocks an exit when either gate is closed", () => {
    expect(vaultExitGate({ canSendShares: false, canReceiveAssets: true }).enabled).toBe(false);
    expect(vaultExitGate({ canSendShares: true, canReceiveAssets: false }).enabled).toBe(false);
  });
});
