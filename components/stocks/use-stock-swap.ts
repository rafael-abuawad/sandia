"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSendTransaction } from "@privy-io/react-auth";
import { erc20Abi, getAddress, type Address, type Hex } from "viem";
import { usePublicClient, useReadContract } from "wagmi";
import { ROBINHOOD_USDG } from "@/lib/destination";
import { sponsoredSendRequest } from "@/lib/send/sponsored";
import { formatTokenAmountGrouped } from "@/lib/money";
import {
  SWAP_ROUTER_02,
  buildStockApprove,
  buildStockSwap,
  parseTradeAmount,
  planStockOrder,
  protectedQuoteWorsened,
  quoteLegs,
  quoteStockOrder,
  requireSwapRouterCall,
  type ProtectedStockQuote,
  type TradeSide,
  type TradeUnit,
} from "@/lib/stocks/uniswap";
import { useSignedInWallet } from "@/lib/use-signed-in-wallet";
import { userFacingError } from "@/lib/user-facing-error";

const USDG = getAddress(ROBINHOOD_USDG.address);
const NO_LIQUIDITY = "There is no Uniswap liquidity.";

type SwapAsset = {
  symbol: string;
  contractAddress: string;
  tokenDecimals: number;
};

type QuoteState =
  | { status: "idle" }
  | { status: "quoting" }
  | { status: "none" }
  | { status: "ready"; quote: ProtectedStockQuote }
  | { status: "error"; message: string };

function unreachable(error: unknown): boolean {
  const message = error instanceof Error ? error.message : "";
  return /failed to fetch|network|timed out|http request/i.test(message);
}

function buttonLabel(
  side: TradeSide,
  symbol: string,
  tokenDecimals: number,
  state: QuoteState,
  pending: boolean,
): string {
  if (pending) return side === "buy" ? "Buying…" : "Selling…";
  if (state.status === "quoting") return "Quoting…";
  if (state.status !== "ready") return `${side === "buy" ? "Buy" : "Sell"} ${symbol}`;
  const legs = quoteLegs(state.quote);
  const tokenText = formatTokenAmountGrouped(legs.tokenAmount.toString(), tokenDecimals, 6);
  const usdText = formatTokenAmountGrouped(legs.usdgAmount.toString(), ROBINHOOD_USDG.decimals, 6);
  return `${side === "buy" ? "Buy" : "Sell"} ${tokenText} ${symbol} for ${usdText} USDG`;
}

export type StockQuoteAmounts = {
  usdg: string;
  quantity: string;
};

function quoteAmounts(
  tokenDecimals: number,
  quote: ProtectedStockQuote | null,
): StockQuoteAmounts | null {
  if (!quote) return null;
  const legs = quoteLegs(quote);
  return {
    usdg: formatTokenAmountGrouped(legs.usdgAmount.toString(), ROBINHOOD_USDG.decimals, 6),
    quantity: formatTokenAmountGrouped(legs.tokenAmount.toString(), tokenDecimals, 6),
  };
}

