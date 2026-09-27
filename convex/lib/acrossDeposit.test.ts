import { describe, expect, it } from "vitest";
import { parseAcrossDeposit } from "./acrossDeposit";
import { evaluateFill } from "./fillProof";

/** Trimmed `GET /api/deposit?depositTxnRef=` response for a Base → Robinhood USDG fill. */
const depositResponse = {
  deposit: {
    id: 23837702,
    originChainId: "8453",
    destinationChainId: "4663",
    depositor: "0xC14fF56E720f79d08413CE00533256433D2ED929",
    recipient: "0x7960DD41Fd8F8cb1542D9ceFe45A855794C9bE39",
    inputToken: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    inputAmount: "294187",
    outputToken: "0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168",
    outputAmount: "250000",
    depositTxHash: "0x556605896515bf38ffbfe3728f5f6fe052b45dc7d77550659cdaed3a1f60db50",
    status: "filled",
    fillTx: "0xc7d2cb9c15b8cff95a9fd50cd5ac5200019967d914f8cea4086f4b062e39e77d",
    depositTxnRef: "0x556605896515bf38ffbfe3728f5f6fe052b45dc7d77550659cdaed3a1f60db50",
    fillTxnRef: "0xc7d2cb9c15b8cff95a9fd50cd5ac5200019967d914f8cea4086f4b062e39e77d",
  },
  pagination: { currentIndex: 0, maxIndex: 0 },
};

const expected = {
  destinationChainId: 4663,
  destinationTokenAddress: "0x5fc5360d0400a0fd4f2af552add042d716f1d168",
  recipientAddress: "0x7960dd41fd8f8cb1542d9cefe45a855794c9be39",
  outputAmountBaseUnits: "250000",
};

describe("parseAcrossDeposit", () => {
  it("reads the record nested under `deposit` with numeric chain ids", () => {
    const record = parseAcrossDeposit(depositResponse);
    expect(record).toMatchObject({
      status: "filled",
      destinationChainId: 4663,
      originChainId: 8453,
      fillTxnRef: "0xc7d2cb9c15b8cff95a9fd50cd5ac5200019967d914f8cea4086f4b062e39e77d",
    });
  });

  it("produces evidence that completes the matching request", () => {
    const record = parseAcrossDeposit(depositResponse);
    expect(record).not.toBeNull();
    const decision = evaluateFill(
      {
        status: record!.status!,
        destinationChainId: record!.destinationChainId,
        outputToken: record!.outputToken,
        recipient: record!.recipient,
        outputAmount: record!.outputAmount,
        fillTxnRef: record!.fillTxnRef ?? record!.fillTx,
      },
      expected,
    );
    expect(decision.outcome).toBe("filled");
  });

  it("returns null when the body has no deposit status", () => {
    expect(parseAcrossDeposit(null)).toBeNull();
    expect(parseAcrossDeposit({ pagination: {} })).toBeNull();
    expect(parseAcrossDeposit({ deposit: { id: 1 } })).toBeNull();
  });
});
