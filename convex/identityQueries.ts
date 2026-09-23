import { internalMutation } from "./_generated/server";
import { v } from "convex/values";

export const upsertKernelUser = internalMutation({
  args: {
    authIssuer: v.string(),
    authSubject: v.string(),
    smartAccountAddress: v.string(),
    kernelVersion: v.optional(v.string()),
    entryPointVersion: v.optional(v.string()),
  },
  returns: v.id("users"),
  handler: async (ctx, args) => {
    const address = args.smartAccountAddress.toLowerCase();
    const now = Date.now();
    const byAuth = await ctx.db
      .query("users")
      .withIndex("by_auth", (q) =>
        q.eq("authIssuer", args.authIssuer).eq("authSubject", args.authSubject),
      )
      .unique();
    const byAccount = await ctx.db
      .query("users")
      .withIndex("by_smartAccount", (q) => q.eq("smartAccountAddress", address))
      .unique();
    const byAddress = await ctx.db
      .query("users")
      .withIndex("by_address", (q) => q.eq("address", address))
      .unique();

    if (byAuth && byAccount && byAuth._id !== byAccount._id) {
      throw new Error("This smart account is already linked to another account");
    }
    if (byAuth && byAddress && byAuth._id !== byAddress._id) {
      throw new Error("This wallet is already linked to another account");
    }
    if (!byAuth && byAccount?.authSubject && byAccount.authSubject !== args.authSubject) {
      throw new Error("This smart account is already linked to another account");
    }
    if (!byAuth && byAddress?.authSubject && byAddress.authSubject !== args.authSubject) {
      throw new Error("This wallet is already linked to another account");
    }

    const existing = byAuth ?? byAccount ?? byAddress;
    if (existing) {
      await ctx.db.patch(existing._id, {
        address,
        smartAccountAddress: address,
        authIssuer: args.authIssuer,
        authSubject: args.authSubject,
        kernelVersion: args.kernelVersion ?? existing.kernelVersion ?? "kernel",
        entryPointVersion: args.entryPointVersion ?? existing.entryPointVersion ?? "0.7",
        updatedAt: now,
      });
      console.log("kernel_account_upserted", { userId: existing._id, address });
      return existing._id;
    }

    const userId = await ctx.db.insert("users", {
      address,
      smartAccountAddress: address,
      authIssuer: args.authIssuer,
      authSubject: args.authSubject,
      kernelVersion: args.kernelVersion ?? "kernel",
      entryPointVersion: args.entryPointVersion ?? "0.7",
      createdAt: now,
      updatedAt: now,
    });
    console.log("kernel_account_created", { userId, address });
    return userId;
  },
});
