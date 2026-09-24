import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  decideAttemptAcceptance,
  evaluateFill,
  isReconciliationStuck,
  STUCK_AFTER_MS,
} from "./fillProof";

const expected = {
  destinationChainId: 4663,
  destinationTokenAddress: "0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168",
  recipientAddress: "0x1111111111111111111111111111111111111111",
  outputAmountBaseUnits: "1000000",
};

const filled = {
  status: "filled",
  destinationChainId: 4663,
  outputToken: expected.destinationTokenAddress,
  recipient: expected.recipientAddress,
  outputAmount: "1000000",
  fillTxnRef: "0xabc",
};

describe("evaluateFill", () => {
  it("completes only when chain, token, recipient, amount, and fill hash are present", () => {
    expect(evaluateFill(filled, expected).outcome).toBe("filled");
  });

  it("keeps a filled status incomplete when any proof field is missing", () => {
    expect(evaluateFill({ ...filled, recipient: undefined }, expected).outcome).toBe("incomplete");
    expect(evaluateFill({ ...filled, outputToken: "" }, expected).outcome).toBe("incomplete");
    expect(evaluateFill({ ...filled, outputAmount: undefined }, expected).outcome).toBe(
      "incomplete",
    );
    expect(evaluateFill({ ...filled, fillTxnRef: undefined }, expected).outcome).toBe("incomplete");
  });

  it("rejects the wrong chain, token, recipient, or short amount", () => {
    expect(evaluateFill({ ...filled, destinationChainId: 8453 }, expected).outcome).toBe(
      "mismatch",
    );
    expect(
      evaluateFill(
        { ...filled, outputToken: "0x0000000000000000000000000000000000000002" },
        expected,
      ).outcome,
    ).toBe("mismatch");
    expect(
      evaluateFill({ ...filled, recipient: "0x2222222222222222222222222222222222222222" }, expected)
        .outcome,
    ).toBe("mismatch");
    expect(evaluateFill({ ...filled, outputAmount: "1" }, expected).outcome).toBe("mismatch");
  });

  it("does not treat pending, expired, or refunded as paid", () => {
    expect(evaluateFill({ ...filled, status: "pending" }, expected).outcome).toBe("pending");
    expect(evaluateFill({ ...filled, status: "expired" }, expected).outcome).toBe("expired");
    expect(evaluateFill({ ...filled, status: "refunded" }, expected).outcome).toBe("refunded");
  });
});

describe("decideAttemptAcceptance", () => {
  it("rejects a second hash while a payment is pending", () => {
    const decision = decideAttemptAcceptance({
      requestStatus: "pending",
      existingDepositTxnRef: undefined,
      incomingDepositTxnRef: "0x" + "ab".repeat(32),
      attemptCount: 1,
    });
    expect(decision).toEqual({
      ok: false,
      reason: "A payment is already in progress for this request",
    });
  });

  it("accepts the same hash as a duplicate", () => {
    const hash = "0x" + "cd".repeat(32);
    expect(
      decideAttemptAcceptance({
        requestStatus: "pending",
        existingDepositTxnRef: hash,
        incomingDepositTxnRef: hash,
        attemptCount: 1,
      }),
    ).toEqual({ ok: true, duplicate: true });
  });
});

describe("isReconciliationStuck", () => {
  it("is stuck at 30 minutes", () => {
    expect(isReconciliationStuck(0, STUCK_AFTER_MS - 1)).toBe(false);
    expect(isReconciliationStuck(0, STUCK_AFTER_MS)).toBe(true);
  });
});

describe("getByPublicId", () => {
  it("does not read the clock inside the query", () => {
    const source = readFileSync(new URL("../paymentRequests.ts", import.meta.url), "utf8");
    const start = source.indexOf("export const getByPublicId");
    const end = source.indexOf("export const getInternalByPublicId");
    expect(source.slice(start, end)).not.toContain("Date.now");
  });
});
