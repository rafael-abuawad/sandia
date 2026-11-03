import { describe, expect, it } from "vitest";
import { parseStoredSentPayment, unverifiedPaymentMessage } from "./unverified-payment";

const HASH = "0x146dd994926266aded947d58baba8d8ee40ea59dbd00be45ced1a151769a193d";
const PAYER = "0xC14fF56E720f79d08413CE00533256433D2ED929";

describe("parseStoredSentPayment", () => {
  const details = {
    originChainId: 8453,
    inputToken: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    quotedInputAmount: "10050000",
    expectedOutputAmount: "10000000",
    minOutputAmount: "10000000",
    feesJson: "{}",
  };

  it("restores an Across deposit", () => {
    const raw = JSON.stringify({
      kind: "across",
      hash: HASH,
      chainId: 8453,
      payerAddress: PAYER,
      details,
    });
    expect(parseStoredSentPayment(raw)).toMatchObject({
      kind: "across",
      hash: HASH,
      chainId: 8453,
    });
  });

  it("drops a truncated hash and retired payment kinds", () => {
    expect(
      parseStoredSentPayment(
        JSON.stringify({
          kind: "across",
          hash: "0x146d",
          chainId: 8453,
          payerAddress: PAYER,
          details,
        }),
      ),
    ).toBe(null);
    expect(
      parseStoredSentPayment(
        JSON.stringify({ kind: "direct", hash: HASH, chainId: 4663, payerAddress: PAYER }),
      ),
    ).toBe(null);
  });

  it("drops invalid JSON", () => {
    expect(parseStoredSentPayment("{")).toBe(null);
  });
});

describe("unverifiedPaymentMessage", () => {
  it("keeps the server reason and the do-not-pay-again warning as two sentences", () => {
    expect(
      unverifiedPaymentMessage(new Error("Deposit transaction does not pay this request")),
    ).toBe(
      "Deposit transaction does not pay this request. Your payment was already sent, so don't pay again.",
    );
  });
});
