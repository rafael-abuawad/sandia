"use client";

import { useCallback, useEffect, useMemo, useReducer } from "react";
import {
  useAccount,
  useSendTransaction,
  useSwitchChain,
  useWaitForTransactionReceipt,
} from "wagmi";
import { useAction, usePaginatedQuery, useQuery } from "convex/react";
import { type Hex, type Address, createPublicClient, http } from "viem";
import { api } from "@/convex/_generated/api";
import type { ChainOption, TokenOption } from "@/components/token-chain-select";
import {
  fetchAcrossChains,
  fetchAcrossTokens,
  quoteFundingGap,
  type AcrossSwapQuote,
} from "@/lib/across/client";
import { appChains, PAYER_CHAIN_IDS, isPayerTokenAllowed, displayTokenSymbol } from "@/lib/chains";
import { initialPayFlowState, payFlowReducer } from "@/components/pay-flow/state";

const CHAIN_ORDER = [1, 8453, 42161, 10, 137, 56, 43114, 143];
const SYMBOL_ORDER = [
  "USDC",
  "USDT",
  "USDT0",
  "DAI",
  "CRVUSD",
  "WETH",
  "ETH",
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

function acrossStatusCopy(status: string): string {
  switch (status) {
    case "submitted":
      return "Submitted — waiting for the bridge.";
    case "pending":
      return "Bridging to Robinhood Chain…";
    case "filled":
      return "Payment settled on Robinhood Chain.";
    default:
      return `Bridge status: ${status}`;
  }
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
  const submitDeposit = useAction(api.across.submitDeposit);
  const syncStatus = useAction(api.across.syncDepositStatus);

  const { address, chainId, isConnected } = useAccount();
  const { switchChainAsync } = useSwitchChain();
  const { sendTransactionAsync } = useSendTransaction();

  const [state, dispatch] = useReducer(payFlowReducer, initialPayFlowState);
  const {
    chains,
    tokens,
    originChainId,
    inputToken,
    quote,
    tradeType,
    quoteError,
    step,
    statusMsg,
    depositTxnRef,
    pendingTx,
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
      if (t.chainId !== originChainId || !isPayerTokenAllowed(t.symbol, t.address)) {
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
    dispatch({
      type: "inputTokenChanged",
      token: value,
      nextStep: isConnected && address ? "quoting" : "idle",
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
              isPayerTokenAllowed(token.symbol, token.address),
          ),
        });
      } catch (e) {
        if (!cancelled) {
          dispatch({
            type: "routesFailed",
            error: e instanceof Error ? e.message : "Failed to load routes",
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
        isPayerTokenAllowed(t.symbol, t.address),
    );
    if (!stillValid) dispatch({ type: "clearInvalidToken" });
  }, [originChainId, tokens, inputToken]);

  const refreshQuote = useCallback(async () => {
    if (!request || !address || !originChainId || !inputToken) return;
    if (request.status !== "open" && request.status !== "pending") return;

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
      const q = raw as AcrossSwapQuote;
      if (q.quoteExpiryTimestamp && q.quoteExpiryTimestamp * 1000 < Date.now()) {
        throw new Error("Quote expired before display — try again");
      }
      dispatch({ type: "quoteSucceeded", quote: q, tradeType: tt });
    } catch (e) {
      dispatch({
        type: "quoteFailed",
        error: e instanceof Error ? e.message : "No valid route",
      });
    }
  }, [request, address, originChainId, inputToken, publicId, quoteSwap]);

  useEffect(() => {
    if (!isConnected || !address || !request) return;
    if (request.status !== "open" && request.status !== "pending") return;
    if (!originChainId || !inputToken) return;
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
            message: `Transfer ${result.acrossStatus}. Funds will be refunded. You can try again.`,
          });
          return;
        }
        dispatch({
          type: "statusChanged",
          message: acrossStatusCopy(result.acrossStatus),
        });
      } catch (e) {
        if (!cancelled) {
          dispatch({
            type: "statusChanged",
            message: e instanceof Error ? e.message : "Status sync failed",
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
  }, [depositTxnRef, request, syncStatus]);

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

  async function executePayment() {
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
      const hash = await sendTransactionAsync({
        to: swap.to as Address,
        data: swap.data as Hex,
        value: swap.value ? BigInt(swap.value) : undefined,
        gas: swap.gas ? BigInt(swap.gas) : undefined,
        chainId: swap.chainId,
      });
      dispatch({ type: "pendingTxSet", hash });
      await waitForHash(hash, swap.chainId);

      const tracked = hash.toLowerCase();
      await submitDeposit({
        publicId,
        payerAddress: address,
        originChainId,
        inputToken,
        quotedInputAmount: quote.inputAmount ?? quote.maxInputAmount ?? "0",
        expectedOutputAmount: quote.expectedOutputAmount ?? request.outputAmountBaseUnits,
        minOutputAmount: quote.minOutputAmount ?? request.outputAmountBaseUnits,
        feesJson: JSON.stringify(quote.fees ?? {}),
        quoteId: quote.id,
        depositTxnRef: tracked,
      });
      window.sessionStorage.setItem(`sandia-deposit:${publicId}`, tracked);

      dispatch({
        type: "depositTracked",
        depositTxnRef: tracked,
        message: "Deposit submitted. Waiting for Across fill…",
      });
    } catch (e) {
      dispatch({
        type: "paymentFailed",
        message: e instanceof Error ? e.message : "Payment failed",
      });
    }
  }

  const paymentInProgress = request?.status === "pending" && !depositTxnRef;
  const fundingGap = quote ? quoteFundingGap(quote) : null;
  const simulationBlocked =
    quote?.swapTx?.simulationSuccess === false && fundingGap !== "allowance";

  const canPay =
    !!request &&
    request.status === "open" &&
    !paymentInProgress &&
    !!quote?.swapTx &&
    !simulationBlocked &&
    !quoteError &&
    step !== "approving" &&
    step !== "paying" &&
    step !== "tracking" &&
    step !== "done";

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
    tradeType,
    selectedToken,
    chains,
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
    refreshQuote,
    executePayment,
  };
}
