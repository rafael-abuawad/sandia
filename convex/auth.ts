import {
  mutation,
  query,
  internalMutation,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";

const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days
const NONCE_TTL_MS = 1000 * 60 * 10; // 10 minutes

export async function requireSession(
  ctx: QueryCtx | MutationCtx,
  sessionToken: string,
): Promise<{ user: Doc<"users">; session: Doc<"sessions"> }> {
  const session = await ctx.db
    .query("sessions")
    .withIndex("by_token", (q) => q.eq("token", sessionToken))
    .unique();

  if (!session || session.expiresAt < Date.now()) {
    throw new Error("Unauthorized: invalid or expired session");
  }

  const user = await ctx.db.get(session.userId);
  if (!user) {
    throw new Error("Unauthorized: user not found");
  }

  return { user, session };
}

function normalizeAddress(address: string): string {
  return address.toLowerCase();
}

export const getNonce = mutation({
  args: { address: v.string() },
  handler: async (ctx, args) => {
    const address = normalizeAddress(args.address);
    if (!/^0x[a-f0-9]{40}$/.test(address)) {
      throw new Error("Invalid wallet address");
    }

    const nonce = crypto.randomUUID().replace(/-/g, "");
    const now = Date.now();
    const expiresAt = now + NONCE_TTL_MS;

    const existing = await ctx.db
      .query("authNonces")
      .withIndex("by_address", (q) => q.eq("address", address))
      .collect();
    await Promise.all(existing.map((row) => ctx.db.delete(row._id)));

    await ctx.db.insert("authNonces", { address, nonce, expiresAt });
    return { nonce, expiresAt };
  },
});

export const createSessionAfterSiwe = internalMutation({
  args: {
    address: v.string(),
    nonce: v.string(),
  },
  handler: async (ctx, args) => {
    const address = normalizeAddress(args.address);
    const nonceRow = await ctx.db
      .query("authNonces")
      .withIndex("by_address", (q) => q.eq("address", address))
      .unique();

    if (!nonceRow || nonceRow.nonce !== args.nonce || nonceRow.expiresAt < Date.now()) {
      throw new Error("Invalid or expired nonce");
    }

    await ctx.db.delete(nonceRow._id);

    const now = Date.now();
    let user = await ctx.db
      .query("users")
      .withIndex("by_address", (q) => q.eq("address", address))
      .unique();

    if (!user) {
      const userId = await ctx.db.insert("users", {
        address,
        createdAt: now,
        updatedAt: now,
      });
      user = (await ctx.db.get(userId))!;
    } else {
      await ctx.db.patch(user._id, { updatedAt: now });
    }

    // Invalidate prior sessions for this address
    const prior = await ctx.db
      .query("sessions")
      .withIndex("by_address", (q) => q.eq("address", address))
      .collect();
    await Promise.all(prior.map((s) => ctx.db.delete(s._id)));

    const token = crypto.randomUUID() + crypto.randomUUID().replace(/-/g, "");
    const expiresAt = now + SESSION_TTL_MS;
    await ctx.db.insert("sessions", {
      token,
      userId: user._id,
      address,
      expiresAt,
      createdAt: now,
    });

    return {
      token,
      expiresAt,
      address: user.address,
      userId: user._id as Id<"users">,
    };
  },
});

export const me = query({
  args: { sessionToken: v.string() },
  handler: async (ctx, args) => {
    try {
      const { user, session } = await requireSession(ctx, args.sessionToken);
      return {
        address: user.address,
        userId: user._id,
        expiresAt: session.expiresAt,
      };
    } catch {
      return null;
    }
  },
});

export const signOut = mutation({
  args: { sessionToken: v.string() },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("sessions")
      .withIndex("by_token", (q) => q.eq("token", args.sessionToken))
      .unique();
    if (session) {
      await ctx.db.delete(session._id);
    }
    return { ok: true };
  },
});
