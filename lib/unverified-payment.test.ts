import { describe, expect, it } from "vitest";
import { parseStoredSentPayment, unverifiedPaymentMessage } from "./unverified-payment";

const HASH = "a".repeat(64);
const PAYER = "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN";

describe("parseStoredSentPayment", () => {
  it("restores a sent payment", () => {
    const payment = { hash: HASH, payerAddress: PAYER, expiresAt: 1_800_000_000 };
    expect(parseStoredSentPayment(JSON.stringify(payment))).toEqual(payment);
  });

  it("drops a truncated hash", () => {
    expect(
      parseStoredSentPayment(JSON.stringify({ hash: "abc", payerAddress: PAYER, expiresAt: 1 })),
    ).toBe(null);
  });

  it("drops an EVM payer and invalid JSON", () => {
    expect(
      parseStoredSentPayment(
        JSON.stringify({ hash: HASH, payerAddress: `0x${"1".repeat(40)}`, expiresAt: 1 }),
      ),
    ).toBe(null);
    expect(parseStoredSentPayment("{nope")).toBe(null);
  });
});

describe("unverifiedPaymentMessage", () => {
  it("warns against paying twice", () => {
    expect(unverifiedPaymentMessage(new Error("Stellar is slow."))).toBe(
      "Stellar is slow. Your payment was already sent, so don't pay again.",
    );
  });
});
