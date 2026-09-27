"use node";

import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { createPublicClient, http, isAddress, type Hex } from "viem";
import { ROBINHOOD_USDG } from "../lib/destination";
import { NATIVE_ETH, parseEthSwapQuote, type EthSwapQuote } from "../lib/zerox-quote";
import { matchTransferToPayment, parseTransferLogs } from "./lib/transferLog";

const ZEROX_PRICE = "https://api.0x.org/swap/allowance-holder/price";
const ZEROX_QUOTE = "https://api.0x.org/swap/allowance-holder/quote";
const SLIPPAGE_BPS = "100";

const robinhood = {
  id: 4663,
  name: "Robinhood Chain",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.mainnet.chain.robinhood.com"] } },
} as const;

const ethSwapQuoteValidator = v.object({
  maxSellAmount: v.string(),
  buyAmount: v.string(),
  transaction: v.object({
    to: v.string(),
    data: v.string(),
    value: v.string(),
    gas: v.optional(v.string()),
  }),
});

type ZeroXPriceBody = {
  liquidityAvailable?: boolean;
  buyAmount?: string;
  minBuyAmount?: string;
  name?: string;
  message?: string;
  code?: string;
};

export const probeQuote = action({
  args: {
    sellToken: v.string(),
    buyToken: v.string(),
    sellAmount: v.string(),
    taker: v.string(),
  },
  returns: v.object({
    ok: v.boolean(),
    status: v.number(),
    liquidityAvailable: v.optional(v.boolean()),
    buyAmount: v.optional(v.string()),
    minBuyAmount: v.optional(v.string()),
    reason: v.optional(v.string()),
  }),
  handler: async (_ctx, args) => {
    const key = process.env.ZEROX_API_KEY;
    if (!key) {
      console.error("zerox_quote_unauthorized", { reason: "ZEROX_API_KEY is not configured" });
      return {
        ok: false,
        status: 0,
        reason: "Stock trading is unavailable until a 0x API key is configured",
      };
    }
    const url = new URL(ZEROX_PRICE);
    url.searchParams.set("chainId", "4663");
    url.searchParams.set("sellToken", args.sellToken);
    url.searchParams.set("buyToken", args.buyToken);
    url.searchParams.set("sellAmount", args.sellAmount);
    url.searchParams.set("taker", args.taker);
    const res = await fetch(url, {
      headers: {
        "0x-api-key": key,
        "0x-version": "v2",
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) {
      const errorBody = (await res.json().catch(() => ({}))) as ZeroXPriceBody;
      const reason =
        errorBody.name || errorBody.code || errorBody.message || `0x quote failed (${res.status})`;
      console.error("zerox_quote_unauthorized", { status: res.status, reason });
      return { ok: false, status: res.status, reason };
    }
    const body = (await res.json().catch(() => ({}))) as ZeroXPriceBody;
    if (body.liquidityAvailable !== true) {
      return {
        ok: false,
        status: res.status,
        liquidityAvailable: body.liquidityAvailable,
        reason: "0x has no executable liquidity for this stock token",
      };
    }
    return {
      ok: true,
      status: res.status,
      liquidityAvailable: true,
      buyAmount: body.buyAmount,
      minBuyAmount: body.minBuyAmount,
    };
  },
});

function zeroxHeaders(key: string): HeadersInit {
  return {
    "0x-api-key": key,
    "0x-version": "v2",
    Accept: "application/json",
  };
}

/** Exact-buy ETH → USDG on Robinhood. Recipient and buy amount come from the payment request. */
export const quoteEthToUsdg = action({
  args: {
    publicId: v.string(),
    taker: v.string(),
  },
  returns: ethSwapQuoteValidator,
  handler: async (ctx, args): Promise<EthSwapQuote> => {
    const request = await ctx.runQuery(internal.paymentRequests.getInternalByPublicId, {
      publicId: args.publicId,
    });
    if (!request) throw new Error("Payment request not found");
    if (request.status !== "open" && request.status !== "pending") {
      throw new Error("Payment request is not payable");
    }
    if (
      request.destinationChainId !== ROBINHOOD_USDG.chainId ||
      request.destinationTokenAddress.toLowerCase() !== ROBINHOOD_USDG.address.toLowerCase()
    ) {
      throw new Error("ETH on Robinhood only settles USDG on Robinhood Chain");
    }
    if (!isAddress(args.taker)) throw new Error("Connect a wallet to pay.");

    const key = process.env.ZEROX_API_KEY;
    if (!key) {
      console.error("zerox_quote_unauthorized", {
        reason: "ZEROX_API_KEY is not configured",
        publicId: args.publicId,
      });
      throw new Error("ETH on Robinhood could not be quoted right now.");
    }

    const url = new URL(ZEROX_QUOTE);
    url.searchParams.set("chainId", String(ROBINHOOD_USDG.chainId));
    url.searchParams.set("sellToken", NATIVE_ETH);
    url.searchParams.set("buyToken", request.destinationTokenAddress);
    url.searchParams.set("buyAmount", request.outputAmountBaseUnits);
    url.searchParams.set("taker", args.taker);
    url.searchParams.set("recipient", request.recipientAddress);
    url.searchParams.set("slippageBps", SLIPPAGE_BPS);

    const res = await fetch(url, {
      headers: zeroxHeaders(key),
      signal: AbortSignal.timeout(12_000),
    });
    const body: unknown = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.error("zerox_eth_quote_failed", {
        status: res.status,
        publicId: args.publicId,
        body,
      });
      const record = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
      if (record.liquidityAvailable === false) {
        throw new Error("No route is available for this token. Try another one.");
      }
      throw new Error("ETH on Robinhood could not be quoted right now.");
    }

    const echoed = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
    if (
      typeof echoed.buyToken === "string" &&
      echoed.buyToken.toLowerCase() !== request.destinationTokenAddress.toLowerCase()
    ) {
      throw new Error("The quote did not deliver the requested USDG amount.");
    }
    if (
      typeof echoed.recipient === "string" &&
      echoed.recipient.toLowerCase() !== request.recipientAddress.toLowerCase()
    ) {
      throw new Error("The quote did not pay the request recipient.");
    }

    const quote = parseEthSwapQuote(body, request.outputAmountBaseUnits);
    console.log("zerox_eth_quote", {
      publicId: args.publicId,
      taker: args.taker,
      recipient: request.recipientAddress,
      buyAmount: quote.buyAmount,
      maxSellAmount: quote.maxSellAmount,
    });
    return quote;
  },
});

async function readSwapReceipt(txHash: string) {
  const client = createPublicClient({
    chain: robinhood,
    transport: http(robinhood.rpcUrls.default.http[0]),
  });
  const hash = txHash as Hex;
  const [receipt, tx] = await Promise.all([
    client.getTransactionReceipt({ hash }),
    client.getTransaction({ hash }),
  ]);
  if (receipt.status !== "success") {
    throw new Error("Swap transaction reverted");
  }
  return {
    transfers: parseTransferLogs(receipt.logs),
    value: tx.value,
    from: tx.from,
  };
}

/** Confirms the swap paid the request recipient in USDG, then records a same-chain settlement. */
export const submitEthSwap = action({
  args: {
    publicId: v.string(),
    payerAddress: v.string(),
    depositTxnRef: v.string(),
  },
  returns: v.object({
    attemptId: v.optional(v.string()),
    duplicate: v.boolean(),
  }),
  handler: async (ctx, args): Promise<{ attemptId?: string; duplicate: boolean }> => {
    const request = await ctx.runQuery(internal.paymentRequests.getInternalByPublicId, {
      publicId: args.publicId,
    });
    if (!request) throw new Error("Payment request not found");
    if (request.destinationTokenAddress.toLowerCase() !== ROBINHOOD_USDG.address.toLowerCase()) {
      throw new Error("ETH on Robinhood only settles USDG");
    }
    if (!isAddress(args.payerAddress)) throw new Error("Connect a wallet to pay.");

    const depositTxnRef = args.depositTxnRef.toLowerCase();
    const swap = await readSwapReceipt(depositTxnRef);
    if (swap.from.toLowerCase() !== args.payerAddress.toLowerCase()) {
      console.error("payment_deposit_rejected", {
        publicId: args.publicId,
        depositTxnRef,
        reason: "swap sender does not match payer",
      });
      throw new Error("This transaction was not sent by the connected wallet.");
    }
    if (swap.value <= 0n) {
      throw new Error("Swap did not spend ETH");
    }

    const matched = matchTransferToPayment(swap.transfers, {
      token: request.destinationTokenAddress,
      recipient: request.recipientAddress,
      amount: request.outputAmountBaseUnits,
    });
    if (!matched.ok) {
      console.error("payment_deposit_rejected", {
        publicId: args.publicId,
        depositTxnRef,
        reason: matched.reason,
      });
      throw new Error(matched.reason);
    }

    const saved = await ctx.runMutation(internal.paymentAttempts.acceptVerifiedDeposit, {
      publicId: args.publicId,
      payerAddress: args.payerAddress,
      originChainId: ROBINHOOD_USDG.chainId,
      inputToken: NATIVE_ETH,
      quotedInputAmount: swap.value.toString(),
      expectedOutputAmount: request.outputAmountBaseUnits,
      minOutputAmount: request.outputAmountBaseUnits,
      feesJson: "{}",
      depositTxnRef,
      settlementKind: "direct",
    });
    if (saved.expired) throw new Error("Payment request is expired");

    await ctx.runMutation(internal.paymentAttempts.applyAcrossStatus, {
      depositTxnRef,
      acrossStatus: "filled",
      fillTxnRef: depositTxnRef,
      destinationChainId: ROBINHOOD_USDG.chainId,
      outputToken: request.destinationTokenAddress,
      recipient: request.recipientAddress,
      outputAmount: matched.amount.toString(),
      transportError: false,
    });

    console.log("payment_eth_swap_settled", {
      publicId: args.publicId,
      depositTxnRef,
      ethValue: swap.value.toString(),
      usdgAmount: matched.amount.toString(),
    });

    return { attemptId: saved.attemptId, duplicate: saved.duplicate };
  },
});
