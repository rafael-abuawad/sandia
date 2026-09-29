import type { Address, Hex } from "viem";
import {
  executeSend,
  type SendExecutionClient,
  type SubmittedSendTransaction,
} from "@/lib/send/execute";
import { sendErrorMessage } from "@/lib/send/errors";
import type { ReviewPayload, SendFormAction } from "@/components/send-form/state";

type SendCall = { to: Address; data: Hex; value: bigint };
type SendCalls = Array<{ recipient: Address; amount: bigint }>;

type SendControllerDependencies = {
  review: ReviewPayload | null;
  address: Address | undefined;
  chainId: number | undefined;
  client: SendExecutionClient | undefined;
  dispatch: React.Dispatch<SendFormAction>;
  sendLock: { current: boolean };
  submittedTransaction: { current: SubmittedSendTransaction | null };
  sendSponsored: (call: SendCall, stage: "approval" | "transfer", label: string) => Promise<Hex>;
  recordSend: (args: {
    userOpHash: string;
    calls: Array<{ recipient: Address; amount: string }>;
  }) => Promise<unknown>;
  attachBundle: (args: { userOpHash: string; txHashes: string[] }) => Promise<{
    status: "submitted" | "filled" | "failed";
    reason?: string;
  }>;
  refetchBalance: () => unknown;
  onPendingChange?: (pending: boolean) => void;
};

export function createSendController(dependencies: SendControllerDependencies) {
  const {
    review,
    address,
    chainId,
    client,
    dispatch,
    sendLock,
    submittedTransaction,
    sendSponsored,
    recordSend,
    attachBundle,
    refetchBalance,
    onPendingChange,
  } = dependencies;

  function callsForReview(payload: ReviewPayload): SendCalls {
    return payload.recipients.map((recipient) => ({
      recipient: recipient.address as Address,
      amount: BigInt(recipient.amountUsdMicros),
    }));
  }

  async function recordFilled(userOpHash: Hex, calls: SendCalls) {
    if (!userOpHash.startsWith("0x") || userOpHash.length !== 66) {
      throw new Error("The transfer was submitted, but no transaction hash was returned.");
    }
    await recordSend({
      userOpHash,
      calls: calls.map((call) => ({
        recipient: call.recipient,
        amount: call.amount.toString(),
      })),
    });
    const verified = await attachBundle({ userOpHash, txHashes: [userOpHash] });
    if (verified.status !== "filled") {
      throw new Error(verified.reason ?? "The receipt did not pay every recipient.");
    }
  }

  async function finishConfirmedTransfer(hash: Hex, calls: SendCalls) {
    submittedTransaction.current = { hash, stage: "activity", label: "Updating send activity" };
    dispatch({ type: "transactionRecording", hash });
    void refetchBalance();
    try {
      await recordFilled(hash, calls);
      submittedTransaction.current = null;
      dispatch({ type: "confirmSucceeded" });
    } catch {
      dispatch({
        type: "confirmSucceeded",
        activityError: "Your transfer is confirmed. Send activity could not update yet.",
      });
    }
  }

  async function confirm() {
    if (!review || sendLock.current) return;
    sendLock.current = true;
    onPendingChange?.(true);
    dispatch({ type: "confirmStarted" });
    dispatch({ type: "setError", error: null });
    try {
      if (!address) throw new Error("Sign in to send USDG.");
      if (!client) throw new Error("Robinhood Chain is not reachable. Refresh and try again.");

      const pending = submittedTransaction.current;
      if (pending?.stage === "activity") {
        await finishConfirmedTransfer(pending.hash, callsForReview(review));
        return;
      }
      if (pending) {
        dispatch({
          type: "transactionSubmitted",
          stage: pending.stage,
          label: pending.label,
          hash: pending.hash,
        });
      }

      const result = await executeSend({
        review,
        account: address,
        chainId,
        client,
        pending,
        sendSponsored,
        onSubmitted: (transaction) => {
          submittedTransaction.current = transaction;
          dispatch({
            type: "transactionSubmitted",
            stage: transaction.stage,
            label: transaction.label,
            hash: transaction.hash,
          });
        },
        onCleared: () => {
          submittedTransaction.current = null;
          dispatch({ type: "transactionCleared" });
        },
      });
      await finishConfirmedTransfer(result.hash, result.calls);
    } catch (err) {
      if (isBroadcastPending(submittedTransaction.current)) {
        dispatch({ type: "transactionPending" });
      } else if (submittedTransaction.current?.stage !== "activity") {
        dispatch({ type: "transactionCleared" });
        dispatch({
          type: "setError",
          error: sendErrorMessage(err, "Send could not be submitted. Try again."),
        });
      }
    } finally {
      dispatch({ type: "confirmFinished" });
      onPendingChange?.(isBroadcastPending(submittedTransaction.current));
      sendLock.current = false;
    }
  }

  async function retryActivity() {
    if (!review || sendLock.current) return;
    const pending = submittedTransaction.current;
    const hash = pending?.stage === "activity" ? pending.hash : null;
    if (!hash) return;
    sendLock.current = true;
    onPendingChange?.(true);
    dispatch({ type: "activitySyncStarted" });
    try {
      await recordFilled(hash, callsForReview(review));
      submittedTransaction.current = null;
      dispatch({ type: "confirmSucceeded" });
    } catch {
      dispatch({
        type: "confirmSucceeded",
        activityError:
          "Your transfer is confirmed. Send activity is still unavailable; retry in a moment.",
      });
    } finally {
      onPendingChange?.(false);
      sendLock.current = false;
    }
  }

  return {
    confirm,
    retryActivity,
    resetTransaction() {
      submittedTransaction.current = null;
      dispatch({ type: "reset" });
    },
  };
}

function isBroadcastPending(transaction: SubmittedSendTransaction | null) {
  return transaction?.stage === "approval" || transaction?.stage === "transfer";
}
