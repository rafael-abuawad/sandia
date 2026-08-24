"use client";

import { useMemo, useReducer } from "react";
import { formatUsdFromMicros, parseUsdToMicros } from "@/lib/money";
import { useSignedInWallet } from "@/lib/use-signed-in-wallet";
import { buildReviewPayload } from "@/components/send-form/helpers";
import { SendComposeForm } from "@/components/send-form/compose-form";
import { SendReviewPanel } from "@/components/send-form/review-panel";
import { SendSuccessPanel } from "@/components/send-form/success-panel";
import { createInitialSendFormState, sendFormReducer } from "@/components/send-form/state";

export function SendForm() {
  const { isSignedIn } = useSignedInWallet();
  const [state, dispatch] = useReducer(sendFormReducer, undefined, createInitialSendFormState);
  const { mode, step, singleAddress, singleAmount, rows, review, error, confirming } = state;

  const liveTotalLabel = useMemo(() => {
    if (mode === "single") {
      try {
        return formatUsdFromMicros(parseUsdToMicros(singleAmount));
      } catch {
        return null;
      }
    }

    let total = 0;
    for (const row of rows) {
      try {
        total += parseUsdToMicros(row.amount);
      } catch {
        return null;
      }
    }
    return total > 0 ? formatUsdFromMicros(total) : null;
  }, [mode, singleAmount, rows]);

  function onContinue(e: React.FormEvent) {
    e.preventDefault();
    dispatch({ type: "setError", error: null });
    if (!isSignedIn) {
      dispatch({ type: "setError", error: "Sign in to continue" });
      return;
    }
    try {
      const payload = buildReviewPayload(mode, singleAddress, singleAmount, rows);
      dispatch({ type: "reviewReady", review: payload });
    } catch (err) {
      dispatch({
        type: "setError",
        error: err instanceof Error ? err.message : "Invalid send details",
      });
    }
  }

  async function onConfirm() {
    dispatch({ type: "confirmStarted" });
    try {
      // Demo only — batch transfer contract not wired yet.
      await new Promise((resolve) => setTimeout(resolve, 700));
      dispatch({ type: "confirmSucceeded" });
    } finally {
      dispatch({ type: "confirmFinished" });
    }
  }

  if (step === "success" && review) {
    return <SendSuccessPanel review={review} onReset={() => dispatch({ type: "reset" })} />;
  }

  if (step === "review" && review) {
    return (
      <SendReviewPanel
        review={review}
        error={error}
        confirming={confirming}
        onBack={() => dispatch({ type: "backToCompose" })}
        onConfirm={() => void onConfirm()}
      />
    );
  }

  return (
    <SendComposeForm
      mode={mode}
      singleAddress={singleAddress}
      singleAmount={singleAmount}
      rows={rows}
      liveTotalLabel={liveTotalLabel}
      error={error}
      isConnected={isSignedIn}
      dispatch={dispatch}
      onSubmit={onContinue}
    />
  );
}
