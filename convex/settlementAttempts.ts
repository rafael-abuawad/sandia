import { internalMutation, internalQuery, query } from "./_generated/server";
import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { settlementKind, settlementStatus } from "./schema";
import {
  MAX_ACTIVE_DEPOSITS_PER_REQUEST,
  MAX_ATTEMPTS_PER_REQUEST,
  RECONCILE_BATCH,
} from "./lib/settlement";

const TX_HASH = /^[0-9a-f]{64}$/;

const publicAttempt = v.object({
  _id: v.id("settlementAttempts"),
  _creationTime: v.number(),
  kind: settlementKind,
  status: settlementStatus,
  txHash: v.optional(v.string()),
  amountBaseUnits: v.string(),
  originSymbol: v.optional(v.string()),
  originChain: v.optional(v.string()),
  originDecimals: v.optional(v.number()),
  depositAddress: v.optional(v.string()),
  depositMemo: v.optional(v.string()),
  amountIn: v.optional(v.string()),
  minAmountIn: v.optional(v.string()),
  deadline: v.optional(v.number()),
  timeEstimate: v.optional(v.number()),
  failureReason: v.optional(v.string()),
  createdAt: v.number(),
});

/** The fields anyone holding the payment link can see. Refund addresses stay private. */
function toPublic(row: Doc<"settlementAttempts">) {
  return {
    _id: row._id,
    _creationTime: row._creationTime,
    kind: row.kind,
    status: row.status,
    txHash: row.txHash,
    amountBaseUnits: row.amountBaseUnits,
    originSymbol: row.originSymbol,
    originChain: row.originChain,
    originDecimals: row.originDecimals,
    depositAddress: row.depositAddress,
    depositMemo: row.depositMemo,
    amountIn: row.amountIn,
    minAmountIn: row.minAmountIn,
    deadline: row.deadline,
    timeEstimate: row.timeEstimate,
    failureReason: row.failureReason,
    createdAt: row.createdAt,
  };
}

export const listByRequest = query({
  args: { publicId: v.string(), paginationOpts: paginationOptsValidator },
  returns: v.object({
    page: v.array(publicAttempt),
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
      return { page: [], isDone: true, continueCursor: "", splitCursor: null, pageStatus: null };
    }
    const result = await ctx.db
      .query("settlementAttempts")
      .withIndex("by_request", (q) => q.eq("requestId", request._id))
      .order("desc")
      .paginate(args.paginationOpts);
    return { ...result, page: result.page.map(toPublic) };
  },
});

async function reopenRequest(ctx: MutationCtx, requestId: Id<"paymentRequests">) {
  const request = await ctx.db.get(requestId);
  if (!request || request.status !== "pending") return;
  const now = Date.now();
  const expired = request.expiresAt !== undefined && request.expiresAt <= now;
  await ctx.db.patch(requestId, { status: expired ? "expired" : "open", updatedAt: now });
}

/** Completes the request, or records why this payment arrived too late to count. */
async function settle(
  ctx: MutationCtx,
  attempt: Doc<"settlementAttempts">,
  txHash: string,
): Promise<"settled" | "ignored_duplicate"> {
  const request = await ctx.db.get(attempt.requestId);
  if (!request) throw new Error("Payment request not found");
  const now = Date.now();
  if (request.status === "open" || request.status === "pending") {
    await ctx.db.patch(attempt._id, {
      status: "settled",
      txHash,
      failureReason: undefined,
      updatedAt: now,
    });
    await ctx.db.patch(request._id, { status: "completed", updatedAt: now });
    console.log("payment_completed", { publicId: request.publicId, txHash });
    return "settled";
  }
  await ctx.db.patch(attempt._id, {
    status: "ignored_duplicate",
    txHash,
    failureReason: `The request was already ${request.status} when this payment arrived.`,
    updatedAt: now,
  });
  console.log("payment_settlement_ignored", { publicId: request.publicId, txHash });
  return "ignored_duplicate";
}