export function useStockSwap(input: {
  asset: SwapAsset;
  side: TradeSide;
  unit: TradeUnit;
  amount: string;
  halted: boolean;
  onPendingChange?: (pending: boolean) => void;
}) {
  const { ready, address, isSignedIn } = useSignedInWallet();
  const { sendTransaction } = useSendTransaction();
  const publicClient = usePublicClient({ chainId: ROBINHOOD_USDG.chainId });
  const [quoteState, setQuoteState] = useState<QuoteState>({ status: "idle" });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmedHash, setConfirmedHash] = useState<Hex | null>(null);
  const quoteRef = useRef<ProtectedStockQuote | null>(null);
  const pendingRef = useRef(false);
  const mounted = useRef(true);
  const inputRef = useRef(input);
  const onPendingChangeRef = useRef(input.onPendingChange);
  inputRef.current = input;
  onPendingChangeRef.current = input.onPendingChange;
  quoteRef.current = quoteState.status === "ready" ? quoteState.quote : null;

  const account = address ? getAddress(address) : undefined;
  const token = validToken(input.asset);
  const sellToken = input.side === "buy" ? USDG : token;
  const parsed = token
    ? parseTradeAmount(
        input.amount,
        input.unit === "usd" ? ROBINHOOD_USDG.decimals : input.asset.tokenDecimals,
      )
    : { error: "This token can't be traded." };

  const { symbol, contractAddress, tokenDecimals } = input.asset;
  const { halted, side, unit, amount } = input;

  const balanceRead = useReadContract({
    address: sellToken ?? undefined,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: account ? [account] : undefined,
    chainId: ROBINHOOD_USDG.chainId,
    query: { enabled: Boolean(account && sellToken && isSignedIn) },
  });

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    onPendingChangeRef.current?.(pending);
  }, [pending]);

  useEffect(() => {
    return () => onPendingChangeRef.current?.(false);
  }, []);

  const refetchBalanceRef = useRef(balanceRead.refetch);
  refetchBalanceRef.current = balanceRead.refetch;

  useEffect(() => {
    setError(null);
    setNotice(null);
    setConfirmedHash(null);
  }, [amount, side, unit, contractAddress]);

  useEffect(() => {
    const assetToken = validToken({ symbol, contractAddress, tokenDecimals });
    const amountParsed = assetToken
      ? parseTradeAmount(amount, unit === "usd" ? ROBINHOOD_USDG.decimals : tokenDecimals)
      : null;
    if (halted || !publicClient || !assetToken || !amountParsed || "error" in amountParsed) {
      setQuoteState({ status: "idle" });
      return;
    }
    let cancelled = false;
    setQuoteState({ status: "quoting" });
    const plan = planStockOrder({
      side,
      unit,
      token: assetToken,
      amount: amountParsed.amount,
    });
    const timer = window.setTimeout(() => {
      void quoteStockOrder(publicClient, plan)
        .then((quote) => {
          if (cancelled) return;
          if (!quote) {
            console.info("[stocks] no Uniswap liquidity", {
              symbol,
              direction: plan.direction,
              amount: plan.amount.toString(),
            });
          }
          setQuoteState(quote ? { status: "ready", quote } : { status: "none" });
        })
        .catch((quoteError: unknown) => {
          console.error("[stocks] uniswap quote failed", quoteError);
          if (cancelled) return;
          setQuoteState({
            status: "error",
            message: userFacingError(quoteError, "The Uniswap quote could not be loaded."),
          });
        });
    }, 400);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [halted, side, unit, amount, symbol, contractAddress, tokenDecimals, publicClient]);

  const quote = quoteState.status === "ready" ? quoteState.quote : null;
  const balanceShort = Boolean(
    isSignedIn && quote && balanceRead.data !== undefined && balanceRead.data < quote.sellAmount,
  );
  const balanceUnknown = Boolean(
    isSignedIn && quote && (balanceRead.isLoading || balanceRead.isError),
  );
  const sellSymbol = input.side === "buy" ? "USDG" : input.asset.symbol;

  const notes: string[] = [];
  if (!input.halted && ready && !isSignedIn) notes.push("Sign in to buy or sell.");
  if (!input.halted && parsed && "error" in parsed) notes.push(parsed.error);
  if (!input.halted && quoteState.status === "none") notes.push(NO_LIQUIDITY);
  if (!input.halted && quoteState.status === "error") notes.push(quoteState.message);
  if (!input.halted && isSignedIn && balanceRead.isError)
    notes.push("Could not read your balance.");
  if (!input.halted && isSignedIn && quote && balanceRead.isLoading && !balanceRead.isError) {
    notes.push("Checking your balance…");
  }
  if (!input.halted && balanceShort) {
    notes.push(`This wallet doesn't have enough ${sellSymbol} on Robinhood Chain.`);
  }

  const canSubmit = Boolean(
    !input.halted &&
    ready &&
    isSignedIn &&
    account &&
    publicClient &&
    token &&
    quote &&
    !pending &&
    !balanceShort &&
    !balanceUnknown,
  );

  const submit = useCallback(async () => {
    const current = inputRef.current;
    const shown = quoteRef.current;
    const currentToken = validToken(current.asset);
    const currentAccount = address ? getAddress(address) : undefined;
    if (
      pendingRef.current ||
      !shown ||
      !currentToken ||
      !currentAccount ||
      !publicClient ||
      current.halted
    ) {
      return;
    }
    const client = publicClient;
    const currentParsed = parseTradeAmount(
      current.amount,
      current.unit === "usd" ? ROBINHOOD_USDG.decimals : current.asset.tokenDecimals,
    );
    if (!currentParsed || "error" in currentParsed) return;
    const plan = planStockOrder({
      side: current.side,
      unit: current.unit,
      token: currentToken,
      amount: currentParsed.amount,
    });
    if (
      shown.direction !== plan.direction ||
      shown.amount !== plan.amount ||
      shown.tokenIn !== plan.tokenIn ||
      shown.tokenOut !== plan.tokenOut
    ) {
      return;
    }

    pendingRef.current = true;
    setPending(true);
    setError(null);
    setNotice(null);
    setConfirmedHash(null);
    const symbol = current.asset.symbol;
    const side = current.side;
    try {
      const first = adoptQuote(shown, await quoteStockOrder(client, plan), symbol);
      if (!first || !mounted.current) return;
      const balance = await client.readContract({
        address: first.sellToken,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [currentAccount],
      });
      const freshSymbol = first.sellToken === USDG ? "USDG" : symbol;
      if (balance < first.sellAmount) {
        throw new Error(`This wallet doesn't have enough ${freshSymbol} on Robinhood Chain.`);
      }
      const allowance = await client.readContract({
        address: first.sellToken,
        abi: erc20Abi,
        functionName: "allowance",
        args: [currentAccount, SWAP_ROUTER_02],
      });
      let covered = allowance;
      if (allowance < first.sellAmount) {
        const approval = buildStockApprove(first.sellToken, first.sellAmount);
        console.info("[stocks] approving sell token", {
          symbol,
          token: approval.to,
          spender: SWAP_ROUTER_02,
          amount: first.sellAmount.toString(),
        });
        const approvalHash = await sendSponsored(approval, currentAccount);
        await waitForSuccess(approvalHash, "Token approval did not confirm. Try again.");
        covered = first.sellAmount;
      }
      const finalQuote = adoptQuote(shown, await quoteStockOrder(client, plan), symbol);
      if (!finalQuote || !mounted.current) return;
      if (finalQuote.sellAmount > covered) {
        setQuoteState({ status: "ready", quote: finalQuote });
        setError("The Uniswap price moved. Review the new amount and try again.");
        console.info("[stocks] swap stopped", { symbol, reason: "allowance short after re-quote" });
        return;
      }
      const swap = requireSwapRouterCall(
        buildStockSwap({
          direction: finalQuote.direction,
          venue: finalQuote.venue,
          tokenIn: finalQuote.tokenIn,
          tokenOut: finalQuote.tokenOut,
          amount: finalQuote.amount,
          quoted: finalQuote.quoted,
          recipient: currentAccount,
          nowSeconds: BigInt(Math.floor(Date.now() / 1000)),
        }),
      );
      try {
        await client.call({
          account: currentAccount,
          to: swap.to,
          data: swap.data,
          value: 0n,
        });
      } catch (simulationError) {
        if (unreachable(simulationError)) {
          throw new Error("Robinhood Chain is not reachable. Refresh and try again.");
        }
        console.error("[stocks] swap simulation failed", simulationError);
        throw new Error("This swap would fail. Try a smaller amount.");
      }
      console.info("[stocks] submitting swap", {
        symbol,
        to: swap.to,
        direction: finalQuote.direction,
        venue: finalQuote.venue.kind,
        fee: finalQuote.venue.kind === "v3" ? finalQuote.venue.fee : null,
        quoted: finalQuote.quoted.toString(),
        protected: finalQuote.protected.toString(),
      });
      const hash = await sendSponsored(swap, currentAccount);
      await waitForSuccess(hash, "The swap did not confirm. Try again.");
      if (!mounted.current) return;
      setQuoteState({ status: "ready", quote: finalQuote });
      setConfirmedHash(hash);
      setNotice(side === "buy" ? "Buy confirmed." : "Sell confirmed.");
      await refetchBalanceRef.current();
    } catch (submitError) {
      console.error("[stocks] swap failed", submitError);
      if (!mounted.current) return;
      setError(userFacingError(submitError, "The swap could not be submitted. Try again."));
    } finally {
      pendingRef.current = false;
      if (mounted.current) setPending(false);
    }

    function adoptQuote(
      shownQuote: ProtectedStockQuote,
      next: ProtectedStockQuote | null,
      stockSymbol: string,
    ): ProtectedStockQuote | null {
      if (!next) {
        setQuoteState({ status: "none" });
        console.info("[stocks] swap stopped", { symbol: stockSymbol, reason: "no liquidity" });
        return null;
      }
      if (protectedQuoteWorsened(shownQuote.direction, shownQuote.protected, next.protected)) {
        setQuoteState({ status: "ready", quote: next });
        setError("The Uniswap price moved. Review the new amount and try again.");
        console.info("[stocks] swap stopped", { symbol: stockSymbol, reason: "price moved" });
        return null;
      }
      return next;
    }

    async function sendSponsored(call: { to: Address; data: Hex; value: bigint }, wallet: Address) {
      const request = sponsoredSendRequest(call, wallet);
      const { hash } = await sendTransaction(request.transaction, request.options);
      if (!hash?.startsWith("0x") || hash.length !== 66) {
        throw new Error("The wallet did not return a transaction. Try again.");
      }
      return hash as Hex;
    }

    async function waitForSuccess(hash: Hex, failure: string) {
      const receipt = await client.waitForTransactionReceipt({ hash });
      console.info("[stocks] receipt", { hash, status: receipt.status });
      if (receipt.status !== "success") throw new Error(failure);
    }
  }, [address, publicClient, sendTransaction]);

  return {
    notes: input.halted ? [] : notes,
    buttonLabel: input.halted
      ? "Trading paused"
      : buttonLabel(input.side, input.asset.symbol, input.asset.tokenDecimals, quoteState, pending),
    quoteAmounts: quoteAmounts(input.asset.tokenDecimals, quote),
    quoting: quoteState.status === "quoting",
    disabled: !canSubmit,
    pending,
    error,
    notice,
    confirmedHash,
    submit,
  };
}

function validToken(asset: SwapAsset): Address | null {
  if (
    !Number.isInteger(asset.tokenDecimals) ||
    asset.tokenDecimals < 0 ||
    asset.tokenDecimals > 18
  ) {
    return null;
  }
  try {
    return getAddress(asset.contractAddress);
  } catch {
    return null;
  }
}
