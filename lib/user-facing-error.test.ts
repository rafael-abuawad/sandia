import { describe, expect, it } from "vitest";
import { userFacingError } from "./user-facing-error";

describe("userFacingError", () => {
  it("strips Convex request ids and stack paths", () => {
    const raw =
      "[CONVEX A(across:quoteSwap)] [Request ID: 08d61c624fa07668] Server Error Uncaught Error: Route simulation failed. Refresh the quote or pick another token. at handler (../convex/across.ts:241:11) Called by client";
    expect(userFacingError(new Error(raw), "Try another token.")).toBe(
      "This route could not be quoted. Try another token.",
    );
  });

  it("maps missing users to a sign-in prompt", () => {
    expect(userFacingError(new Error("User not found"), "Try again.")).toBe(
      "Sign in again to continue.",
    );
  });

  it("keeps a short wallet rejection", () => {
    expect(userFacingError(new Error("User rejected the request."), "Payment failed.")).toBe(
      "User rejected the request.",
    );
  });

  it("uses the fallback when the message is still technical", () => {
    expect(userFacingError(new Error("Morpho returned 502"), "Vault unavailable.")).toBe(
      "Vault unavailable.",
    );
  });
});
