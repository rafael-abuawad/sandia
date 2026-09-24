import { query, internalMutation, internalQuery } from "./_generated/server";
import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { acrossAttemptStatus } from "./schema";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import {
  decideAttemptAcceptance,
  evaluateFill,
  isReconciliationStuck,
  type FillEvidence,
} from "./lib/fillProof";

async function reopenAfterTerminalAttempt(ctx: MutationCtx, requestId: Id<"paymentRequests">) {
  const request = await ctx.db.get(requestId);
  if (!request || request.status !== "pending") return request?.status;
  const now = Date.now();
  if (request.expiresAt !== undefined && request.expiresAt <= now) {
    await ctx.db.patch(requestId, { status: "expired", updatedAt: now });
    return "expired" as const;
  }
  await ctx.db.patch(requestId, { status: "open", updatedAt: now });
  return "open" as const;
}

function normalizeAddress(address: string): string {
  const lower = address.toLowerCase();
  if (!/^0x[a-f0-9]{40}$/.test(lower)) {
    throw new Error("Invalid Ethereum address");
  }
  return lower;
}

const attemptValidator = v.object({
  _id: v.id("paymentAttempts"),
  _creationTime: v.number(),
  requestId: v.id("paymentRequests"),
  payerAddress: v.string(),
  originChainId: v.number(),
  inputToken: v.string(),
  quotedInputAmount: v.string(),
  expectedOutputAmount: v.string(),
  minOutputAmount: v.string(),
  feesJson: v.string(),
  quoteId: v.optional(v.string()),
  depositTxnRef: v.optional(v.string()),
  fillTxnRef: v.optional(v.string()),
  acrossStatus: acrossAttemptStatus,
  settlementKind: v.optional(v.union(v.literal("across"), v.literal("direct"))),
  failureReason: v.optional(v.string()),
  createdAt: v.number(),
  updatedAt: v.number(),
});

export const listByRequest = query({
  args: {
    publicId: v.string(),
    paginationOpts: paginationOptsValidator,
  },
  returns: v.object({
    page: v.array(attemptValidator),
    isDone: v.boolean(),
    continueCursor: v.string(),
    splitCursor: v.optional(v.union(v.string(), v.null())),
    pageStatus: v.optional(v.union(v.string(), v.null())),
  }),
  handler: async (ctx, args) => {
    const request = await ctx.db
      .query("paymentRequests")
      .withIndex("by_publicId", (q) => q.eq("publicId", args.publicId))
      .unique();
    if (!request) {
      return {
        page: [],
        isDone: true,
        continueCursor: "",
        splitCursor: null,
        pageStatus: null,
      };
    }
    return await ctx.db
      .query("paymentAttempts")
      .withIndex("by_request", (q) => q.eq("requestId", request._id))
      .order("desc")
      .paginate(args.paginationOpts);
  },
});

export const getByDepositTxnRef = internalQuery({
  args: { depositTxnRef: v.string() },
  returns: v.union(attemptValidator, v.null()),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("paymentAttempts")
      .withIndex("by_depositTxnRef", (q) => q.eq("depositTxnRef", args.depositTxnRef.toLowerCase()))
      .unique();
  },
});

export const listForReconciliation = internalQuery({
  args: { limit: v.number() },
  returns: v.array(
    v.object({
      attemptId: v.id("paymentAttempts"),
      requestId: v.id("paymentRequests"),
      publicId: v.string(),
      depositTxnRef: v.string(),
      acrossStatus: acrossAttemptStatus,
      settlementKind: v.union(v.literal("across"), v.literal("direct")),
      createdAt: v.number(),
      destinationChainId: v.number(),
      destinationTokenAddress: v.string(),
      recipientAddress: v.string(),
      outputAmountBaseUnits: v.string(),
      requestStatus: v.string(),
    }),
  ),
  handler: async (ctx, args) => {
    const limit = Math.min(Math.max(args.limit, 1), 25);
    const [submitted, pending] = await Promise.all([
      ctx.db
        .query("paymentAttempts")
        .withIndex("by_acrossStatus", (q) => q.eq("acrossStatus", "submitted"))
        .take(limit),
      ctx.db
        .query("paymentAttempts")
        .withIndex("by_acrossStatus", (q) => q.eq("acrossStatus", "pending"))
        .take(limit),
    ]);

    const candidates = [...submitted, ...pending]
      .slice(0, limit)
      .filter((attempt): attempt is typeof attempt & { depositTxnRef: string } =>
        Boolean(attempt.depositTxnRef),
      );
    const requests = await Promise.all(candidates.map((attempt) => ctx.db.get(attempt.requestId)));

    const rows = [];
    for (let i = 0; i < candidates.length; i++) {
      const attempt = candidates[i];
      const request = requests[i];
      if (!request) continue;
      const kind = attempt.settlementKind ?? "across";
      rows.push({
        attemptId: attempt._id,
        requestId: attempt.requestId,
        publicId: request.publicId,
        depositTxnRef: attempt.depositTxnRef,
        acrossStatus: attempt.acrossStatus,
        settlementKind: kind,
        createdAt: attempt.createdAt,
        destinationChainId: request.destinationChainId,
        destinationTokenAddress: request.destinationTokenAddress,
        recipientAddress: request.recipientAddress,
        outputAmountBaseUnits: request.outputAmountBaseUnits,
        requestStatus: request.status,
      });
    }
    return rows;
  },
});

