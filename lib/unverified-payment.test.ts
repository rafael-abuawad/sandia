import { describe, expect, it } from "vitest";
import { parseStoredSentPayment, unverifiedPaymentMessage } from "./unverified-payment";

const HASH = "0x146dd994926266aded947d58baba8d8ee40ea59dbd00be45ced1a151769a193d";
const PAYER = "0xC14fF56E720f79d08413CE00533256433D2ED929";

describe("parseStoredSentPayment", () => {
  it("restores a direct USDG transfer", () => {
    const raw = JSON.stringify({
      kind: "direct",
      hash: HASH,
      chainId: 4663,
      payerAddress: PAYER,
    });
    expect(parseStoredSentPayment(raw)).toEqual({
      kind: "direct",
      hash: HASH,
      chainId: 4663,
      payerAddress: PAYER,
    });
  });

  it("drops a truncated hash", () => {
    const raw = JSON.stringify({
      kind: "direct",
      hash: "0x146d",
      chainId: 4663,
      payerAddress: PAYER,
    });
    expect(parseStoredSentPayment(raw)).toBe(null);
  });

  it("drops invalid JSON", () => {
    expect(parseStoredSentPayment("{")).toBe(null);
  });
});

describe("unverifiedPaymentMessage", () => {
  it("keeps the server reason and the do-not-pay-again warning as two sentences", () => {
    expect(unverifiedPaymentMessage(new Error("Same-chain pay only settles USDG"))).toBe(
      "Same-chain pay only settles USDG. Your payment was already sent, so don't pay again.",
    );
  });
});
