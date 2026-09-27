"use client";

import { useCallback, useEffect, useMemo, useReducer, useRef } from "react";
import {
  useAccount,
  useBalance,
  useReadContract,
  useSendTransaction,
  useSwitchChain,
  useWaitForTransactionReceipt,
} from "wagmi";
import { useAction, usePaginatedQuery, useQuery } from "convex/react";
import { type Hex, type Address, createPublicClient, erc20Abi, http } from "viem";
import { api } from "@/convex/_generated/api";
import type { ChainOption, TokenOption } from "@/components/token-chain-select";
import {
  fetchAcrossChains,
  fetchAcrossTokens,
  quoteFundingGap,
  type AcrossSwapQuote,
} from "@/lib/across/client";
import { appChains, PAYER_CHAIN_IDS, isPayerTokenAllowed, displayTokenSymbol } from "@/lib/chains";
import { isDirectUsdgPay, isRobinhoodEthPay, ROBINHOOD_USDG } from "@/lib/destination";
import { ethSpendBaseUnits } from "@/lib/zerox-quote";
import { buildUsdgPaymentTransfer } from "@/lib/send/calls";
import { initialPayFlowState, payFlowReducer, type SentPayment } from "@/components/pay-flow/state";
import { statusLabel } from "@/components/status-badge";
import { userFacingError } from "@/lib/user-facing-error";

const CHAIN_ORDER = [1, 8453, 42161, 10, 137, 56, 43114, 143, 4663];
const SYMBOL_ORDER = [
  "USDC",
  "USDT",
  "USDT0",
  "DAI",
  "CRVUSD",
  "WETH",
  "ETH",
  "USDG",
  "WBNB",
  "BNB",
  "WAVAX",
  "AVAX",
  "WMATIC",
  "MATIC",
  "WPOL",
  "POL",
  "WMON",
  "MON",
];

export type DirectPayBalance = "loading" | "short" | "ready" | "unavailable";

const TRACKED_MESSAGE: Record<SentPayment["kind"], string> = {
  across: "Deposit submitted. Waiting for settlement…",
  direct: "Transfer submitted. Confirming settlement…",
  eth: "Swap submitted. Confirming settlement…",
};

function acrossStatusCopy(status: string): string {
  switch (status) {
    case "submitted":
      return "Submitted — waiting for the bridge.";
    case "pending":
      return "Bridging to Robinhood Chain…";
    case "filled":
      return "Payment settled on Robinhood Chain.";
    default:
      return `Bridge status: ${statusLabel(status)}.`;
  }
}

function settlementStatusCopy(status: string, direct: boolean): string {
  if (!direct) return acrossStatusCopy(status);
  if (status === "filled") return "Payment settled on Robinhood Chain.";
  if (status === "submitted" || status === "pending") return "Confirming the USDG transfer…";
  return `Transfer status: ${statusLabel(status)}.`;
}

async function waitForHash(hash: Hex, chainId: number) {
  const chain = appChains.find((c) => c.id === chainId);
  const client = createPublicClient({
    chain: chain ?? appChains[0],
    transport: http(chain?.rpcUrls.default.http[0]),
  });
  await client.waitForTransactionReceipt({ hash, timeout: 180_000 });
  return hash;
}