export const acceptVerifiedDeposit = internalMutation({
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
    settlementKind: v.union(v.literal("across"), v.literal("direct")),
  },
  returns: v.object({
    attemptId: v.optional(v.id("paymentAttempts")),
    duplicate: v.boolean(),
    expired: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const request = await ctx.db
      .query("paymentRequests")
      .withIndex("by_publicId", (q) => q.eq("publicId", args.publicId))
      .unique();
    if (!request) throw new Error("Payment request not found");

    const now = Date.now();
    if (request.status === "open" && request.expiresAt !== undefined && request.expiresAt <= now) {
      await ctx.db.patch(request._id, { status: "expired", updatedAt: now });
      console.log("payment_request_expired", { publicId: request.publicId });
      return { expired: true, duplicate: false };
    }

    const depositTxnRef = args.depositTxnRef.toLowerCase();
    if (!/^0x[a-f0-9]{64}$/.test(depositTxnRef)) {
      throw new Error("Invalid deposit transaction hash");
    }

    const [existing, prior] = await Promise.all([
      ctx.db
        .query("paymentAttempts")
        .withIndex("by_depositTxnRef", (q) => q.eq("depositTxnRef", depositTxnRef))
        .unique(),
      ctx.db
        .query("paymentAttempts")
        .withIndex("by_request", (q) => q.eq("requestId", request._id))
        .take(9),
    ]);

    const decision = decideAttemptAcceptance({
      requestStatus: request.status,
      existingDepositTxnRef: existing?.depositTxnRef,
      incomingDepositTxnRef: depositTxnRef,
      attemptCount: prior.length,
    });
    if (!decision.ok) {
      console.log("payment_attempt_rejected", {
        publicId: request.publicId,
        depositTxnRef,
        reason: decision.reason,
      });
      throw new Error(decision.reason);
    }
    if (decision.duplicate && existing) {
      return { attemptId: existing._id, duplicate: true, expired: false };
    }

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
      settlementKind: args.settlementKind,
      createdAt: now,
      updatedAt: now,
    });

    await ctx.db.patch(request._id, { status: "pending", updatedAt: now });
    console.log("payment_attempt_accepted", {
      publicId: request.publicId,
      depositTxnRef,
      settlementKind: args.settlementKind,
    });
    return { attemptId, duplicate: false, expired: false };
  },
});

