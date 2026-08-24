import { mutation } from "./_generated/server";
import { v } from "convex/values";

function normalizeAddress(address: string): string {
  const lower = address.toLowerCase();
  if (!/^0x[a-f0-9]{40}$/.test(lower)) {
    throw new Error("Invalid Ethereum address");
  }
  return lower;
}

export const store = mutation({
  args: {
    address: v.string(),
    email: v.optional(v.string()),
  },
  returns: v.id("users"),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const privyDid = identity.subject;
    const address = normalizeAddress(args.address);
    const email = args.email?.trim() || undefined;
    const now = Date.now();

    const byDid = await ctx.db
      .query("users")
      .withIndex("by_privyDid", (q) => q.eq("privyDid", privyDid))
      .unique();

    if (byDid) {
      const addressOwner = await ctx.db
        .query("users")
        .withIndex("by_address", (q) => q.eq("address", address))
        .unique();
      if (addressOwner && addressOwner._id !== byDid._id) {
        throw new Error("This wallet is already linked to another account");
      }

      await ctx.db.patch(byDid._id, {
        address,
        email,
        updatedAt: now,
      });
      console.log("Updated Convex user from Privy identity", { privyDid, address });
      return byDid._id;
    }

    const byAddress = await ctx.db
      .query("users")
      .withIndex("by_address", (q) => q.eq("address", address))
      .unique();

    if (byAddress) {
      if (byAddress.privyDid && byAddress.privyDid !== privyDid) {
        throw new Error("This wallet is already linked to another account");
      }
      await ctx.db.patch(byAddress._id, {
        privyDid,
        email: email ?? byAddress.email,
        updatedAt: now,
      });
      console.log("Linked existing user to Privy identity", { privyDid, address });
      return byAddress._id;
    }

    const userId = await ctx.db.insert("users", {
      privyDid,
      address,
      email,
      createdAt: now,
      updatedAt: now,
    });
    console.log("Created Convex user from Privy identity", { privyDid, address });
    return userId;
  },
});
