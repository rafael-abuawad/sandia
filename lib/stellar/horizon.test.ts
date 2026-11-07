import { describe, expect, it } from "vitest";
import { STELLAR_USDC } from "./constants";
import { MEMO_REQUIRED_DATA_VALUE, parseAccountState, submitErrorFromResult } from "./horizon";

const usdc = {
  asset_type: "credit_alphanum4",
  asset_code: "USDC",
  asset_issuer: STELLAR_USDC.issuer,
};

describe("parseAccountState", () => {
  it("reads spendable USDC in stroops", () => {
    const state = parseAccountState({
      sequence: "42",
      balances: [
        { asset_type: "native", balance: "5.0000000" },
        { ...usdc, balance: "10.5000000", selling_liabilities: "0.5000000" },
      ],
    });
    expect(state).toMatchObject({
      exists: true,
      hasUsdcTrustline: true,
      usdcBalance: 100_000_000n,
      memoRequired: false,
      sequence: "42",
    });
  });

  it("ignores USDC from another issuer", () => {
    const state = parseAccountState({
      balances: [{ ...usdc, asset_issuer: "GOTHER", balance: "99.0000000" }],
    });
    expect(state.hasUsdcTrustline).toBe(false);
    expect(state.usdcBalance).toBe(0n);
  });

  it("treats a revoked trustline as unusable", () => {
    const state = parseAccountState({
      balances: [{ ...usdc, balance: "1.0000000", is_authorized: false }],
    });
    expect(state.hasUsdcTrustline).toBe(false);
  });

  it("detects SEP-29 memo-required accounts", () => {
    const state = parseAccountState({
      balances: [],
      data: { "config.memo_required": MEMO_REQUIRED_DATA_VALUE },
    });
    expect(state.memoRequired).toBe(true);
  });
});

describe("submitErrorFromResult", () => {
  it("explains known result codes", () => {
    const error = submitErrorFromResult({
      result_codes: { transaction: "tx_failed", operations: ["op_no_trust"] },
    });
    expect(error.message).toContain("hasn't enabled USDC");
    expect(error.indeterminate).toBe(false);
  });

  it("reads failures inside a fee-bump, as Horizon reports them", () => {
    const noTrust = submitErrorFromResult({
      result_codes: {
        transaction: "tx_fee_bump_inner_failed",
        inner_transaction: "tx_failed",
        operations: ["op_no_trust"],
      },
    });
    expect(noTrust.message).toContain("hasn't enabled USDC");
    const badSeq = submitErrorFromResult({
      result_codes: { transaction: "tx_fee_bump_inner_failed", inner_transaction: "tx_bad_seq" },
    });
    expect(badSeq.message).toContain("went first");
  });

  it("falls back for unknown codes", () => {
    expect(submitErrorFromResult({}).message).toContain("rejected");
  });
});