export function usePayFlow(publicId: string) {
  const request = useQuery(api.paymentRequests.getByPublicId, { publicId });
  const { results: attempts } = usePaginatedQuery(
    api.paymentAttempts.listByRequest,
    { publicId },
    { initialNumItems: 20 },
  );
  const quoteSwap = useAction(api.across.quoteSwap);
  const quoteEthToUsdg = useAction(api.zerox.quoteEthToUsdg);
  const submitDeposit = useAction(api.across.submitDeposit);
  const submitDirect = useAction(api.directSettlement.submitDirect);
  const submitEthSwap = useAction(api.zerox.submitEthSwap);
  const syncStatus = useAction(api.across.syncDepositStatus);

  const { address, chainId, isConnected } = useAccount();
  const { switchChainAsync } = useSwitchChain();
  const { sendTransactionAsync } = useSendTransaction();

  const [state, dispatch] = useReducer(payFlowReducer, initialPayFlowState);
  const quoteGeneration = useRef(0);
  const {
    chains,
    tokens,
    originChainId,
    inputToken,
    quote,
    ethQuote,
    tradeType,
    quoteError,
    step,
    statusMsg,
    depositTxnRef,
    pendingTx,
    unverifiedPayment,
  } = state;

  const { isSuccess: txSuccess, isError: txError } = useWaitForTransactionReceipt({
    hash: pendingTx,
  });

  const chainOptions: ChainOption[] = useMemo(() => {
    return [...chains]
      .sort((a, b) => {
        const ai = CHAIN_ORDER.indexOf(a.chainId);
        const bi = CHAIN_ORDER.indexOf(b.chainId);
        return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
      })
      .map((c) => ({
        value: String(c.chainId),
        name: c.name.replace(" Smart Chain", "").replace(" Chain", ""),
        logoUrl: c.logoUrl,
      }));
  }, [chains]);

  const tokenOptions: TokenOption[] = useMemo(() => {
    if (!originChainId) return [];
    const options: Array<TokenOption & { sortSymbol: string }> = [];
    for (const t of tokens) {
      if (t.chainId !== originChainId || !isPayerTokenAllowed(t.symbol, t.address, originChainId)) {
        continue;
      }
      options.push({
        value: t.address.toLowerCase(),
        symbol: displayTokenSymbol(t.symbol),
        logoUrl: t.logoUrl,
        sortSymbol: t.symbol.toUpperCase(),
      });
    }
    options.sort((a, b) => {
      const sa = SYMBOL_ORDER.indexOf(a.sortSymbol);
      const sb = SYMBOL_ORDER.indexOf(b.sortSymbol);
      return (sa === -1 ? 999 : sa) - (sb === -1 ? 999 : sb);
    });
    return options.map(({ sortSymbol: _s, ...option }) => option);
  }, [tokens, originChainId]);

  function onChainChange(value: string) {
    dispatch({ type: "originChainChanged", chainId: Number(value) });
  }

  function onTokenChange(value: string) {
    const direct = isDirectUsdgPay(originChainId, value);
    dispatch({
      type: "inputTokenChanged",
      token: value,
      nextStep: !direct && isConnected && address ? "quoting" : "idle",
    });
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [c, t] = await Promise.all([fetchAcrossChains(), fetchAcrossTokens()]);
        if (cancelled) return;
        dispatch({
          type: "routesLoaded",
          chains: c.filter((ch) => PAYER_CHAIN_IDS.has(ch.chainId)),
          tokens: t.filter(
            (token) =>
              PAYER_CHAIN_IDS.has(token.chainId) &&
              isPayerTokenAllowed(token.symbol, token.address, token.chainId),
          ),
        });
      } catch (e) {
        if (!cancelled) {
          dispatch({
            type: "routesFailed",
            error: userFacingError(
              e,
              "Chains and tokens could not be loaded. Refresh and try again.",
            ),
          });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (originChainId !== null || !chains.length) return;
    const base = chains.find((c) => c.chainId === 8453) ?? chains[0];
    if (base) dispatch({ type: "preferOriginChain", chainId: base.chainId });
  }, [chains, originChainId]);

  useEffect(() => {
    if (!originChainId || !inputToken) return;
    const stillValid = tokens.some(
      (t) =>
        t.chainId === originChainId &&
        t.address.toLowerCase() === inputToken.toLowerCase() &&
        isPayerTokenAllowed(t.symbol, t.address, originChainId),
    );
    if (!stillValid) dispatch({ type: "clearInvalidToken" });
  }, [originChainId, tokens, inputToken]);

  const directPay = isDirectUsdgPay(originChainId, inputToken);
  const robinhoodEth = isRobinhoodEthPay(originChainId, inputToken);
  const {
    data: usdgBalance,
    isPending: usdgBalancePending,
    isError: usdgBalanceError,
  } = useReadContract({
    address: ROBINHOOD_USDG.address as Address,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    chainId: ROBINHOOD_USDG.chainId,
    query: { enabled: Boolean(address && directPay) },
  });
  const {
    data: nativeBalance,
    isPending: ethBalancePending,
    isError: ethBalanceError,
  } = useBalance({
    address,
    chainId: ROBINHOOD_USDG.chainId,
    query: { enabled: Boolean(address && robinhoodEth) },
  });

  const refreshQuote = useCallback(async () => {
    if (!request || !address || !originChainId || !inputToken) return;
    if (isDirectUsdgPay(originChainId, inputToken)) return;
    if (request.status !== "open" && request.status !== "pending") return;

    if (isRobinhoodEthPay(originChainId, inputToken)) {
      const generation = ++quoteGeneration.current;
      dispatch({ type: "quoteStarted" });
      try {
        const raw = await quoteEthToUsdg({ publicId, taker: address });
        if (quoteGeneration.current !== generation) return;
        dispatch({ type: "ethQuoteSucceeded", quote: raw });
      } catch (e) {
        if (quoteGeneration.current !== generation) return;
        dispatch({
          type: "quoteFailed",
          error: userFacingError(e, "No route is available for this token. Try another one."),
        });
      }
      return;
    }

    const generation = ++quoteGeneration.current;
    dispatch({ type: "quoteStarted" });
    try {
      let raw;
      let tt: "exactOutput" | "minOutput" = "exactOutput";
      try {
        raw = await quoteSwap({
          publicId,
          inputToken,
          originChainId,
          depositor: address,
          tradeType: "exactOutput",
        });
      } catch {
        tt = "minOutput";
        raw = await quoteSwap({
          publicId,
          inputToken,
          originChainId,
          depositor: address,
          tradeType: "minOutput",
        });
      }
      if (quoteGeneration.current !== generation) return;
      const q = raw as AcrossSwapQuote;
      if (q.quoteExpiryTimestamp && q.quoteExpiryTimestamp * 1000 < Date.now()) {
        throw new Error("Quote expired before display — try again");
      }
      dispatch({ type: "quoteSucceeded", quote: q, tradeType: tt });
    } catch (e) {
      if (quoteGeneration.current !== generation) return;
      dispatch({
        type: "quoteFailed",
        error: userFacingError(e, "No route is available for this token. Try another one."),
      });
    }
  }, [request, address, originChainId, inputToken, publicId, quoteSwap, quoteEthToUsdg]);

  useEffect(() => {
    if (!isConnected || !address || !request) return;
    if (request.status !== "open" && request.status !== "pending") return;
    if (!originChainId || !inputToken) return;
    if (isDirectUsdgPay(originChainId, inputToken)) {
      quoteGeneration.current += 1;
      return;
    }
    void refreshQuote();
  }, [isConnected, address, request, originChainId, inputToken, refreshQuote]);

  useEffect(() => {
    if (!depositTxnRef || !request) return;
    if (request.status === "completed") {
      dispatch({ type: "paymentDone" });
      return;
    }

    let cancelled = false;
    dispatch({ type: "stepChanged", step: "tracking" });

    const poll = async () => {
      try {
        const result = await syncStatus({ depositTxnRef });
        if (cancelled) return;
        if (result.acrossStatus === "filled" || result.requestStatus === "completed") {
          dispatch({
            type: "paymentDone",
            message: "Payment settled on Robinhood Chain.",
          });
          return;
        }
        if (result.attemptStatus === "failed") {
          dispatch({
            type: "paymentFailed",
            message: result.reason ?? "The fill did not match this request.",
          });
          return;
        }
        if (result.acrossStatus === "expired" || result.acrossStatus === "refunded") {
          dispatch({
            type: "paymentFailed",
            message:
              result.acrossStatus === "refunded"
                ? "This transfer was refunded. You can try again."
                : "This transfer expired. Funds will be refunded. You can try again.",
          });
          return;
        }
        dispatch({
          type: "statusChanged",
          message: settlementStatusCopy(result.acrossStatus, directPay || robinhoodEth),
        });
      } catch (e) {
        if (!cancelled) {
          dispatch({
            type: "statusChanged",
            message: userFacingError(e, "Settlement status could not be refreshed."),
          });
        }
      }
    };

    void poll();
    const id = setInterval(() => void poll(), 10_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [depositTxnRef, request, syncStatus, directPay, robinhoodEth]);

  useEffect(() => {
    const saved = window.sessionStorage.getItem(`sandia-deposit:${publicId}`);
    if (saved) {
      dispatch({ type: "depositTracked", depositTxnRef: saved });
    }
  }, [publicId]);

  const selectedToken = useMemo(
    () =>
      tokens.find(
        (t) => t.chainId === originChainId && t.address.toLowerCase() === inputToken.toLowerCase(),
      ),
    [tokens, originChainId, inputToken],
  );

  async function recordSentPayment(sent: SentPayment) {
    try {
      await waitForHash(sent.hash, sent.chainId);
      const tracked = sent.hash.toLowerCase();
      if (sent.kind === "across") {
        await submitDeposit({
          publicId,
          payerAddress: sent.payerAddress,
          ...sent.details,
          depositTxnRef: tracked,
        });
      } else if (sent.kind === "direct") {
        await submitDirect({ publicId, payerAddress: sent.payerAddress, depositTxnRef: tracked });
      } else {
        await submitEthSwap({ publicId, payerAddress: sent.payerAddress, depositTxnRef: tracked });
      }
      window.sessionStorage.setItem(`sandia-deposit:${publicId}`, tracked);
      dispatch({
        type: "depositTracked",
        depositTxnRef: tracked,
        message: TRACKED_MESSAGE[sent.kind],
      });
    } catch (e) {
      dispatch({
        type: "paymentUnverified",
        payment: sent,
        message: `${userFacingError(e, "The payment could not be confirmed yet.")} Your payment was already sent, so don't pay again.`,
      });
    }
  }

  async function retryVerification() {
    if (!unverifiedPayment) return;
    dispatch({ type: "stepChanged", step: "tracking" });
    dispatch({ type: "statusChanged", message: "Checking your payment…" });
    await recordSentPayment(unverifiedPayment);
  }

  async function executeDirectPayment() {
    if (!address || !request) return;
    const required = /^\d+$/.test(request.outputAmountBaseUnits)
      ? BigInt(request.outputAmountBaseUnits)
      : null;
    if (required === null || usdgBalance === undefined || usdgBalance < required) {
      dispatch({
        type: "paymentFailed",
        message: "This wallet doesn't have enough USDG on Robinhood Chain.",
      });
      return;
    }

    let hash: Hex;
    try {
      if (chainId !== ROBINHOOD_USDG.chainId) {
        await switchChainAsync({ chainId: ROBINHOOD_USDG.chainId });
      }
      dispatch({ type: "stepChanged", step: "paying" });
      const call = buildUsdgPaymentTransfer(
        request.recipientAddress,
        request.outputAmountBaseUnits,
      );
      hash = await sendTransactionAsync({
        to: call.to,
        data: call.data,
        value: call.value,
        chainId: ROBINHOOD_USDG.chainId,
      });
      dispatch({ type: "pendingTxSet", hash });
    } catch (e) {
      dispatch({
        type: "paymentFailed",
        message: userFacingError(e, "Payment could not be submitted. Try again."),
      });
      return;
    }
    await recordSentPayment({
      kind: "direct",
      hash,
      chainId: ROBINHOOD_USDG.chainId,
      payerAddress: address,
    });
  }

  async function executeEthPayment() {
    if (!address || !request || !ethQuote) return;
    const shown = ethSpendBaseUnits(ethQuote);

    let hash: Hex;
    try {
      const fresh = await quoteEthToUsdg({ publicId, taker: address });
      if (ethSpendBaseUnits(fresh) > shown) {
        dispatch({ type: "ethQuoteSucceeded", quote: fresh });
        dispatch({
          type: "statusChanged",
          message: "The ETH price moved. Review the updated amount, then pay again.",
        });
        return;
      }

      if (chainId !== ROBINHOOD_USDG.chainId) {
        await switchChainAsync({ chainId: ROBINHOOD_USDG.chainId });
      }
      dispatch({ type: "stepChanged", step: "paying" });
      hash = await sendTransactionAsync({
        to: fresh.transaction.to as Address,
        data: fresh.transaction.data as Hex,
        value: BigInt(fresh.transaction.value),
        gas: fresh.transaction.gas ? BigInt(fresh.transaction.gas) : undefined,
        chainId: ROBINHOOD_USDG.chainId,
      });
      dispatch({ type: "pendingTxSet", hash });
    } catch (e) {
      dispatch({
        type: "paymentFailed",
        message: userFacingError(e, "Payment could not be submitted. Try again."),
      });
      return;
    }
    await recordSentPayment({
      kind: "eth",
      hash,
      chainId: ROBINHOOD_USDG.chainId,
      payerAddress: address,
    });
  }

  async function executePayment() {
    if (directPay) {
      await executeDirectPayment();
      return;
    }
    if (robinhoodEth) {
      await executeEthPayment();
      return;
    }
    if (!quote?.swapTx || !address || !request || !originChainId || !inputToken) {
      return;
    }
    if (quote.quoteExpiryTimestamp && quote.quoteExpiryTimestamp * 1000 < Date.now()) {
      dispatch({
        type: "quoteFailed",
        error: "Quote expired — refreshing…",
      });
      await refreshQuote();
      return;
    }

    let hash: Hex;
    let swapChainId: number;
    try {
      if (chainId !== originChainId) {
        await switchChainAsync({ chainId: originChainId });
      }

      if (quote.approvalTxns?.length) {
        dispatch({ type: "stepChanged", step: "approving" });
        // Approvals are ordered: each mined tx updates nonce/allowance for the next.
        // react-doctor-disable-next-line react-doctor/async-await-in-loop
        for (const approval of quote.approvalTxns) {
          if (chainId !== approval.chainId) {
            await switchChainAsync({ chainId: approval.chainId });
          }
          const hash = await sendTransactionAsync({
            to: approval.to as Address,
            data: approval.data as Hex,
            chainId: approval.chainId,
          });
          dispatch({ type: "pendingTxSet", hash });
          await waitForHash(hash, approval.chainId);
        }
      }

      dispatch({ type: "stepChanged", step: "paying" });
      const swap = quote.swapTx;
      if (chainId !== swap.chainId) {
        await switchChainAsync({ chainId: swap.chainId });
      }
      hash = await sendTransactionAsync({
        to: swap.to as Address,
        data: swap.data as Hex,
        value: swap.value ? BigInt(swap.value) : undefined,
        gas: swap.gas ? BigInt(swap.gas) : undefined,
        chainId: swap.chainId,
      });
      swapChainId = swap.chainId;
      dispatch({ type: "pendingTxSet", hash });
    } catch (e) {
      dispatch({
        type: "paymentFailed",
        message: userFacingError(e, "Payment could not be submitted. Try again."),
      });
      return;
    }
    await recordSentPayment({
      kind: "across",
      hash,
      chainId: swapChainId,
      payerAddress: address,
      details: {
        originChainId,
        inputToken,
        quotedInputAmount: quote.inputAmount ?? quote.maxInputAmount ?? "0",
        expectedOutputAmount: quote.expectedOutputAmount ?? request.outputAmountBaseUnits,
        minOutputAmount: quote.minOutputAmount ?? request.outputAmountBaseUnits,
        feesJson: JSON.stringify(quote.fees ?? {}),
        quoteId: quote.id,
      },
    });
  }

  const paymentInProgress = request?.status === "pending" && !depositTxnRef;
  const fundingGap = quote ? quoteFundingGap(quote) : null;
  const simulationBlocked =
    quote?.swapTx?.simulationSuccess === false && fundingGap !== "allowance";

  const requiredUsdg =
    directPay && request && /^\d+$/.test(request.outputAmountBaseUnits)
      ? BigInt(request.outputAmountBaseUnits)
      : null;
  const directBalance: DirectPayBalance | null = !directPay
    ? null
    : usdgBalanceError
      ? "unavailable"
      : usdgBalancePending || usdgBalance === undefined || requiredUsdg === null
        ? "loading"
        : usdgBalance < requiredUsdg
          ? "short"
          : "ready";

  const requiredEth = robinhoodEth && ethQuote ? ethSpendBaseUnits(ethQuote) : null;
  const ethBalance: DirectPayBalance | null = !robinhoodEth
    ? null
    : ethBalanceError
      ? "unavailable"
      : ethBalancePending || nativeBalance === undefined || requiredEth === null
        ? "loading"
        : nativeBalance.value < requiredEth
          ? "short"
          : "ready";

  const payStepOpen =
    !!request &&
    request.status === "open" &&
    !paymentInProgress &&
    !unverifiedPayment &&
    step !== "approving" &&
    step !== "paying" &&
    step !== "tracking" &&
    step !== "done";

  const canPay = directPay
    ? payStepOpen && directBalance === "ready"
    : robinhoodEth
      ? payStepOpen && ethBalance === "ready" && !quoteError
      : payStepOpen && !!quote?.swapTx && !simulationBlocked && !quoteError;

  return {
    request,
    attempts,
    isConnected,
    originChainId,
    inputToken,
    chainOptions,
    tokenOptions,
    step,
    quoteError,
    quote,
    ethQuote,
    tradeType,
    selectedToken,
    chains,
    directPay,
    directBalance,
    robinhoodEth,
    ethBalance,
    canPay,
    paymentInProgress,
    payerAddress: address,
    statusMsg,
    pendingTx,
    txSuccess,
    txError,
    depositTxnRef,
    onChainChange,
    onTokenChange,
    paymentSent: Boolean(unverifiedPayment),
    refreshQuote,
    executePayment,
    retryVerification,
  };
}
