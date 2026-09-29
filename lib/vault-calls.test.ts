import { getAddress } from "viem";
import { describe, expect, it } from "vitest";
import {
  buildVaultApprove,
  buildVaultDeposit,
  buildVaultRedeem,
  buildVaultWithdraw,
  chooseVaultExit,
  parseUsdgBaseUnits,
  VAULT_ADDRESS,
} from "./vault-calls";
import { ROBINHOOD_USDG } from "./destination";

const account = getAddress("0x1111111111111111111111111111111111111111");

describe("parseUsdgBaseUnits", () => {
  it("parses whole and fractional USDG", () => {
    expect(parseUsdgBaseUnits("1")).toBe(1_000_000n);
    expect(parseUsdgBaseUnits("1.5")).toBe(1_500_000n);
    expect(parseUsdgBaseUnits("1,234.25")).toBe(1_234_250_000n);
  });

  it("rejects zero, junk, and more than 6 decimal places", () => {
    expect(() => parseUsdgBaseUnits("0")).toThrow(/greater than zero/);
    expect(() => parseUsdgBaseUnits("abc")).toThrow(/valid USDG/);
    expect(() => parseUsdgBaseUnits("1.1234567")).toThrow(/6 decimal/);
  });
});

describe("vault calls", () => {
  it("approves the vault for the USDG amount", () => {
    const call = buildVaultApprove(1_000_000n);
    expect(call.to).toBe(getAddress(ROBINHOOD_USDG.address));
    expect(call.value).toBe(0n);
    expect(call.data.startsWith("0x095ea7b3")).toBe(true);
  });

  it("deposits, withdraws, and redeems for the same account", () => {
    expect(buildVaultDeposit(1n, account).to).toBe(VAULT_ADDRESS);
    expect(buildVaultWithdraw(1n, account).to).toBe(VAULT_ADDRESS);
    expect(buildVaultRedeem(1n, account).to).toBe(VAULT_ADDRESS);
    expect(buildVaultDeposit(1n, account).data).not.toBe(buildVaultWithdraw(1n, account).data);
  });
});

describe("chooseVaultExit", () => {
  it("withdraws a partial amount and redeems the full position", () => {
    expect(chooseVaultExit({ assets: 4n, positionAssets: 10n, shares: 8n })).toEqual({
      kind: "withdraw",
      assets: 4n,
    });
    expect(chooseVaultExit({ assets: 10n, positionAssets: 10n, shares: 8n })).toEqual({
      kind: "redeem",
      shares: 8n,
      assets: 10n,
    });
  });

  it("rejects an empty position and an amount above it", () => {
    expect(() => chooseVaultExit({ assets: 1n, positionAssets: 0n, shares: 0n })).toThrow(
      /nothing in the vault/,
    );
    expect(() => chooseVaultExit({ assets: 11n, positionAssets: 10n, shares: 8n })).toThrow(
      /that much/,
    );
  });
});
