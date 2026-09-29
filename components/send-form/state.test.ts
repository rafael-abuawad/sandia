import { describe, expect, it } from "vitest";
import { validateReviewPayload } from "./helpers";
import { createInitialSendFormState, sendFormReducer } from "./state";

describe("sendFormReducer", () => {
  it("keeps the selected contact in the single send compose state", () => {
    const address = "0x1111111111111111111111111111111111111111";
    const state = sendFormReducer(createInitialSendFormState(), {
      type: "setSingleAddress",
      address,
    });

    expect(state.step).toBe("compose");
    expect(state.singleAddress).toBe(address);
  });

  it("can review a send immediately after selecting a saved contact", () => {
    const address = "0x1111111111111111111111111111111111111111";
    const state = sendFormReducer(createInitialSendFormState(), {
      type: "setSingleAddress",
      address,
    });
    const result = validateReviewPayload(
      "single",
      state.singleAddress,
      state.singleAmount,
      state.rows,
    );

    expect(result.review?.recipients[0]?.address).toBe(address);
  });

  it("retains a submitted hash as pending so confirmation cannot submit again", () => {
    const hash = `0x${"a".repeat(64)}` as const;
    const state = sendFormReducer(createInitialSendFormState(), {
      type: "transactionSubmitted",
      stage: "transfer",
      label: "Confirm USDG transfer",
      hash,
    });
    const pending = sendFormReducer(state, { type: "transactionPending" });

    expect(pending.progress.phase).toBe("pending");
    expect(pending.progress.hash).toBe(hash);
    expect(pending.progress.stage).toBe("transfer");
  });

  it("keeps chain success visible when activity recording needs a retry", () => {
    const state = sendFormReducer(createInitialSendFormState(), {
      type: "confirmSucceeded",
      activityError: "Your transfer is confirmed. Send activity could not update yet.",
    });

    expect(state.step).toBe("success");
    expect(state.activityError).toContain("transfer is confirmed");
  });
});
