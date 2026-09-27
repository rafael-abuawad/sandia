"use client";

import { useMemo, useReducer } from "react";
import { erc20Abi, type Address, type Hex } from "viem";
import { usePublicClient, useReadContract, useWriteContract } from "wagmi";
import { useAction, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { formatUsdFromMicros, parseUsdToMicros } from "@/lib/money";
import { ROBINHOOD_USDG } from "@/lib/destination";
import { useSignedInWallet } from "@/lib/use-signed-in-wallet";
import {
  buildSandiaSendCall,
  buildUsdgTransferCalls,
  MAX_SEND_RECIPIENTS,
  sandiaSendAbi,
  sandiaSendAddress,
} from "@/lib/send/calls";
import { buildReviewPayload } from "@/components/send-form/helpers";
import { SendComposeForm } from "@/components/send-form/compose-form";
import { SendReviewPanel } from "@/components/send-form/review-panel";
import { SendSuccessPanel } from "@/components/send-form/success-panel";
import { createInitialSendFormState, sendFormReducer } from "@/components/send-form/state";
import { userFacingError } from "@/lib/user-facing-error";

function isSandiaSendConfigured(): boolean {
  try {
    sandiaSendAddress();
    return true;
  } catch {
    return false;
  }
}

export function SendForm() {
  const { isSignedIn, address, chainId } = useSignedInWallet();
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient({ chainId: ROBINHOOD_USDG.chainId });
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
        error: userFacingError(err, "Check the recipient and amount, then try again."),
      });
    }
  }

  const onRobinhood = chainId === ROBINHOOD_USDG.chainId;
  const enoughBalance =
    review !== null && balance !== undefined && balance >= BigInt(review.totalUsdMicros);
  const withinCap = (review?.recipients.length ?? 0) <= MAX_SEND_RECIPIENTS;
  const isBatch = (review?.recipients.length ?? 0) > 1;
  const sendConfigured = !isBatch || isSandiaSendConfigured();
  const canConfirm = Boolean(
    review && onRobinhood && enoughBalance && withinCap && sendConfigured && !confirming,
  );

  async function recordFilled(
    userOpHash: Hex,
    calls: Array<{ recipient: Address; amount: bigint }>,
  ) {
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

  async function onConfirm() {
    if (!review) return;
    dispatch({ type: "confirmStarted" });
    dispatch({ type: "setError", error: null });
    try {
      if (!onRobinhood) {
        throw new Error("Switch to Robinhood Chain to send USDG.");
      }
      if (!enoughBalance) {
        throw new Error("This wallet doesn't have enough USDG on Robinhood Chain.");
      }
      const recipientInputs = review.recipients.map((row) => ({
        address: row.address,
        amountUsdMicros: row.amountUsdMicros,
      }));

      if (recipientInputs.length > 1) {
        if (!address) throw new Error("Sign in to send USDG.");
        if (!publicClient) {
          throw new Error("Robinhood Chain is not reachable. Refresh and try again.");
        }
        const batch = buildSandiaSendCall(recipientInputs);
        const allowance = await publicClient.readContract({
          address: ROBINHOOD_USDG.address as Address,
          abi: erc20Abi,
          functionName: "allowance",
          args: [address, batch.to],
        });
        if (allowance < batch.total) {
          // Approval must mine before sandia_send so the allowance and nonce are ready.
          const approveHash = await writeContractAsync({
            address: ROBINHOOD_USDG.address as Address,
            abi: erc20Abi,
            functionName: "approve",
            args: [batch.to, batch.total],
            chainId: ROBINHOOD_USDG.chainId,
          });
          const approveReceipt = await publicClient.waitForTransactionReceipt({
            hash: approveHash,
          });
          if (approveReceipt.status !== "success") {
            throw new Error("USDG approval did not confirm. Try again.");
          }
        }
        const hash = await writeContractAsync({
          address: batch.to,
          abi: sandiaSendAbi,
          functionName: "sandia_send",
          args: [batch.recipients, ROBINHOOD_USDG.address as Address],
          chainId: ROBINHOOD_USDG.chainId,
        });
        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        if (receipt.status !== "success") {
          throw new Error("The batch send did not confirm. Try again.");
        }
        await recordFilled(
          hash,
          batch.recipients.map((row) => ({ recipient: row.account, amount: row.amount })),
        );
      } else {
        const [call] = buildUsdgTransferCalls(recipientInputs);
        if (!call) throw new Error("Add a recipient");
        const hash = await writeContractAsync({
          address: ROBINHOOD_USDG.address as Address,
          abi: erc20Abi,
          functionName: "transfer",
          args: [call.recipient, call.amount],
          chainId: ROBINHOOD_USDG.chainId,
        });
        if (publicClient) {
          await publicClient.waitForTransactionReceipt({ hash });
        }
        await recordFilled(hash, [{ recipient: call.recipient, amount: call.amount }]);
      }
      dispatch({ type: "confirmSucceeded" });
    } catch (err) {
      dispatch({
        type: "setError",
        error: userFacingError(err, "Send could not be submitted. Try again."),
      });
    } finally {
      dispatch({ type: "confirmFinished" });
    }
  }

  if (step === "success" && review) {
    return <SendSuccessPanel review={review} onReset={() => dispatch({ type: "reset" })} />;
  }

  const sendBlocker =
    review === null
      ? null
      : !onRobinhood
        ? "Switch to Robinhood Chain to send USDG."
        : balance === undefined
          ? "Checking your USDG balance…"
          : !enoughBalance
            ? "This wallet doesn't have enough USDG on Robinhood Chain."
            : !withinCap
              ? `A send can include at most ${MAX_SEND_RECIPIENTS} recipients.`
              : !sendConfigured
                ? "Sandia Send is not configured."
                : null;

  if (step === "review" && review) {
    return (
      <SendReviewPanel
        review={review}
        error={error}
        blocker={sendBlocker}
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
