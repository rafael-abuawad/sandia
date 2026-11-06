"use client";

import { useMemo, useReducer, useRef } from "react";
import { useAction, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { formatUsdFromMicros } from "@/lib/money";
import { MAX_SEND_RECIPIENTS, STELLAR_USDC } from "@/lib/stellar/constants";
import { fetchAccountState, fetchTransaction } from "@/lib/stellar/horizon";
import { useStellarAccount } from "@/lib/stellar/use-account";
import { useStellarSigner } from "@/lib/stellar/use-signer";
import { useSignedInWallet } from "@/lib/use-signed-in-wallet";
import type { SendDependencies, SubmittedSendTransaction } from "@/lib/send/execute";
import { getBalanceStatus } from "@/lib/send/view-state";
import { createSendController } from "@/components/send-form/controller";
import {
  canConfirmSend,
  getBalanceMessage,
  getLiveTotalMicros,
  getReviewBlocker,
} from "@/components/send-form/view-model";
import { submitSendReview } from "@/components/send-form/handlers";
import { SendFormStepView } from "@/components/send-form/step-view";
import { createInitialSendFormState, sendFormReducer } from "@/components/send-form/state";

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
  const sign = useStellarSigner(address);
  const recordSend = useMutation(api.sends.record);
  const confirmSend = useAction(api.sendsActions.confirm);
  const submitSponsored = useAction(api.stellarSponsor.submitSponsored);
  const account = useStellarAccount(address);
  const balance = account.data?.usdcBalance;
  const [state, dispatch] = useReducer(sendFormReducer, initialValues, createInitialSendFormState);
  const { mode, singleAddress, singleAmount, singleMemo, rows, review, confirming, progress } =
    state;
  const sendLock = useRef(false);
  const submittedTransaction = useRef<SubmittedSendTransaction | null>(null);

  const liveTotalMicros = getLiveTotalMicros(mode, singleAmount, rows);
  const liveTotalLabel = liveTotalMicros === null ? null : formatUsdFromMicros(liveTotalMicros);

  const balanceStatus = getBalanceStatus({
    loading: account.isLoading || account.isFetching,
    error: account.isError,
    balance,
    amountMicros: review?.totalUsdMicros ?? liveTotalMicros,
  });
  const withinCap = (review?.recipients.length ?? 0) <= MAX_SEND_RECIPIENTS;
  const checkingPendingTransaction = progress.phase === "pending" && progress.hash !== null;
  const canConfirm = canConfirmSend({
    review,
    confirming,
    pendingTransaction: checkingPendingTransaction,
    isSignedIn,
    balanceStatus,
    withinCap,
  });

  const deps = useMemo<SendDependencies>(
    () => ({
      loadAccount: fetchAccountState,
      lookupTransaction: fetchTransaction,
      sign,
      submit: (xdr) => submitSponsored({ xdr }),
    }),
    [sign, submitSponsored],
  );

  const controller = createSendController({
    review,
    address,
    deps,
    dispatch,
    sendLock,
    submittedTransaction,
    recordSend,
    confirmSend,
    refetchBalance: () => account.refetch(),
    onPendingChange,
  });

  return (
    <SendFormStepView
      state={state}
      isSignedIn={isSignedIn}
      liveTotalLabel={liveTotalLabel}
      balanceMessage={getBalanceMessage({
        isSignedIn,
        balanceStatus,
        balance,
        decimals: STELLAR_USDC.decimals,
      })}
      balanceIsError={account.isError}
      balanceInsufficient={balanceStatus === "insufficient"}
      balanceUnavailable={balanceStatus === "error"}
      reviewBlocker={getReviewBlocker({
        review,
        pendingTransaction: checkingPendingTransaction,
        isSignedIn,
        balanceStatus,
        withinCap,
      })}
      canConfirm={canConfirm}
      onRetryBalance={() => void account.refetch()}
      onSubmit={(event) =>
        submitSendReview({
          event,
          isSignedIn,
          mode,
          singleAddress,
          singleAmount,
          singleMemo,
          rows,
          dispatch,
        })
      }
      dispatch={dispatch}
      onConfirm={() => void controller.confirm()}
      onBack={() => dispatch({ type: "backToCompose" })}
      onRetryActivity={() => void controller.retryActivity()}
      onReset={controller.resetTransaction}
    />
  );
}
