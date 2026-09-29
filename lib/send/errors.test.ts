import { describe, expect, it } from "vitest";
import { sendErrorMessage } from "./errors";

describe("sendErrorMessage", () => {
  it("treats nested wallet rejection as a cancellation", () => {
    expect(
      sendErrorMessage({
        message: "Transaction failed",
        cause: { code: 4001, message: "User rejected the request." },
      }),
    ).toBe("You canceled the send. Your USDG was not sent.");
  });

  it("explains when Privy cannot sponsor the send", () => {
    expect(sendErrorMessage(new Error("Gas sponsorship is not enabled."))).toContain(
      "Fee sponsorship is unavailable",
    );
  });

  it("does not expose technical error messages", () => {
    expect(sendErrorMessage(new Error("RPC transport returned error at chain.ts:42"))).toBe(
      "Robinhood Chain is temporarily unavailable. Check your connection and retry.",
    );
  });

  it("uses a safe fallback for unclassified provider details", () => {
    expect(sendErrorMessage(new Error("secret provider response at internal.ts:42"))).toBe(
      "Send could not be submitted.",
    );
  });
});
