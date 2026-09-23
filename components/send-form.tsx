"use client";

import { useMemo, useReducer } from "react";
import { erc20Abi, type Address } from "viem";
import { useReadContract, useSendCalls } from "wagmi";
import { useAction, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { formatUsdFromMicros, parseUsdToMicros } from "@/lib/money";
import { ROBINHOOD_USDG } from "@/lib/destination";
import { useSignedInWallet } from "@/lib/use-signed-in-wallet";
import { buildUsdgTransferCalls, MAX_SEND_RECIPIENTS } from "@/lib/send/calls";
import { buildReviewPayload } from "@/components/send-form/helpers";
import { SendComposeForm } from "@/components/send-form/compose-form";
import { SendReviewPanel } from "@/components/send-form/review-panel";
import { SendSuccessPanel } from "@/components/send-form/success-panel";
import { createInitialSendFormState, sendFormReducer } from "@/components/send-form/state";

export function SendForm() {
  const { isSignedIn, address, chainId, connectorId } = useSignedInWallet();
  const { sendCallsAsync } = useSendCalls();
  const recordSend = useMutation(api.outbound.record);
  const attachBundle = useAction(api.outboundActions.attachBundle);
  const { data: balance } = useReadContract({
    address: ROBINHOOD_USDG.address as Address,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    chainId: ROBINHOOD_USDG.chainId,
    query: { enabled: Boolean(address) },
  });
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

  const kernelReady =
    chainId === ROBINHOOD_USDG.chainId && (connectorId ?? "").toLowerCase().includes("zero");
  const enoughBalance =
    review !== null && balance !== undefined && balance >= BigInt(review.totalUsdMicros);
  const withinCap = (review?.recipients.length ?? 0) <= MAX_SEND_RECIPIENTS;
  const canConfirm = Boolean(review && kernelReady && enoughBalance && withinCap && !confirming);

  async function onConfirm() {
    if (!review) return;
    dispatch({ type: "confirmStarted" });
    dispatch({ type: "setError", error: null });
    try {
      if (!kernelReady) {
        throw new Error(
          "USDG batch send runs from a Sandia account on Robinhood Chain. Nothing was sent.",
        );
      }
      if (!enoughBalance) {
        throw new Error("USDG balance is below the batch total. Nothing was sent.");
      }
      const calls = buildUsdgTransferCalls(
        review.recipients.map((row) => ({
          address: row.address,
          amountUsdMicros: row.amountUsdMicros,
        })),
      );
      const sent = await sendCallsAsync({
        calls: calls.map((call) => ({ to: call.to, data: call.data, value: call.value })),
      });
      const userOpHash = typeof sent.id === "string" ? sent.id : "";
      await recordSend({
        userOpHash,
        calls: calls.map((call) => ({
          recipient: call.recipient,
          amount: call.amount.toString(),
        })),
      });
      if (!userOpHash.startsWith("0x") || userOpHash.length !== 66) {
        throw new Error(
          "The batch was submitted, but success waits for a Robinhood transaction receipt.",
        );
      }
      const verified = await attachBundle({ userOpHash, bundleTxHash: userOpHash });
      if (verified.status !== "filled") {
        throw new Error(verified.reason ?? "The receipt did not pay every recipient.");
      }
      dispatch({ type: "confirmSucceeded" });
    } catch (err) {
      dispatch({
        type: "setError",
        error: err instanceof Error ? err.message : "Send failed",
      });
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
        canConfirm={canConfirm}
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
