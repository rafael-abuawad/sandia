import { describe, expect, it } from "vitest";
import {
  DEPOSIT_WINDOW_MS,
  depositDeadline,
  isReconciliationStuck,
  nextNearStep,
  settlesAfter,
  STUCK_AFTER_MS,
} from "./settlement";

describe("nextNearStep", () => {
  const now = 1_000_000;

  it("waits for a deposit until the deadline", () => {
    expect(nextNearStep("PENDING_DEPOSIT", now + 1, now)).toEqual({ step: "wait" });
    expect(nextNearStep("PENDING_DEPOSIT", now, now)).toEqual({
      step: "terminal",
      status: "expired",
    });
  });

  it("treats a known deposit as processing", () => {
    expect(nextNearStep("KNOWN_DEPOSIT_TX", now, now)).toEqual({ step: "processing" });
    expect(nextNearStep("PROCESSING", now, now)).toEqual({ step: "processing" });
    expect(nextNearStep("INCOMPLETE_DEPOSIT", now, now)).toMatchObject({
      step: "processing",
      reason: expect.stringContaining("refunded"),
    });
  });

  it("never settles on SUCCESS alone", () => {
    expect(nextNearStep("SUCCESS", now, now)).toEqual({ step: "verify" });
  });

  it("maps terminal outcomes", () => {
    expect(nextNearStep("REFUNDED", now, now)).toMatchObject({ status: "refunded" });
    expect(nextNearStep("FAILED", now, now)).toMatchObject({ status: "failed" });
  });

  it("ignores statuses it doesn't know", () => {
    expect(nextNearStep("SOMETHING_NEW", now, now)).toEqual({ step: "wait" });
  });
});

describe("depositDeadline", () => {
  const now = 10_000_000;

  it("defaults to the deposit window", () => {
    expect(depositDeadline(now, undefined)).toBe(now + DEPOSIT_WINDOW_MS);
  });

  it("never outlives the request", () => {
    expect(depositDeadline(now, now + 20 * 60 * 1000)).toBe(now + 20 * 60 * 1000);
  });

  it("refuses when too little time is left", () => {
    expect(depositDeadline(now, now + 60 * 1000)).toBeNull();
  });
});

describe("settlesAfter", () => {
  it("rejects a transaction older than the request", () => {
    const created = Date.parse("2026-11-06T12:00:00Z");
    expect(settlesAfter("2026-11-06T12:00:01Z", created)).toBe(true);
    expect(settlesAfter("2026-11-06T11:59:59Z", created)).toBe(false);
    expect(settlesAfter("not a date", created)).toBe(false);
  });
});

describe("isReconciliationStuck", () => {
  it("flags old attempts", () => {
    expect(isReconciliationStuck(0, STUCK_AFTER_MS + 1)).toBe(true);
    expect(isReconciliationStuck(0, STUCK_AFTER_MS)).toBe(false);
  });
});
