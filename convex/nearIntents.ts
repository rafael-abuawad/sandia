import { action, internalAction, type ActionCtx } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import {
  ONE_CLICK_URL,
  assertUsableQuote,
  buildQuoteBody,
  destinationHashes,
  findStellarUsdc,
  toPayRoutes,
  type OneClickQuote,
  type OneClickToken,
} from "../lib/near-intents";
import { fetchOperations, fetchTransaction } from "../lib/stellar/horizon";
import { matchRequestPayment, parseUsdcPayments } from "../lib/stellar/payments";
import { isStellarAccount } from "../lib/stellar/strkey";
import {
  depositDeadline,
  isReconciliationStuck,
  nextNearStep,
  settlesAfter,
} from "./lib/settlement";

const FETCH_TIMEOUT_MS = 15_000;

function headers(): HeadersInit {
  const result: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
  };
  const key = process.env.NEAR_INTENTS_API_KEY;
  if (key) result["X-API-Key"] = key;
  return result;
}

async function oneClick<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${ONE_CLICK_URL}${path}`, {
    ...init,
    headers: headers(),
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { message?: string };
    console.error("near_intents_request_failed", { path, status: response.status, body });
    const message = body.message ?? "";
    if (/refundTo/i.test(message))
      throw new Error("Enter a valid refund address for this network.");
    throw new Error("No route is available for this token. Try another one.");
  }
  return (await response.json()) as T;
}

export const listRoutes = action({
  args: {},
  returns: v.array(
    v.object({
      assetId: v.string(),
      symbol: v.string(),
      decimals: v.number(),
      blockchain: v.string(),
      network: v.string(),
    }),
  ),
  handler: async () => toPayRoutes(await oneClick<OneClickToken[]>("/v0/tokens")),
});

export const createDeposit = action({
  args: { publicId: v.string(), originAsset: v.string(), refundTo: v.string() },
  returns: v.id("settlementAttempts"),
  handler: async (ctx, args): Promise<Id<"settlementAttempts">> => {
    const refundTo = args.refundTo.trim();
    if (!refundTo || refundTo.length > 128) {
      throw new Error("Enter a valid refund address for this network.");
    }
    const request = await ctx.runQuery(internal.paymentRequests.getInternalByPublicId, {
      publicId: args.publicId,
    });
    if (!request) throw new Error("Payment request not found");
    if (request.status !== "open" || !isStellarAccount(request.recipientAddress)) {
      throw new Error("Payment request is not payable");
    }
    const prepared = await ctx.runQuery(internal.settlementAttempts.prepareDeposit, {
      publicId: args.publicId,
      originAsset: args.originAsset,
      refundTo,
    });
    if (prepared.existing) return prepared.existing;
    if (!prepared.allowed) {
      throw new Error("This request has too many open deposit addresses. Try again later.");
    }

    const now = Date.now();
    const deadline = depositDeadline(now, request.expiresAt);
    if (deadline === null)
      throw new Error("This request expires too soon for a cross-chain route.");

    const tokens = await oneClick<OneClickToken[]>("/v0/tokens");
    const destination = findStellarUsdc(tokens);
    const route = toPayRoutes(tokens).find((row) => row.assetId === args.originAsset);
    if (!destination || !route) throw new Error("No route is available for this token.");

    const quote = await oneClick<OneClickQuote>("/v0/quote", {
      method: "POST",
      body: JSON.stringify(
        buildQuoteBody({
          originAsset: route.assetId,
          destinationAsset: destination.assetId,
          amountStroops: request.outputAmountBaseUnits,
          recipient: request.recipientAddress,
          refundTo,
          deadline,
        }),
      ),
    });
    assertUsableQuote(quote, request.outputAmountBaseUnits);

    return await ctx.runMutation(internal.settlementAttempts.createDeposit, {
      publicId: args.publicId,
      amountBaseUnits: request.outputAmountBaseUnits,
      originAsset: route.assetId,
      originSymbol: route.symbol,
      originChain: route.network,
      originDecimals: route.decimals,
      depositAddress: quote.quote.depositAddress,
      depositMemo: quote.quote.depositMemo,
      amountIn: quote.quote.amountIn,
      minAmountIn: quote.quote.minAmountIn,
      refundTo,
      deadline,
      timeEstimate: quote.quote.timeEstimate,
      correlationId: quote.correlationId,
      quoteSignature: quote.signature,
    });
  },
});

type SyncRow = {
  attemptId: Id<"settlementAttempts">;
  depositAddress: string;
  depositMemo?: string;
  deadline?: number;
  createdAt: number;
  recipientAddress: string;
  outputAmountBaseUnits: string;
  publicId: string;
};

type OneClickStatus = {
  status: string;
  swapDetails?: { destinationChainTxHashes?: Array<{ hash?: string }> };
};

/**
 * Applies a deposit's 1Click status. `SUCCESS` alone doesn't settle a request: the payment must
 * also be readable on Stellar, paying the recipient at least the requested amount.
 */
async function syncRow(ctx: ActionCtx, row: SyncRow): Promise<void> {
  const params = new URLSearchParams({ depositAddress: row.depositAddress });
  if (row.depositMemo) params.set("depositMemo", row.depositMemo);
  const status = await oneClick<OneClickStatus>(`/v0/status?${params.toString()}`);
  const step = nextNearStep(status.status, row.deadline, Date.now());

  if (step.step === "wait") return;
  if (step.step === "processing") {
    await ctx.runMutation(internal.settlementAttempts.markProcessing, {
      attemptId: row.attemptId,
      reason: step.reason,
    });
    return;
  }
  if (step.step === "terminal") {
    await ctx.runMutation(internal.settlementAttempts.markTerminal, {
      attemptId: row.attemptId,
      status: step.status,
      reason: step.reason,
    });
    return;
  }

  for (const hash of destinationHashes(status)) {
    // Each hash is checked in turn. The route normally delivers through one transaction.
    // react-doctor-disable-next-line react-doctor/async-await-in-loop
    const transaction = await fetchTransaction(hash);
    if (!transaction?.successful) continue;
    if (!settlesAfter(transaction.created_at, row.createdAt)) continue;
    // react-doctor-disable-next-line react-doctor/async-await-in-loop
    const operations = await fetchOperations(transaction.hash);
    const matched = matchRequestPayment(parseUsdcPayments(operations), {
      recipient: row.recipientAddress,
      amount: row.outputAmountBaseUnits,
    });
    if (!matched.ok) continue;
    // react-doctor-disable-next-line react-doctor/async-await-in-loop
    await ctx.runMutation(internal.settlementAttempts.settleDeposit, {
      attemptId: row.attemptId,
      txHash: transaction.hash,
    });
    return;
  }

  // 1Click reported success, yet Stellar shows no matching payment. Keep checking, and alert.
  await ctx.runMutation(internal.settlementAttempts.markProcessing, { attemptId: row.attemptId });
  if (isReconciliationStuck(row.createdAt, Date.now())) {
    console.error("payment_reconciliation_stuck", {
      publicId: row.publicId,
      attemptId: row.attemptId,
      reason: "1Click reported SUCCESS without a matching Stellar payment",
    });
  }
}

export const syncDeposit = action({
  args: { attemptId: v.id("settlementAttempts") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const row = await ctx.runQuery(internal.settlementAttempts.getForSync, {
      attemptId: args.attemptId,
    });
    if (!row) throw new Error("Payment attempt not found");
    if (row.status === "awaiting_deposit" || row.status === "processing") {
      await syncRow(ctx, row);
    }
    return null;
  },
});

export const reconcile = internalAction({
  args: {},
  returns: v.object({ checked: v.number() }),
  handler: async (ctx) => {
    const rows = await ctx.runQuery(internal.settlementAttempts.listForReconciliation, {});
    let checked = 0;
    for (const row of rows) {
      checked += 1;
      try {
        // One at a time, to stay inside 1Click and Horizon rate limits.
        // react-doctor-disable-next-line react-doctor/async-await-in-loop
        await syncRow(ctx, row);
      } catch (error) {
        console.error("near_intents_reconcile_pending", {
          attemptId: row.attemptId,
          message: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }
    return { checked };
  },
});