export const settleDirect = internalMutation({
  args: {
    publicId: v.string(),
    payerAddress: v.string(),
    txHash: v.string(),
    amountBaseUnits: v.string(),
  },
  returns: v.object({ status: settlementStatus }),
  handler: async (ctx, args) => {
    const txHash = args.txHash.toLowerCase();
    if (!TX_HASH.test(txHash)) throw new Error("Invalid transaction hash");
    const request = await ctx.db
      .query("paymentRequests")
      .withIndex("by_publicId", (q) => q.eq("publicId", args.publicId))
      .unique();
    if (!request) throw new Error("Payment request not found");

    const existing = await ctx.db
      .query("settlementAttempts")
      .withIndex("by_txHash", (q) => q.eq("txHash", txHash))
      .first();
    if (existing) {
      if (existing.requestId !== request._id) {
        throw new Error("This transaction already settled another request");
      }
      return { status: existing.status };
    }

    const now = Date.now();
    const attemptId = await ctx.db.insert("settlementAttempts", {
      requestId: request._id,
      kind: "direct",
      status: "processing",
      payerAddress: args.payerAddress,
      amountBaseUnits: args.amountBaseUnits,
      createdAt: now,
      updatedAt: now,
    });
    const attempt = await ctx.db.get(attemptId);
    if (!attempt) throw new Error("Payment attempt not found");
    return { status: await settle(ctx, attempt, txHash) };
  },
});

export const createDeposit = internalMutation({
  args: {
    publicId: v.string(),
    amountBaseUnits: v.string(),
    originAsset: v.string(),
    originSymbol: v.string(),
    originChain: v.string(),
    originDecimals: v.number(),
    depositAddress: v.string(),
    depositMemo: v.optional(v.string()),
    amountIn: v.string(),
    minAmountIn: v.string(),
    refundTo: v.string(),
    deadline: v.number(),
    timeEstimate: v.number(),
    correlationId: v.optional(v.string()),
    quoteSignature: v.optional(v.string()),
  },
  returns: v.id("settlementAttempts"),
  handler: async (ctx, args) => {
    const { publicId, ...fields } = args;
    const request = await ctx.db
      .query("paymentRequests")
      .withIndex("by_publicId", (q) => q.eq("publicId", publicId))
      .unique();
    if (!request) throw new Error("Payment request not found");
    if (request.status !== "open") throw new Error("Payment request is not payable");
    const now = Date.now();
    return await ctx.db.insert("settlementAttempts", {
      requestId: request._id,
      kind: "near_intents",
      status: "awaiting_deposit",
      ...fields,
      createdAt: now,
      updatedAt: now,
    });
  },
});

