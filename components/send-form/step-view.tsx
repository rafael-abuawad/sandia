"use client";

import { SendComposeForm } from "@/components/send-form/compose-form";
import { SendReviewPanel } from "@/components/send-form/review-panel";
import { SendSuccessPanel } from "@/components/send-form/success-panel";
import type { SendFormState } from "@/components/send-form/state";

export function SendFormStepView({
  state,
  isSignedIn,
  liveTotalLabel,
  balanceMessage,
  balanceIsError,
  balanceInsufficient,
  balanceUnavailable,
  reviewBlocker,
  canConfirm,
  onRetryBalance,
  onSubmit,
  dispatch,
  onConfirm,
  onBack,
  onRetryActivity,
  onReset,
}: {
  state: SendFormState;
  isSignedIn: boolean;
  liveTotalLabel: string | null;
  balanceMessage: string | null;
  balanceIsError: boolean;
  balanceInsufficient: boolean;
  balanceUnavailable: boolean;
  reviewBlocker: string | null;
  canConfirm: boolean;
  onRetryBalance: () => void;
  onSubmit: (event: React.FormEvent) => void;
  dispatch: React.Dispatch<import("@/components/send-form/state").SendFormAction>;
  onConfirm: () => void;
  onBack: () => void;
  onRetryActivity: () => void;
  onReset: () => void;
}) {
  const { step, review } = state;

  if (step === "success" && review) {
    return (
      <SendSuccessPanel
        review={review}
        transactionHash={state.progress.hash}
        activityError={state.activityError}
        activitySyncing={state.progress.phase === "recording"}
        onRetryActivity={onRetryActivity}
        onReset={onReset}
      />
    );
  }

  if (step === "review" && review) {
    return (
      <SendReviewPanel
        review={review}
        error={state.error}
        blocker={reviewBlocker}
        confirming={state.confirming}
        canConfirm={canConfirm}
        progress={state.progress}
        balanceUnavailable={balanceUnavailable}
        onRetryBalance={onRetryBalance}
        onBack={onBack}
        onConfirm={onConfirm}
      />
    );
  }

  return (
    <SendComposeForm
      mode={state.mode}
      singleAddress={state.singleAddress}
      singleAmount={state.singleAmount}
      rows={state.rows}
      liveTotalLabel={liveTotalLabel}
      error={state.error}
      fieldErrors={state.fieldErrors}
      isConnected={isSignedIn}
      balanceMessage={balanceMessage}
      balanceIsError={balanceIsError}
      balanceInsufficient={balanceInsufficient}
      onRetryBalance={onRetryBalance}
      validationAttempt={state.validationAttempt}
      dispatch={dispatch}
      onSubmit={onSubmit}
    />
  );
}
