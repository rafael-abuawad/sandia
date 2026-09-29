import { describe, expect, it, vi } from "vitest";
import { ROBINHOOD_USDG } from "@/lib/destination";
import type { SendExecutionClient } from "@/lib/send/execute";
import { createInitialSendFormState, sendFormReducer, type ReviewPayload } from "./state";
import { createSendController } from "./controller";

const account = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as const;
const recipient = "0x1111111111111111111111111111111111111111" as const;
const hash = `0x${"a".repeat(64)}` as const;

describe("send controller", () => {
  it("keeps confirmed transfers successful when activity recording fails", async () => {
    const review: ReviewPayload = {
      mode: "single",
      recipients: [{ address: recipient, amountUsdMicros: 1_000_000 }],
      totalUsdMicros: 1_000_000,
    };
    let state = createInitialSendFormState();
    state = sendFormReducer(state, { type: "reviewReady", review });
    const dispatch = (action: Parameters<typeof sendFormReducer>[1]) => {
      state = sendFormReducer(state, action);
    };
    const controller = createSendController({
      review,
      address: account,
      chainId: ROBINHOOD_USDG.chainId,
      client: {
        readContract: async () => 2_000_000n,
        call: async () => undefined,
        waitForTransactionReceipt: async () => ({ status: "success" }),
      } satisfies SendExecutionClient,
      dispatch,
      sendLock: { current: false },
      submittedTransaction: { current: null },
      sendSponsored: vi.fn(async () => hash),
      recordSend: vi.fn(async () => {
        throw new Error("Convex is temporarily unavailable");
      }),
      attachBundle: vi.fn(async () => ({ status: "filled" as const })),
      refetchBalance: () => undefined,
    });

    await controller.confirm();

    expect(state.step).toBe("success");
    expect(state.progress.hash).toBe(hash);
    expect(state.activityError).toContain("transfer is confirmed");
    expect(state.error).toBeNull();
  });
});
