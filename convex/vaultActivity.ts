import { internalMutation, internalQuery, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getCurrentUser, getCurrentUserOrNull } from "./lib/auth";
import { STEAKHOUSE_USDG_VAULT } from "../lib/vault-gate";
import { activityStatus } from "./schema";

const kindValidator = v.union(v.literal("deposit"), v.literal("withdraw"), v.literal("redeem"));

const ownedValidator = v.object({
  id: v.id("vaultActivities"),
  userId: v.id("users"),
  account: v.string(),
  kind: kindValidator,
  assets: v.string(),
  shares: v.optional(v.string()),
  userOpHash: v.string(),
  status: activityStatus,
  vaultAddress: v.string(),
});

export const record = mutation({
  args: {
    kind: kindValidator,
    assets: v.string(),
    shares: v.optional(v.string()),
    userOpHash: v.string(),
  },
  returns: v.id("vaultActivities"),
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    const userOpHash = args.userOpHash.trim();
    if (!/^0x[0-9a-fA-F]{64}$/.test(userOpHash)) {
      throw new Error("Missing vault transaction hash");
    }
    if (!/^\d+$/.test(args.assets) || BigInt(args.assets) <= 0n) {
      throw new Error("Amount must be greater than zero");
    }
    if (args.shares !== undefined && (!/^\d+$/.test(args.shares) || BigInt(args.shares) <= 0n)) {
      throw new Error("Share amount must be greater than zero");
    }
    if (args.kind === "redeem" && args.shares === undefined) {
      throw new Error("A redeem needs the share amount");
    }

    const existing = await ctx.db
      .query("vaultActivities")
      .withIndex("by_userOpHash", (q) => q.eq("userOpHash", userOpHash))
      .unique();
    if (existing) {
      if (existing.userId !== user._id)
        throw new Error("This vault action belongs to another account");
      return existing._id;
    }

    const now = Date.now();
    const id = await ctx.db.insert("vaultActivities", {
      userId: user._id,
      vaultAddress: STEAKHOUSE_USDG_VAULT,
      kind: args.kind,
      assets: args.assets,
      shares: args.shares,
      userOpHash,
      status: "submitted",
      createdAt: now,
      updatedAt: now,
    });
    console.log("vault_activity_submitted", { userId: user._id, kind: args.kind, userOpHash });
    return id;
  },
});

export const getOwned = internalQuery({
  args: { id: v.id("vaultActivities") },
  returns: v.union(ownedValidator, v.null()),
  handler: async (ctx, args) => {
    const user = await getCurrentUserOrNull(ctx);
    if (!user) return null;
    const row = await ctx.db.get(args.id);
    if (!row || row.userId !== user._id || !row.userOpHash) return null;
    return {
      id: row._id,
      userId: row.userId,
      account: user.address,
      kind: row.kind,
      assets: row.assets,
      shares: row.shares,
      userOpHash: row.userOpHash,
      status: row.status,
      vaultAddress: row.vaultAddress,
    };
  },
});

export const markResult = internalMutation({
  args: {
    id: v.id("vaultActivities"),
    status: activityStatus,
    assets: v.optional(v.string()),
    shares: v.optional(v.string()),
    failureReason: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const patch: {
      status: typeof args.status;
      updatedAt: number;
      assets?: string;
      shares?: string;
      failureReason?: string;
    } = {
      status: args.status,
      updatedAt: Date.now(),
    };
    if (args.assets !== undefined) patch.assets = args.assets;
    if (args.shares !== undefined) patch.shares = args.shares;
    if (args.failureReason !== undefined) patch.failureReason = args.failureReason;
    await ctx.db.patch(args.id, patch);
    if (args.status === "failed") {
      console.error("vault_activity_failed", { id: args.id, reason: args.failureReason });
    } else if (args.status === "filled") {
      console.log("vault_activity_filled", { id: args.id });
    }
    return null;
  },
});
