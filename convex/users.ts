import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getCurrentUserOrNull } from "./lib/auth";
import { assertClaimNonce, recoverClaimAddress, signClaimNonce } from "./lib/walletClaim";

function normalizeAddress(address: string): string {
  const lower = address.toLowerCase();
  if (!/^0x[a-f0-9]{40}$/.test(lower)) {
    throw new Error("Invalid Ethereum address");
  }
  return lower;
}

function claimSecret(): string {
  const secret = process.env.SANDIA_NONCE_SECRET ?? process.env.PRIVY_APP_ID;
  if (!secret) {
    throw new Error("Wallet claim is not configured");
  }
  return secret;
}

const userValidator = v.object({
  _id: v.id("users"),
  _creationTime: v.number(),
  privyDid: v.optional(v.string()),
  address: v.string(),
  email: v.optional(v.string()),
  authIssuer: v.optional(v.string()),
  authSubject: v.optional(v.string()),
  smartAccountAddress: v.optional(v.string()),
  kernelVersion: v.optional(v.string()),
  entryPointVersion: v.optional(v.string()),
  createdAt: v.number(),
  updatedAt: v.number(),
});

export const me = query({
  args: {},
  returns: v.union(userValidator, v.null()),
  handler: async (ctx) => {
    return await getCurrentUserOrNull(ctx);
  },
});

export const issueNonce = mutation({
  args: {},
  returns: v.string(),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const expiresAt = Date.now() + 10 * 60 * 1000;
    return await signClaimNonce(identity.subject, expiresAt, claimSecret());
  },
});

export const store = mutation({
  args: {
    address: v.string(),
    email: v.optional(v.string()),
    nonce: v.string(),
    signature: v.string(),
  },
  returns: v.id("users"),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const now = Date.now();
    await assertClaimNonce(identity.subject, args.nonce, claimSecret(), now);
    const recovered = await recoverClaimAddress(args.nonce, args.signature);
    const address = normalizeAddress(args.address);
    if (recovered !== address) {
      throw new Error("Signature does not match this wallet");
    }

    const privyDid = identity.issuer === "privy.io" ? identity.subject : undefined;
    const email = args.email?.trim() || undefined;

    const byDid = privyDid
      ? await ctx.db
          .query("users")
          .withIndex("by_privyDid", (q) => q.eq("privyDid", privyDid))
          .unique()
      : await ctx.db
          .query("users")
          .withIndex("by_auth", (q) =>
            q.eq("authIssuer", identity.issuer).eq("authSubject", identity.subject),
          )
          .unique();

    const addressOwner = await ctx.db
      .query("users")
      .withIndex("by_address", (q) => q.eq("address", address))
      .unique();

    if (byDid) {
      if (addressOwner && addressOwner._id !== byDid._id) {
        throw new Error("This wallet is already linked to another account");
      }
      await ctx.db.patch(byDid._id, { address, email: email ?? byDid.email, updatedAt: now });
      console.log("payment_wallet_claimed", { userId: byDid._id, address });
      return byDid._id;
    }

    if (addressOwner) {
      if (addressOwner.privyDid && privyDid && addressOwner.privyDid !== privyDid) {
        throw new Error("This wallet is already linked to another account");
      }
      await ctx.db.patch(addressOwner._id, {
        privyDid: privyDid ?? addressOwner.privyDid,
        email: email ?? addressOwner.email,
        updatedAt: now,
      });
      console.log("payment_wallet_claimed", { userId: addressOwner._id, address });
      return addressOwner._id;
    }

    const userId = await ctx.db.insert("users", {
      privyDid,
      address,
      email,
      authIssuer: identity.issuer === "privy.io" ? undefined : identity.issuer,
      authSubject: identity.issuer === "privy.io" ? undefined : identity.subject,
      createdAt: now,
      updatedAt: now,
    });
    console.log("payment_wallet_claimed", { userId, address });
    return userId;
  },
});
