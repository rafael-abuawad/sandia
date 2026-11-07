import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { getCurrentUserOrNull } from "./lib/auth";
import { activityStatus } from "./schema";

const callValidator = v.object({ recipient: v.string(), amount: v.string() });

const sendValidator = v.object({
  _id: v.id("sends"),
  _creationTime: v.number(),
  userId: v.id("users"),
  txHash: v.string(),
  callsJson: v.string(),
  memo: v.optional(v.string()),
  status: activityStatus,
  failureReason: v.optional(v.string()),
  createdAt: v.number(),
  updatedAt: v.number(),
});

export const record = mutation({
  args: { txHash: v.string(), calls: v.array(callValidator), memo: v.optional(v.string()) },
  returns: v.id("sends"),
  handler: async (ctx, args) => {
    const user = await getCurrentUserOrNull(ctx);
    if (!user) throw new Error("Not authenticated");
    const txHash = args.txHash.trim().toLowerCase();
    if (!/^[0-9a-f]{64}$/.test(txHash)) throw new Error("Missing send transaction hash");
    const existing = await ctx.db
      .query("sends")
      .withIndex("by_txHash", (q) => q.eq("txHash", txHash))
      .unique();
    if (existing) {
      if (existing.userId !== user._id) throw new Error("This send belongs to another account");
      return existing._id;
    }
    const now = Date.now();
    const id = await ctx.db.insert("sends", {
      userId: user._id,
      txHash,
      callsJson: JSON.stringify(args.calls),
      memo: args.memo,
      status: "submitted",
      createdAt: now,
      updatedAt: now,
    });
    console.log("send_submitted", { userId: user._id, txHash });
    return id;
  },
});

export const listMine = query({
  args: { paginationOpts: paginationOptsValidator },
  returns: v.object({
    page: v.array(sendValidator),
    isDone: v.boolean(),
    continueCursor: v.string(),
    splitCursor: v.optional(v.union(v.string(), v.null())),
    pageStatus: v.optional(v.union(v.string(), v.null())),
  }),
  handler: async (ctx, args) => {
    const user = await getCurrentUserOrNull(ctx);
    if (!user) {
      return { page: [], isDone: true, continueCursor: "", splitCursor: null, pageStatus: null };
    }
    return await ctx.db
      .query("sends")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .order("desc")
      .paginate(args.paginationOpts);
  },
});

const pendingRow = v.object({
  id: v.id("sends"),
  txHash: v.string(),
  callsJson: v.string(),
  createdAt: v.number(),
});

export const listSubmitted = internalQuery({
  args: { limit: v.number() },
  returns: v.array(pendingRow),
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("sends")
      .withIndex("by_status", (q) => q.eq("status", "submitted"))
      .take(Math.min(args.limit, 25));
    return rows.map((row) => ({
      id: row._id,
      txHash: row.txHash,
      callsJson: row.callsJson,
      createdAt: row.createdAt,
    }));
  },
});

export const getOwned = internalQuery({
  args: { txHash: v.string() },
  returns: v.union(pendingRow, v.null()),
  handler: async (ctx, args) => {
    const user = await getCurrentUserOrNull(ctx);
    if (!user) return null;
    const row = await ctx.db
      .query("sends")
      .withIndex("by_txHash", (q) => q.eq("txHash", args.txHash.toLowerCase()))
      .unique();
    if (!row || row.userId !== user._id) return null;
    return { id: row._id, txHash: row.txHash, callsJson: row.callsJson, createdAt: row.createdAt };
  },
});

export const markResult = internalMutation({
  args: {
    id: v.id("sends"),
    status: activityStatus,
    failureReason: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      status: args.status,
      failureReason: args.failureReason,
      updatedAt: Date.now(),
    });
    if (args.status === "failed") {
      console.error("send_failed", { id: args.id, reason: args.failureReason });
    }
    return null;
  },
});
