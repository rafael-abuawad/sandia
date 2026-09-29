"use client";

import { useEffect, useReducer, useRef } from "react";
import { erc20Abi, type Address } from "viem";
import { getEmbeddedConnectedWallet, useSendTransaction, useWallets } from "@privy-io/react-auth";
import { usePublicClient, useReadContract } from "wagmi";
import { useAction, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { formatUsdFromMicros } from "@/lib/money";
import { ROBINHOOD_USDG } from "@/lib/destination";
import { useSignedInWallet } from "@/lib/use-signed-in-wallet";
import { MAX_SEND_RECIPIENTS, sandiaSendAddress } from "@/lib/send/calls";
import type { SubmittedSendTransaction } from "@/lib/send/execute";
import { getBalanceStatus } from "@/lib/send/view-state";
import { createSendController } from "@/components/send-form/controller";
import {
  canConfirmSend,
  getBalanceMessage,
  getLiveTotalMicros,
  getReviewBlocker,
} from "@/components/send-form/view-model";
import {
  createSponsoredSender,
  maybeSwitchEmbeddedChain,
  submitSendReview,
} from "@/components/send-form/handlers";
import { SendFormStepView } from "@/components/send-form/step-view";
import { createInitialSendFormState, sendFormReducer } from "@/components/send-form/state";
import type { SendExecutionClient } from "@/lib/send/execute";

function isSandiaSendConfigured(): boolean {
  try {
    sandiaSendAddress();
    return true;
  } catch {
    return false;
  }
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
  const { isSignedIn, address, chainId } = useSignedInWallet();
  const { wallets } = useWallets();
  const { sendTransaction } = useSendTransaction();
  const publicClient = usePublicClient({ chainId: ROBINHOOD_USDG.chainId });
  const recordSend = useMutation(api.outbound.record);
  const attachBundle = useAction(api.outboundActions.attachBundle);
  const {
    data: balance,
    isLoading: balanceLoading,
    isFetching: balanceFetching,
    isError: balanceIsError,
    refetch: refetchBalance,
  } = useReadContract({
    address: ROBINHOOD_USDG.address as Address,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    chainId: ROBINHOOD_USDG.chainId,
    query: { enabled: Boolean(address) },
  });
  const [state, dispatch] = useReducer(sendFormReducer, initialValues, createInitialSendFormState);
  const { mode, singleAddress, singleAmount, rows, review, confirming, progress } = state;
  const attemptedChainSwitch = useRef<string | null>(null);
  const sendLock = useRef(false);
  const submittedTransaction = useRef<SubmittedSendTransaction | null>(null);
  const embedded = getEmbeddedConnectedWallet(wallets);

  useEffect(() => {
    maybeSwitchEmbeddedChain({
      isSignedIn,
      address,
      chainId,
      embedded,
      attemptedChainSwitch,
      targetChainId: ROBINHOOD_USDG.chainId,
    });
  }, [isSignedIn, address, embedded, chainId]);

  const liveTotalMicros = getLiveTotalMicros(mode, singleAmount, rows);
  const liveTotalLabel = liveTotalMicros === null ? null : formatUsdFromMicros(liveTotalMicros);

  const balanceStatus = getBalanceStatus({
    loading: balanceLoading || balanceFetching,
    error: balanceIsError,
    balance,
    amountMicros: review?.totalUsdMicros ?? liveTotalMicros,
  });
  const withinCap = (review?.recipients.length ?? 0) <= MAX_SEND_RECIPIENTS;
  const isBatch = (review?.recipients.length ?? 0) > 1;
  const sendConfigured = !isBatch || isSandiaSendConfigured();
  const chainReady = chainId === ROBINHOOD_USDG.chainId;
  const checkingPendingTransaction = progress.phase === "pending" && progress.hash !== null;
  const canConfirm = canConfirmSend({
    review,
    confirming,
    pendingTransaction: checkingPendingTransaction,
    isSignedIn,
    chainReady,
    balanceStatus,
    withinCap,
    sendConfigured,
  });
  const sendSponsored = createSponsoredSender({ address, sendTransaction, dispatch });

  const controller = createSendController({
    review,
    address,
    chainId,
    client: publicClient as SendExecutionClient | undefined,
    dispatch,
    sendLock,
    submittedTransaction,
    sendSponsored,
    recordSend,
    attachBundle,
    refetchBalance,
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
        decimals: ROBINHOOD_USDG.decimals,
      })}
      balanceIsError={balanceIsError}
      balanceInsufficient={balanceStatus === "insufficient"}
      balanceUnavailable={balanceStatus === "error"}
      reviewBlocker={getReviewBlocker({
        review,
        pendingTransaction: checkingPendingTransaction,
        isSignedIn,
        chainReady,
        balanceStatus,
        withinCap,
        sendConfigured,
      })}
      canConfirm={canConfirm}
      onRetryBalance={() => void refetchBalance()}
      onSubmit={(event) =>
        submitSendReview({ event, isSignedIn, mode, singleAddress, singleAmount, rows, dispatch })
      }
      dispatch={dispatch}
      onConfirm={() => void controller.confirm()}
      onBack={() => dispatch({ type: "backToCompose" })}
      onRetryActivity={() => void controller.retryActivity()}
      onReset={controller.resetTransaction}
    />
  );
}
