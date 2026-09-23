import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { getCurrentUserOrNull } from "./lib/auth";
import { activityStatus } from "./schema";

const callValidator = v.object({
  recipient: v.string(),
  amount: v.string(),
});

const outboundValidator = v.object({
  _id: v.id("outboundTransfers"),
  _creationTime: v.number(),
  userId: v.id("users"),
  userOpHash: v.string(),
  bundleTxHash: v.optional(v.string()),
  callsJson: v.string(),
  status: activityStatus,
  failureReason: v.optional(v.string()),
  createdAt: v.number(),
  updatedAt: v.number(),
});

export const record = mutation({
  args: {
    userOpHash: v.string(),
    calls: v.array(callValidator),
  },
  returns: v.id("outboundTransfers"),
  handler: async (ctx, args) => {
    const user = await getCurrentUserOrNull(ctx);
    if (!user) throw new Error("Not authenticated");
    const userOpHash = args.userOpHash.trim();
    if (userOpHash.length < 8 || userOpHash.length > 200) {
      throw new Error("Missing UserOperation id");
    }
    const existing = await ctx.db
      .query("outboundTransfers")
      .withIndex("by_userOpHash", (q) => q.eq("userOpHash", userOpHash))
      .unique();
    if (existing) {
      if (existing.userId !== user._id) throw new Error("This send belongs to another account");
      return existing._id;
    }
    const now = Date.now();
    const id = await ctx.db.insert("outboundTransfers", {
      userId: user._id,
      userOpHash,
      callsJson: JSON.stringify(args.calls),
      status: "submitted",
      createdAt: now,
      updatedAt: now,
    });
    console.log("outbound_submitted", { userId: user._id, userOpHash });
    return id;
  },
});

export const listMine = query({
  args: { paginationOpts: paginationOptsValidator },
  returns: v.object({
    page: v.array(outboundValidator),
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
      .query("outboundTransfers")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .order("desc")
      .paginate(args.paginationOpts);
  },
});

export const listSubmitted = internalQuery({
  args: { limit: v.number() },
  returns: v.array(
    v.object({
      id: v.id("outboundTransfers"),
      userOpHash: v.string(),
      bundleTxHash: v.optional(v.string()),
      callsJson: v.string(),
      createdAt: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("outboundTransfers")
      .withIndex("by_status", (q) => q.eq("status", "submitted"))
      .take(Math.min(args.limit, 25));
    return rows.map((row) => ({
      id: row._id,
      userOpHash: row.userOpHash,
      bundleTxHash: row.bundleTxHash,
      callsJson: row.callsJson,
      createdAt: row.createdAt,
    }));
  },
});

export const getByUserOp = internalQuery({
  args: { userOpHash: v.string() },
  returns: v.union(
    v.object({
      id: v.id("outboundTransfers"),
      userId: v.id("users"),
      callsJson: v.string(),
      status: activityStatus,
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("outboundTransfers")
      .withIndex("by_userOpHash", (q) => q.eq("userOpHash", args.userOpHash))
      .unique();
    if (!row) return null;
    return { id: row._id, userId: row.userId, callsJson: row.callsJson, status: row.status };
  },
});

export const markResultInternal = internalMutation({
  args: {
    id: v.id("outboundTransfers"),
    bundleTxHash: v.optional(v.string()),
    status: activityStatus,
    failureReason: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      bundleTxHash: args.bundleTxHash,
      status: args.status,
      failureReason: args.failureReason,
      updatedAt: Date.now(),
    });
    if (args.status === "failed") {
      console.error("outbound_failed", { id: args.id, reason: args.failureReason });
    }
    return null;
  },
});
