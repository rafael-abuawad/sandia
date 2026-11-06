import { describe, expect, it } from "vitest";
import { STELLAR_USDC } from "./constants";
import type { HorizonOperation } from "./horizon";
import { matchRequestPayment, matchSendPayments, parseUsdcPayments } from "./payments";

const A = "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN";
const B = "GBD7QFQVR4QWNEJSHP4VN7RAAUKXTMZ4EJ4EBMCR7CP3HMF7RXEASTD7";

const usdc = { asset_code: "USDC", asset_issuer: STELLAR_USDC.issuer };

function payment(to: string, amount: string, extra: Partial<HorizonOperation> = {}) {
  return { type: "payment", to, amount, ...usdc, ...extra } satisfies HorizonOperation;
}

describe("parseUsdcPayments", () => {
  it("keeps only real USDC payments", () => {
    const parsed = parseUsdcPayments([
      payment(A, "1.0000000"),
      payment(A, "9.0000000", { asset_issuer: B }),
      payment(A, "9.0000000", { asset_code: "USDT" }),
      payment(A, "9.0000000", { transaction_successful: false }),
      { type: "change_trust", ...usdc },
    ]);
    expect(parsed).toEqual([{ to: A, toMuxed: undefined, amount: 10_000_000n }]);
  });

  it("counts path payments that deliver USDC", () => {
    const parsed = parseUsdcPayments([
      payment(A, "2.0000000", { type: "path_payment_strict_receive" }),
    ]);
    expect(parsed[0]?.amount).toBe(20_000_000n);
  });
});

describe("matchRequestPayment", () => {
  const payments = [{ to: A, amount: 10_000_000n }];

  it("accepts the requested amount or more", () => {
    expect(matchRequestPayment(payments, { recipient: A, amount: "10000000" }).ok).toBe(true);
    expect(matchRequestPayment(payments, { recipient: A, amount: "9000000" }).ok).toBe(true);
  });

  it("rejects underpayment or another recipient", () => {
    expect(matchRequestPayment(payments, { recipient: A, amount: "10000001" }).ok).toBe(false);
    expect(matchRequestPayment(payments, { recipient: B, amount: "1" }).ok).toBe(false);
  });

  it("doesn't let several small payments add up", () => {
    const split = [
      { to: A, amount: 6n },
      { to: A, amount: 6n },
    ];
    expect(matchRequestPayment(split, { recipient: A, amount: "10" }).ok).toBe(false);
  });

  it("matches muxed recipients on the muxed address", () => {
    const muxed = `M${"A".repeat(68)}`;
    const rows = [{ to: A, toMuxed: muxed, amount: 10n }];
    expect(matchRequestPayment(rows, { recipient: muxed, amount: "10" }).ok).toBe(true);
    expect(
      matchRequestPayment([{ to: A, amount: 10n }], { recipient: muxed, amount: "10" }).ok,
    ).toBe(false);
  });
});

describe("matchSendPayments", () => {
  it("requires every recipient's exact amount", () => {
    const payments = [
      { to: A, amount: 10n },
      { to: B, amount: 20n },
    ];
    expect(
      matchSendPayments(payments, [
        { recipient: A, amount: "10" },
        { recipient: B, amount: "20" },
      ]),
    ).toEqual({ ok: true });
    expect(matchSendPayments(payments, [{ recipient: B, amount: "21" }]).ok).toBe(false);
  });
});
