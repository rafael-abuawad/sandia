import { describe, expect, it } from "vitest";
import { acrossAppFeeParams } from "./appFee";

describe("acrossAppFeeParams", () => {
  it("is off until a fee is configured", () => {
    expect(acrossAppFeeParams({})).toBeNull();
  });

  it("needs both a fee and a recipient", () => {
    const recipient = "0x00000000000000000000000000000000000000aa";
    expect(acrossAppFeeParams({ ACROSS_APP_FEE: "0.001" })).toBeNull();
    expect(
      acrossAppFeeParams({ ACROSS_APP_FEE: "0.001", ACROSS_APP_FEE_RECIPIENT: recipient }),
    ).toEqual({
      appFee: "0.001",
      appFeeRecipient: recipient,
    });
  });

  it("rejects fees above 1% and malformed recipients", () => {
    expect(acrossAppFeeParams({ ACROSS_APP_FEE: "0.5" })).toBeNull();
    expect(
      acrossAppFeeParams({ ACROSS_APP_FEE: "0.001", ACROSS_APP_FEE_RECIPIENT: "nope" }),
    ).toBeNull();
  });
});
