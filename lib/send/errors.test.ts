import { describe, expect, it } from "vitest";
import { sendErrorMessage } from "./errors";

describe("sendErrorMessage", () => {
  it("explains wallet rejections", () => {
    expect(sendErrorMessage({ code: 4001, message: "User rejected the request." })).toBe(
      "You canceled in your wallet. Nothing was sent.",
    );
  });

  it("explains a short balance", () => {
    expect(sendErrorMessage(new Error("Insufficient balance for withdrawal"))).toBe(
      "Your USDC balance is too low. Check your balance and try again.",
    );
  });

  it("explains network failures", () => {
    expect(sendErrorMessage(new TypeError("Failed to fetch"))).toBe(
      "Hyperliquid is temporarily unreachable. Check your connection and retry.",
    );
  });

  it("keeps product messages and hides raw provider text", () => {
    expect(sendErrorMessage(new Error("Sign in to send USDC."))).toBe("Sign in to send USDC.");
    expect(sendErrorMessage(new Error("0xdeadbeef internal"), "Fallback")).toBe("Fallback");
  });
});
