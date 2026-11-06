import { Keypair } from "@stellar/stellar-sdk";
import { describe, expect, it, vi } from "vitest";
import { parseAccountState } from "@/lib/stellar/horizon";
import { STELLAR_USDC } from "@/lib/stellar/constants";
import { createInitialSendFormState, sendFormReducer, type ReviewPayload } from "./state";
import { createSendController } from "./controller";

const user = Keypair.random();
const account = user.publicKey();
const recipient = Keypair.random().publicKey();
const hash = "a".repeat(64);

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
      deps: {
        loadAccount: async () =>
          parseAccountState({
            sequence: "1",
            balances: [
              {
                asset_type: "credit_alphanum4",
                asset_code: "USDC",
                asset_issuer: STELLAR_USDC.issuer,
                balance: "5.0000000",
              },
            ],
          }),
        lookupTransaction: async () => null,
        sign: async (hex) => Buffer.from(user.sign(Buffer.from(hex, "hex"))).toString("hex"),
        submit: async () => ({ ok: true, hash }),
      },
      dispatch,
      sendLock: { current: false },
      submittedTransaction: { current: null },
      recordSend: vi.fn(async () => {
        throw new Error("Convex is temporarily unavailable");
      }),
      confirmSend: vi.fn(async () => ({ status: "filled" as const })),
      refetchBalance: () => undefined,
    });

    await controller.confirm();

    expect(state.step).toBe("success");
    expect(state.progress.hash).toBe(hash);
    expect(state.activityError).toContain("transfer is confirmed");
    expect(state.error).toBeNull();
  });
});
