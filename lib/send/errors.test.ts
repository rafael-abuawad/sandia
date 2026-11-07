import { describe, expect, it } from "vitest";
import { sendErrorMessage } from "./errors";

describe("sendErrorMessage", () => {
  it("explains a rejected signature", () => {
    expect(sendErrorMessage({ code: 4001, message: "User rejected the request" })).toContain(
      "You canceled the send",
    );
  });

  it("explains unavailable sponsorship", () => {
    expect(sendErrorMessage(new Error("Fee sponsorship isn't configured."))).toContain(
      "Fee sponsorship is unavailable",
    );
  });

  it("explains network failures", () => {
    expect(sendErrorMessage(new Error("Failed to fetch"))).toContain("temporarily unavailable");
  });

  it("keeps recipient preflight messages", () => {
    const message = "GABC…WXYZ hasn't enabled USDC on their account. Nothing was sent.";
    expect(sendErrorMessage(new Error(message))).toBe(message);
  });

  it("hides unknown provider payloads", () => {
    expect(sendErrorMessage(new Error('{"internal":"boom"}'), "Try again.")).toBe("Try again.");
  });
});
