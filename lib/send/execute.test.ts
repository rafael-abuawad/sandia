import { afterEach, describe, expect, it, vi } from "vitest";
import { ROBINHOOD_USDG } from "@/lib/destination";
import type { ReviewPayload } from "@/components/send-form/state";
import { executeSend, type SendExecutionClient } from "./execute";

const account = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as const;
const firstRecipient = "0x1111111111111111111111111111111111111111" as const;
const secondRecipient = "0x2222222222222222222222222222222222222222" as const;
const hashOne = `0x${"1".repeat(64)}` as const;
const hashTwo = `0x${"2".repeat(64)}` as const;

afterEach(() => vi.unstubAllEnvs());

function review(recipients: ReviewPayload["recipients"]): ReviewPayload {
  return {
    mode: recipients.length === 1 ? "single" : "massive",
    recipients,
    totalUsdMicros: recipients.reduce((total, recipient) => total + recipient.amountUsdMicros, 0),
  };
}

function client(overrides: Partial<SendExecutionClient> = {}): SendExecutionClient {
  return {
    readContract: async (request) => (request.functionName === "balanceOf" ? 100_000_000n : 0n),
    call: async () => undefined,
    waitForTransactionReceipt: async () => ({ status: "success" }),
    ...overrides,
  };
}

describe("executeSend", () => {
  it("simulates and confirms a sponsored single transfer", async () => {
    const events: string[] = [];
    const result = await executeSend({
      review: review([{ address: firstRecipient, amountUsdMicros: 10_000_000 }]),
      account,
      chainId: ROBINHOOD_USDG.chainId,
      client: client({
        readContract: async () => {
          events.push("balance");
          return 100_000_000n;
        },
        call: async () => {
          events.push("simulate");
        },
        waitForTransactionReceipt: async () => {
          events.push("receipt");
          return { status: "success" };
        },
      }),
      pending: null,
      sendSponsored: async (_call, stage) => {
        events.push(`sponsor:${stage}`);
        return hashOne;
      },
      onSubmitted: () => events.push("submitted"),
      onCleared: () => events.push("cleared"),
    });

    expect(result.hash).toBe(hashOne);
    expect(result.calls).toEqual([{ recipient: firstRecipient, amount: 10_000_000n }]);
    expect(events).toEqual(["balance", "simulate", "sponsor:transfer", "submitted", "receipt"]);
  });

  it("checks a pending transfer receipt without broadcasting it again", async () => {
    const sponsor = vi.fn(async () => hashTwo);
    const result = await executeSend({
      review: review([{ address: firstRecipient, amountUsdMicros: 2_000_000 }]),
      account,
      chainId: ROBINHOOD_USDG.chainId,
      client: client({
        waitForTransactionReceipt: async ({ hash }) => {
          expect(hash).toBe(hashOne);
          return { status: "success" };
        },
      }),
      pending: { hash: hashOne, stage: "transfer", label: "USDG transfer" },
      sendSponsored: sponsor,
      onSubmitted: () => {},
      onCleared: () => {},
    });

    expect(result.hash).toBe(hashOne);
    expect(sponsor).not.toHaveBeenCalled();
  });

  it("blocks a transfer when the latest balance is too low", async () => {
    const sponsor = vi.fn(async () => hashOne);
    await expect(
      executeSend({
        review: review([{ address: firstRecipient, amountUsdMicros: 10_000_000 }]),
        account,
        chainId: ROBINHOOD_USDG.chainId,
        client: client({ readContract: async () => 9_000_000n }),
        pending: null,
        sendSponsored: sponsor,
        onSubmitted: () => {},
        onCleared: () => {},
      }),
    ).rejects.toThrow("doesn't have enough USDG");

    expect(sponsor).not.toHaveBeenCalled();
  });

  it("retains a submitted hash after a delayed receipt and resumes without resending", async () => {
    const submitted = vi.fn();
    const sponsor = vi.fn(async () => hashOne);
    const initialClient = client({
      waitForTransactionReceipt: async () => {
        throw new Error("Timed out while waiting for transaction receipt");
      },
    });
    await expect(
      executeSend({
        review: review([{ address: firstRecipient, amountUsdMicros: 1_000_000 }]),
        account,
        chainId: ROBINHOOD_USDG.chainId,
        client: initialClient,
        pending: null,
        sendSponsored: sponsor,
        onSubmitted: submitted,
        onCleared: () => {},
      }),
    ).rejects.toThrow("Timed out");
    expect(submitted).toHaveBeenCalledWith({
      hash: hashOne,
      stage: "transfer",
      label: "Confirm USDG transfer in your wallet",
    });

    const result = await executeSend({
      review: review([{ address: firstRecipient, amountUsdMicros: 1_000_000 }]),
      account,
      chainId: ROBINHOOD_USDG.chainId,
      client: client({
        waitForTransactionReceipt: async ({ hash }) => {
          expect(hash).toBe(hashOne);
          return { status: "success" };
        },
      }),
      pending: { hash: hashOne, stage: "transfer", label: "Confirm USDG transfer" },
      sendSponsored: sponsor,
      onSubmitted: () => {},
      onCleared: () => {},
    });

    expect(result.hash).toBe(hashOne);
    expect(sponsor).toHaveBeenCalledTimes(1);
  });

  it("clears a reverted single transfer so the user can review and retry", async () => {
    const cleared = vi.fn();
    await expect(
      executeSend({
        review: review([{ address: firstRecipient, amountUsdMicros: 1_000_000 }]),
        account,
        chainId: ROBINHOOD_USDG.chainId,
        client: client({
          waitForTransactionReceipt: async () => ({ status: "reverted" }),
        }),
        pending: null,
        sendSponsored: async () => hashOne,
        onSubmitted: () => {},
        onCleared: cleared,
      }),
    ).rejects.toThrow("transfer reverted");

    expect(cleared).toHaveBeenCalledOnce();
  });

  it("waits for exact approval before simulating and submitting a batch", async () => {
    vi.stubEnv("NEXT_PUBLIC_SANDIA_SEND_ADDRESS", account);
    const events: string[] = [];
    let allowanceReads = 0;
    let sponsoredCalls = 0;
    const result = await executeSend({
      review: review([
        { address: firstRecipient, amountUsdMicros: 1_000_000 },
        { address: secondRecipient, amountUsdMicros: 2_000_000 },
      ]),
      account,
      chainId: ROBINHOOD_USDG.chainId,
      client: client({
        readContract: async (request) => {
          if (request.functionName === "balanceOf") {
            events.push("balance");
            return 100_000_000n;
          }
          allowanceReads += 1;
          events.push(`allowance:${allowanceReads}`);
          return allowanceReads === 1 ? 0n : 3_000_000n;
        },
        call: async ({ to }) => {
          events.push(to === ROBINHOOD_USDG.address ? "simulate-approval" : "simulate-batch");
        },
        waitForTransactionReceipt: async ({ hash }) => {
          events.push(hash === hashOne ? "approval-receipt" : "batch-receipt");
          return { status: "success" };
        },
      }),
      pending: null,
      sendSponsored: async (_call, stage) => {
        sponsoredCalls += 1;
        events.push(`sponsor:${stage}`);
        return sponsoredCalls === 1 ? hashOne : hashTwo;
      },
      onSubmitted: ({ stage }) => events.push(`submitted:${stage}`),
      onCleared: () => events.push("cleared"),
    });

    expect(result.hash).toBe(hashTwo);
    expect(result.calls).toHaveLength(2);
    expect(events.indexOf("approval-receipt")).toBeLessThan(events.indexOf("allowance:2"));
    expect(events.indexOf("allowance:2")).toBeLessThan(events.indexOf("simulate-batch"));
    expect(events.indexOf("simulate-batch")).toBeLessThan(events.indexOf("sponsor:transfer"));
    expect(sponsoredCalls).toBe(2);
  });

  it("does not continue a batch after its approval reverts", async () => {
    vi.stubEnv("NEXT_PUBLIC_SANDIA_SEND_ADDRESS", account);
    const sponsor = vi.fn(async () => hashOne);
    const clear = vi.fn();
    await expect(
      executeSend({
        review: review([
          { address: firstRecipient, amountUsdMicros: 1_000_000 },
          { address: secondRecipient, amountUsdMicros: 2_000_000 },
        ]),
        account,
        chainId: ROBINHOOD_USDG.chainId,
        client: client({
          waitForTransactionReceipt: async () => ({ status: "reverted" }),
        }),
        pending: null,
        sendSponsored: sponsor,
        onSubmitted: () => {},
        onCleared: clear,
      }),
    ).rejects.toThrow("USDG approval reverted");

    expect(sponsor).toHaveBeenCalledTimes(1);
    expect(clear).toHaveBeenCalledTimes(1);
  });
});