export const applyAcrossStatus = internalMutation({
  args: {
    depositTxnRef: v.string(),
    acrossStatus: v.string(),
    fillTxnRef: v.optional(v.string()),
    destinationChainId: v.optional(v.number()),
    outputToken: v.optional(v.string()),
    recipient: v.optional(v.string()),
    outputAmount: v.optional(v.string()),
    transportError: v.optional(v.boolean()),
  },
  returns: v.object({
    requestStatus: v.string(),
    attemptStatus: v.string(),
    reason: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const depositTxnRef = args.depositTxnRef.toLowerCase();
    const attempt = await ctx.db
      .query("paymentAttempts")
      .withIndex("by_depositTxnRef", (q) => q.eq("depositTxnRef", depositTxnRef))
      .unique();

    if (!attempt) {
      throw new Error("Payment attempt not found");
    }

    const request = await ctx.db.get(attempt.requestId);
    if (!request) throw new Error("Payment request not found");
    const now = Date.now();

    if (args.transportError) {
      if (isReconciliationStuck(attempt.createdAt, now)) {
        console.error("payment_reconciliation_stuck", {
          publicId: request.publicId,
          depositTxnRef,
          acrossStatus: attempt.acrossStatus,
          ageMs: now - attempt.createdAt,
        });
      }
      return {
        requestStatus: request.status,
        attemptStatus: attempt.acrossStatus,
        reason: "Across status is temporarily unavailable",
      };
    }

    if (attempt.acrossStatus === "filled") {
      return { requestStatus: request.status, attemptStatus: "filled" };
    }

    const evidence: FillEvidence = {
      status: args.acrossStatus,
      destinationChainId: args.destinationChainId,
      outputToken: args.outputToken,
      recipient: args.recipient,
      outputAmount: args.outputAmount,
      fillTxnRef: args.fillTxnRef,
    };
    const decision = evaluateFill(evidence, {
      destinationChainId: request.destinationChainId,
      destinationTokenAddress: request.destinationTokenAddress,
      recipientAddress: request.recipientAddress,
      outputAmountBaseUnits: request.outputAmountBaseUnits,
    });

    if (decision.outcome === "pending" || decision.outcome === "incomplete") {
      await ctx.db.patch(attempt._id, {
        acrossStatus: "pending",
        updatedAt: now,
        failureReason: decision.outcome === "incomplete" ? decision.reason : undefined,
      });
      if (decision.outcome === "incomplete") {
        console.log("payment_fill_incomplete", {
          publicId: request.publicId,
          depositTxnRef,
          reason: decision.reason,
        });
      }
      if (isReconciliationStuck(attempt.createdAt, now)) {
        console.error("payment_reconciliation_stuck", {
          publicId: request.publicId,
          depositTxnRef,
          acrossStatus: "pending",
          reason: decision.outcome === "incomplete" ? decision.reason : "still pending",
          ageMs: now - attempt.createdAt,
        });
      }
      return {
        requestStatus: request.status,
        attemptStatus: "pending",
        reason: decision.outcome === "incomplete" ? decision.reason : undefined,
      };
    }

    if (decision.outcome === "mismatch") {
      await ctx.db.patch(attempt._id, {
        acrossStatus: "failed",
        failureReason: decision.reason,
        updatedAt: now,
      });
      const requestStatus = (await reopenAfterTerminalAttempt(ctx, request._id)) ?? request.status;
      console.error("payment_fill_mismatch", {
        publicId: request.publicId,
        depositTxnRef,
        reason: decision.reason,
      });
      return { requestStatus, attemptStatus: "failed", reason: decision.reason };
    }

    if (decision.outcome === "expired" || decision.outcome === "refunded") {
      await ctx.db.patch(attempt._id, {
        acrossStatus: decision.outcome,
        fillTxnRef: args.fillTxnRef?.toLowerCase(),
        updatedAt: now,
      });
      const requestStatus = (await reopenAfterTerminalAttempt(ctx, request._id)) ?? request.status;
      console.log("payment_attempt_terminal", {
        publicId: request.publicId,
        depositTxnRef,
        acrossStatus: decision.outcome,
      });
      return { requestStatus, attemptStatus: decision.outcome };
    }

    if (request.status === "completed") {
      await ctx.db.patch(attempt._id, {
        acrossStatus: "ignored_duplicate",
        fillTxnRef: args.fillTxnRef?.toLowerCase(),
        failureReason: "Request was already paid by another attempt",
        updatedAt: now,
      });
      console.log("payment_fill_ignored_duplicate", {
        publicId: request.publicId,
        depositTxnRef,
      });
      return { requestStatus: "completed", attemptStatus: "ignored_duplicate" };
    }

    await ctx.db.patch(attempt._id, {
      acrossStatus: "filled",
      fillTxnRef: args.fillTxnRef?.toLowerCase(),
      failureReason: undefined,
      updatedAt: now,
    });
    await ctx.db.patch(request._id, { status: "completed", updatedAt: now });
    console.log("payment_completed", {
      publicId: request.publicId,
      depositTxnRef,
      fillTxnRef: args.fillTxnRef?.toLowerCase(),
    });
    return { requestStatus: "completed", attemptStatus: "filled" };
  },
});
