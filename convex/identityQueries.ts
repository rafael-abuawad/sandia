import { internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";

export const linkOwners = internalQuery({
  args: {
    authSubject: v.string(),
    smartAccountAddress: v.string(),
  },
  returns: v.object({
    subjectOwnerId: v.union(v.id("users"), v.null()),
    accountOwnerId: v.union(v.id("users"), v.null()),
  }),
  handler: async (ctx, args) => {
    const subjectOwner = await ctx.db
      .query("users")
      .withIndex("by_auth", (q) =>
        q.eq("authIssuer", process.env.SANDIA_JWT_ISS ?? "sandia").eq("authSubject", args.authSubject),
      )
      .unique();
    const accountOwner = await ctx.db
      .query("users")
      .withIndex("by_smartAccount", (q) => q.eq("smartAccountAddress", args.smartAccountAddress))
      .unique();
    return {
      subjectOwnerId: subjectOwner?._id ?? null,
      accountOwnerId: accountOwner?._id ?? null,
    };
  },
});

export const currentPrivyUser = internalQuery({
  args: {},
  returns: v.union(v.object({ userId: v.id("users") }), v.null()),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    const user = await ctx.db
      .query("users")
      .withIndex("by_privyDid", (q) => q.eq("privyDid", identity.subject))
      .unique();
    if (!user) return null;
    return { userId: user._id };
  },
});

export const applyLink = internalMutation({
  args: {
    userId: v.id("users"),
    authSubject: v.string(),
    smartAccountAddress: v.string(),
    kernelVersion: v.optional(v.string()),
    entryPointVersion: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const issuer = process.env.SANDIA_JWT_ISS ?? "sandia";
    await ctx.db.patch(args.userId as Id<"users">, {
      authIssuer: issuer,
      authSubject: args.authSubject,
      smartAccountAddress: args.smartAccountAddress,
      kernelVersion: args.kernelVersion ?? "kernel",
      entryPointVersion: args.entryPointVersion ?? "0.7",
      updatedAt: Date.now(),
    });
    return null;
  },
});
