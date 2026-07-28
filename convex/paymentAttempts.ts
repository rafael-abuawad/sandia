import { mutation, query, internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { acrossAttemptStatus } from "./schema";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";

const ROBINHOOD_CHAIN_ID = 4663;

async function reopenIfNeeded(ctx: MutationCtx, requestId: Id<"paymentRequests">) {
  const request = await ctx.db.get(requestId);
  if (!request || request.status !== "pending") return;
  const now = Date.now();
  if (request.expiresAt !== undefined && request.expiresAt <= now) {
    await ctx.db.patch(requestId, { status: "expired", updatedAt: now });
    return;
  }
  await ctx.db.patch(requestId, { status: "open", updatedAt: now });
}

function normalizeAddress(address: string): string {
  const lower = address.toLowerCase();
  if (!/^0x[a-f0-9]{40}$/.test(lower)) {
    throw new Error("Invalid Ethereum address");
  }
  return lower;
}

export const listByRequest = query({
  args: { publicId: v.string() },
  handler: async (ctx, args) => {
    const request = await ctx.db
      .query("paymentRequests")
      .withIndex("by_publicId", (q) => q.eq("publicId", args.publicId))
      .unique();
    if (!request) return [];
    return await ctx.db
      .query("paymentAttempts")
      .withIndex("by_request", (q) => q.eq("requestId", request._id))
      .order("desc")
      .collect();
  },
});

export const getByDepositTxnRef = internalQuery({
  args: { depositTxnRef: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("paymentAttempts")
      .withIndex("by_depositTxnRef", (q) => q.eq("depositTxnRef", args.depositTxnRef.toLowerCase()))
      .unique();
  },
});

export const createAttempt = mutation({
  args: {
    publicId: v.string(),
    payerAddress: v.string(),
    originChainId: v.number(),
    inputToken: v.string(),
    quotedInputAmount: v.string(),
    expectedOutputAmount: v.string(),
    minOutputAmount: v.string(),
    feesJson: v.string(),
    quoteId: v.optional(v.string()),
    depositTxnRef: v.string(),
  },
  handler: async (ctx, args) => {
    const request = await ctx.db
      .query("paymentRequests")
      .withIndex("by_publicId", (q) => q.eq("publicId", args.publicId))
      .unique();
    if (!request) throw new Error("Payment request not found");

    if (request.status === "completed") {
      throw new Error("Payment request already completed");
    }
    if (request.status === "cancelled") {
      throw new Error("Payment request is cancelled");
    }
    if (request.status === "expired") {
      throw new Error("Payment request is expired");
    }
    if (request.expiresAt !== undefined && request.expiresAt <= Date.now()) {
      await ctx.db.patch(request._id, {
        status: "expired",
        updatedAt: Date.now(),
      });
      throw new Error("Payment request is expired");
    }

    const depositTxnRef = args.depositTxnRef.toLowerCase();
    if (!/^0x[a-f0-9]{64}$/.test(depositTxnRef)) {
      throw new Error("Invalid deposit transaction hash");
    }

    const existing = await ctx.db
      .query("paymentAttempts")
      .withIndex("by_depositTxnRef", (q) => q.eq("depositTxnRef", depositTxnRef))
      .unique();
    if (existing) {
      return { attemptId: existing._id, duplicate: true as const };
    }

    const now = Date.now();
    const attemptId = await ctx.db.insert("paymentAttempts", {
      requestId: request._id,
      payerAddress: normalizeAddress(args.payerAddress),
      originChainId: args.originChainId,
      inputToken: normalizeAddress(args.inputToken),
      quotedInputAmount: args.quotedInputAmount,
      expectedOutputAmount: args.expectedOutputAmount,
      minOutputAmount: args.minOutputAmount,
      feesJson: args.feesJson,
      quoteId: args.quoteId,
      depositTxnRef,
      acrossStatus: "submitted",
      createdAt: now,
      updatedAt: now,
    });

    await ctx.db.patch(request._id, {
      status: "pending",
      updatedAt: now,
    });

    return { attemptId, duplicate: false as const };
  },
});

export const applyAcrossStatus = internalMutation({
  args: {
    depositTxnRef: v.string(),
    acrossStatus: acrossAttemptStatus,
    fillTxnRef: v.optional(v.string()),
    destinationChainId: v.optional(v.number()),
    outputToken: v.optional(v.string()),
    recipient: v.optional(v.string()),
    outputAmount: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const depositTxnRef = args.depositTxnRef.toLowerCase();
    const attempt = await ctx.db
      .query("paymentAttempts")
      .withIndex("by_depositTxnRef", (q) => q.eq("depositTxnRef", depositTxnRef))
      .unique();

    if (!attempt) {
      throw new Error("Payment attempt not found");
    }

    // Idempotent: already filled
    if (attempt.acrossStatus === "filled") {
      return { requestStatus: "completed" as const, attemptStatus: "filled" as const };
    }

    const request = await ctx.db.get(attempt.requestId);
    if (!request) throw new Error("Payment request not found");

    const now = Date.now();

    if (args.acrossStatus === "filled") {
      // Destination chain is required from Across indexer when marking paid.
      if (args.destinationChainId === undefined) {
        throw new Error("Across fill missing destinationChainId — retry shortly");
      }
      if (args.destinationChainId !== ROBINHOOD_CHAIN_ID) {
        await ctx.db.patch(attempt._id, {
          acrossStatus: "failed",
          updatedAt: now,
        });
        await reopenIfNeeded(ctx, request._id);
        throw new Error("Fill destination chain mismatch");
      }

      // Validate optional settlement fields when the indexer provides them.
      if (args.outputToken && args.outputToken.toLowerCase() !== request.destinationTokenAddress) {
        await ctx.db.patch(attempt._id, {
          acrossStatus: "failed",
          updatedAt: now,
        });
        await reopenIfNeeded(ctx, request._id);
        throw new Error("Fill output token mismatch");
      }

      if (args.recipient && args.recipient.toLowerCase() !== request.recipientAddress) {
        await ctx.db.patch(attempt._id, {
          acrossStatus: "failed",
          updatedAt: now,
        });
        await reopenIfNeeded(ctx, request._id);
        throw new Error("Fill recipient mismatch");
      }

      if (args.outputAmount !== undefined) {
        const filled = BigInt(args.outputAmount);
        const required = BigInt(request.outputAmountBaseUnits);
        if (filled < required) {
          await ctx.db.patch(attempt._id, {
            acrossStatus: "failed",
            updatedAt: now,
          });
          await reopenIfNeeded(ctx, request._id);
          throw new Error("Filled amount below requested amount");
        }
      }

      await ctx.db.patch(attempt._id, {
        acrossStatus: "filled",
        fillTxnRef: args.fillTxnRef?.toLowerCase(),
        updatedAt: now,
      });
      await ctx.db.patch(request._id, {
        status: "completed",
        updatedAt: now,
      });
      return { requestStatus: "completed" as const, attemptStatus: "filled" as const };
    }

    if (args.acrossStatus === "expired" || args.acrossStatus === "refunded") {
      await ctx.db.patch(attempt._id, {
        acrossStatus: args.acrossStatus,
        fillTxnRef: args.fillTxnRef?.toLowerCase(),
        updatedAt: now,
      });
      if (request.status === "pending") {
        if (request.expiresAt !== undefined && request.expiresAt <= now) {
          await ctx.db.patch(request._id, { status: "expired", updatedAt: now });
        } else {
          await ctx.db.patch(request._id, { status: "open", updatedAt: now });
        }
      }
      return {
        requestStatus: request.status === "pending" ? ("open" as const) : request.status,
        attemptStatus: args.acrossStatus,
      };
    }

    await ctx.db.patch(attempt._id, {
      acrossStatus: args.acrossStatus,
      fillTxnRef: args.fillTxnRef?.toLowerCase(),
      updatedAt: now,
    });

    return { requestStatus: request.status, attemptStatus: args.acrossStatus };
  },
});
