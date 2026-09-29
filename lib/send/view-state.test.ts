import { describe, expect, it } from "vitest";
import { canConfirmSend, getBalanceMessage } from "@/components/send-form/view-model";
import { getBalanceStatus, getSendBlocker } from "./view-state";

describe("send view state", () => {
  it("distinguishes balance loading and read failure", () => {
    expect(
      getBalanceStatus({ loading: true, error: false, balance: undefined, amountMicros: 1 }),
    ).toBe("loading");
    expect(
      getBalanceStatus({ loading: false, error: true, balance: undefined, amountMicros: 1 }),
    ).toBe("error");
  });

  it("distinguishes sufficient and insufficient USDG", () => {
    expect(getBalanceStatus({ loading: false, error: false, balance: 10n, amountMicros: 10 })).toBe(
      "ready",
    );
    expect(getBalanceStatus({ loading: false, error: false, balance: 9n, amountMicros: 10 })).toBe(
      "insufficient",
    );
  });

  it("explains why review confirmation is blocked", () => {
    expect(
      getSendBlocker({
        isSignedIn: true,
        chainReady: true,
        balanceStatus: "error",
        maxRecipients: 128,
        withinCap: true,
        sendConfigured: true,
      }),
    ).toContain("Could not read");
  });

  it("disables confirmation until a balance is available, unless resuming a pending send", () => {
    const review = {
      mode: "single" as const,
      recipients: [
        {
          address: "0x1111111111111111111111111111111111111111" as const,
          amountUsdMicros: 1,
        },
      ],
      totalUsdMicros: 1,
    };
    const input = {
      review,
      confirming: false,
      pendingTransaction: false,
      isSignedIn: true,
      chainReady: true,
      balanceStatus: "insufficient" as const,
      withinCap: true,
      sendConfigured: true,
    };

    expect(canConfirmSend(input)).toBe(false);
    expect(canConfirmSend({ ...input, balanceStatus: "loading" })).toBe(false);
    expect(canConfirmSend({ ...input, pendingTransaction: true })).toBe(true);
  });

  it("shows a distinct read failure message for the balance", () => {
    expect(
      getBalanceMessage({
        isSignedIn: true,
        balanceStatus: "error",
        balance: undefined,
        decimals: 6,
      }),
    ).toBe("Could not read your USDG balance.");
  });
});