/** Reuses a live deposit, so reloading the page doesn't issue a new address. Enforces the caps. */
export const prepareDeposit = internalQuery({
  args: { publicId: v.string(), originAsset: v.string(), refundTo: v.string() },
  returns: v.object({
    existing: v.optional(v.id("settlementAttempts")),
    allowed: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const request = await ctx.db
      .query("paymentRequests")
      .withIndex("by_publicId", (q) => q.eq("publicId", args.publicId))
      .unique();
    if (!request) throw new Error("Payment request not found");
    const rows = await ctx.db
      .query("settlementAttempts")
      .withIndex("by_request", (q) => q.eq("requestId", request._id))
      .take(MAX_ATTEMPTS_PER_REQUEST + 1);
    const now = Date.now();
    const live = rows.filter(
      (row) => row.status === "awaiting_deposit" && (row.deadline ?? 0) > now,
    );
    const existing = live.find(
      (row) => row.originAsset === args.originAsset && row.refundTo === args.refundTo,
    );
    return {
      existing: existing?._id,
      allowed:
        rows.length <= MAX_ATTEMPTS_PER_REQUEST && live.length < MAX_ACTIVE_DEPOSITS_PER_REQUEST,
    };
  },
});

const reconcileRow = v.object({
  attemptId: v.id("settlementAttempts"),
  depositAddress: v.string(),
  depositMemo: v.optional(v.string()),
  status: settlementStatus,
  deadline: v.optional(v.number()),
  createdAt: v.number(),
  recipientAddress: v.string(),
  outputAmountBaseUnits: v.string(),
  publicId: v.string(),
});

export const getForSync = internalQuery({
  args: { attemptId: v.id("settlementAttempts") },
  returns: v.union(reconcileRow, v.null()),
  handler: async (ctx, args) => {
    const attempt = await ctx.db.get(args.attemptId);
    if (!attempt?.depositAddress) return null;
    const request = await ctx.db.get(attempt.requestId);
    if (!request) return null;
    return {
      attemptId: attempt._id,
      depositAddress: attempt.depositAddress,
      depositMemo: attempt.depositMemo,
      status: attempt.status,
      deadline: attempt.deadline,
      createdAt: attempt.createdAt,
      recipientAddress: request.recipientAddress,
      outputAmountBaseUnits: request.outputAmountBaseUnits,
      publicId: request.publicId,
    };
  },
});

export const listForReconciliation = internalQuery({
  args: {},
  returns: v.array(reconcileRow),
  handler: async (ctx) => {
    const [processing, awaiting] = await Promise.all([
      ctx.db
        .query("settlementAttempts")
        .withIndex("by_status", (q) => q.eq("status", "processing"))
        .take(RECONCILE_BATCH),
      ctx.db
        .query("settlementAttempts")
        .withIndex("by_status", (q) => q.eq("status", "awaiting_deposit"))
        .take(RECONCILE_BATCH),
    ]);
    const candidates = [...processing, ...awaiting]
      .filter((row) => row.kind === "near_intents" && row.depositAddress)
      .slice(0, RECONCILE_BATCH);
    const requests = await Promise.all(candidates.map((row) => ctx.db.get(row.requestId)));
    return candidates.flatMap((row, index) => {
      const request = requests[index];
      if (!request || !row.depositAddress) return [];
      return [
        {
          attemptId: row._id,
          depositAddress: row.depositAddress,
          depositMemo: row.depositMemo,
          status: row.status,
          deadline: row.deadline,
          createdAt: row.createdAt,
          recipientAddress: request.recipientAddress,
          outputAmountBaseUnits: request.outputAmountBaseUnits,
          publicId: request.publicId,
        },
      ];
    });
  },
});

export const markProcessing = internalMutation({
  args: { attemptId: v.id("settlementAttempts"), reason: v.optional(v.string()) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const attempt = await ctx.db.get(args.attemptId);
    if (!attempt) return null;
    if (attempt.status !== "awaiting_deposit" && attempt.status !== "processing") return null;
    const now = Date.now();
    await ctx.db.patch(attempt._id, {
      status: "processing",
      failureReason: args.reason,
      updatedAt: now,
    });
    const request = await ctx.db.get(attempt.requestId);
    if (request?.status === "open") {
      await ctx.db.patch(request._id, { status: "pending", updatedAt: now });
    }
    return null;
  },
});

export const markTerminal = internalMutation({
  args: {
    attemptId: v.id("settlementAttempts"),
    status: v.union(v.literal("refunded"), v.literal("failed"), v.literal("expired")),
    reason: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const attempt = await ctx.db.get(args.attemptId);
    if (!attempt) return null;
    if (attempt.status !== "awaiting_deposit" && attempt.status !== "processing") return null;
    await ctx.db.patch(attempt._id, {
      status: args.status,
      failureReason: args.reason,
      updatedAt: Date.now(),
    });
    // Only an in-flight deposit moved the request to pending. Others may still be live.
    const others = await ctx.db
      .query("settlementAttempts")
      .withIndex("by_request", (q) => q.eq("requestId", attempt.requestId))
      .take(MAX_ATTEMPTS_PER_REQUEST + 1);
    if (!others.some((row) => row._id !== attempt._id && row.status === "processing")) {
      await reopenRequest(ctx, attempt.requestId);
    }
    console.log("payment_attempt_terminal", { attemptId: attempt._id, status: args.status });
    return null;
  },
});

export const settleDeposit = internalMutation({
  args: { attemptId: v.id("settlementAttempts"), txHash: v.string() },
  returns: v.object({ status: settlementStatus }),
  handler: async (ctx, args) => {
    const txHash = args.txHash.toLowerCase();
    if (!TX_HASH.test(txHash)) throw new Error("Invalid transaction hash");
    const attempt = await ctx.db.get(args.attemptId);
    if (!attempt) throw new Error("Payment attempt not found");
    if (attempt.status === "settled" || attempt.status === "ignored_duplicate") {
      return { status: attempt.status };
    }
    const reused = await ctx.db
      .query("settlementAttempts")
      .withIndex("by_txHash", (q) => q.eq("txHash", txHash))
      .first();
    if (reused && reused._id !== attempt._id) {
      await ctx.db.patch(attempt._id, {
        status: "failed",
        failureReason: "This transaction already settled another attempt.",
        updatedAt: Date.now(),
      });
      await reopenRequest(ctx, attempt.requestId);
      return { status: "failed" as const };
    }
    return { status: await settle(ctx, attempt, txHash) };
  },
});
