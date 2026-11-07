import {
  callsForReview,
  executeSend,
  SendPendingError,
  type SendCall,
  type SendDependencies,
  type SubmittedSendTransaction,
} from "@/lib/send/execute";
import { sendErrorMessage } from "@/lib/send/errors";
import type { ReviewPayload, SendFormAction } from "@/components/send-form/state";

type SendControllerDependencies = {
  review: ReviewPayload | null;
  address: string | undefined;
  deps: SendDependencies;
  dispatch: React.Dispatch<SendFormAction>;
  sendLock: { current: boolean };
  submittedTransaction: { current: SubmittedSendTransaction | null };
  recordSend: (args: {
    txHash: string;
    calls: Array<{ recipient: string; amount: string }>;
    memo?: string;
  }) => Promise<unknown>;
  confirmSend: (args: { txHash: string }) => Promise<{
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
    deps,
    dispatch,
    sendLock,
    submittedTransaction,
    recordSend,
    confirmSend,
    refetchBalance,
    onPendingChange,
  } = dependencies;

  async function recordFilled(hash: string, calls: SendCall[], memo: string | undefined) {
    await recordSend({
      txHash: hash,
      calls: calls.map((call) => ({ recipient: call.recipient, amount: call.amount.toString() })),
      ...(memo ? { memo } : {}),
    });
    const verified = await confirmSend({ txHash: hash });
    if (verified.status !== "filled") {
      throw new Error(verified.reason ?? "The transaction did not pay every recipient.");
    }
  }

  async function finishConfirmedTransfer(hash: string, payload: ReviewPayload, calls: SendCall[]) {
    submittedTransaction.current = { hash, stage: "activity", label: "Updating send activity" };
    dispatch({ type: "transactionRecording", hash });
    void refetchBalance();
    try {
      await recordFilled(hash, calls, payload.memo);
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
      if (!address) throw new Error("Sign in to send USDC.");

      const pending = submittedTransaction.current;
      if (pending?.stage === "activity") {
        await finishConfirmedTransfer(pending.hash, review, callsForReview(review));
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
        pending,
        deps,
        onAwaiting: (label) => dispatch({ type: "transactionAwaiting", stage: "transfer", label }),
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
      await finishConfirmedTransfer(result.hash, review, result.calls);
    } catch (err) {
      if (err instanceof SendPendingError || isBroadcastPending(submittedTransaction.current)) {
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
      await recordFilled(hash, callsForReview(review), review.memo);
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
  return transaction?.stage === "transfer";
}
