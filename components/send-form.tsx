"use client";

import { useReducer, useRef } from "react";
import { formatUsdFromMicros } from "@/lib/money";
import { getBalanceStatus, getSendBlocker } from "@/lib/send/view-state";
import { sendErrorMessage } from "@/lib/send/errors";
import { useSignedInWallet } from "@/lib/use-signed-in-wallet";
import { MAX_SEND_RECIPIENTS, validateReviewPayload } from "@/components/send-form/helpers";
import { getBalanceMessage, getLiveTotalMicros } from "@/components/send-form/view-model";
import { SendFormStepView } from "@/components/send-form/step-view";
import { createInitialSendFormState, sendFormReducer } from "@/components/send-form/state";
import { PartialSendError, useHlAccount, useUsdcSender } from "@/components/trade/use-hyperliquid";

/** USD micros as a decimal string Hyperliquid accepts, e.g. 12_500_000 → "12.5". */
function microsToAmount(micros: number): string {
  return (micros / 1_000_000).toFixed(6).replace(/\.?0+$/, "");
}

export function SendForm({
  initialValues,
  onPendingChange,
}: {
  initialValues?: {
    address?: string;
    amount?: string;
    recipients?: Array<{ address: string; amount: string }>;
  };
  onPendingChange?: (pending: boolean) => void;
}) {
  const { isSignedIn, address } = useSignedInWallet();
  const account = useHlAccount(address);
  const { send, walletReady } = useUsdcSender(address);
  const [state, dispatch] = useReducer(sendFormReducer, initialValues, createInitialSendFormState);
  const { mode, singleAddress, singleAmount, rows, review, confirming } = state;
  const sendLock = useRef(false);

  const liveTotalMicros = getLiveTotalMicros(mode, singleAmount, rows);
  const available = account.data?.available;
  const balanceStatus = getBalanceStatus({
    loading: account.isLoading,
    error: account.isError,
    available,
    amountMicros: review?.totalUsdMicros ?? liveTotalMicros,
  });
  const withinCap = (review?.recipients.length ?? 0) <= MAX_SEND_RECIPIENTS;
  const blocker = review
    ? getSendBlocker({
        isSignedIn,
        walletReady,
        balanceStatus,
        maxRecipients: MAX_SEND_RECIPIENTS,
        withinCap,
      })
    : null;

  async function confirm() {
    if (!review || sendLock.current || blocker) return;
    sendLock.current = true;
    dispatch({ type: "confirmStarted" });
    onPendingChange?.(true);
    const total = review.recipients.length;
    try {
      dispatch({
        type: "transactionAwaiting",
        stage: "transfer",
        label:
          total === 1
            ? "Confirm the transfer in your wallet…"
            : `Confirm ${total} transfers in your wallet…`,
      });
      await send(
        review.recipients.map((recipient) => ({
          address: recipient.address,
          amount: microsToAmount(recipient.amountUsdMicros),
        })),
        account.data?.unified ?? false,
      );
      dispatch({ type: "confirmSucceeded" });
    } catch (error) {
      const cause = error instanceof PartialSendError ? error.cause : error;
      const sent = error instanceof PartialSendError ? error.sent.length : 0;
      const message = sendErrorMessage(cause, "The send did not go through. Nothing was sent.");
      dispatch({ type: "transactionCleared" });
      dispatch({
        type: "setError",
        error:
          sent > 0
            ? `${sent} of ${total} transfers went through. ${message.replace("Nothing was sent.", "")} Check Activity before retrying.`.trim()
            : message,
      });
      dispatch({ type: "confirmFinished" });
    } finally {
      sendLock.current = false;
      onPendingChange?.(false);
    }
  }

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!isSignedIn) {
      dispatch({ type: "setError", error: "Sign in to continue" });
      return;
    }
    const result = validateReviewPayload(mode, singleAddress, singleAmount, rows);
    if (!result.review) {
      dispatch({ type: "validationFailed", error: result.error, fieldErrors: result.fieldErrors });
      return;
    }
    dispatch({ type: "reviewReady", review: result.review });
  }

  return (
    <SendFormStepView
      state={state}
      isSignedIn={isSignedIn}
      liveTotalLabel={liveTotalMicros === null ? null : formatUsdFromMicros(liveTotalMicros)}
      balanceMessage={getBalanceMessage({ isSignedIn, balanceStatus, available })}
      balanceIsError={account.isError}
      balanceInsufficient={balanceStatus === "insufficient"}
      balanceUnavailable={balanceStatus === "error"}
      reviewBlocker={blocker}
      canConfirm={Boolean(review) && !confirming && blocker === null}
      onRetryBalance={() => void account.refetch()}
      onSubmit={onSubmit}
      dispatch={dispatch}
      onConfirm={() => void confirm()}
      onBack={() => dispatch({ type: "backToCompose" })}
      onReset={() => dispatch({ type: "reset" })}
    />
  );
}
