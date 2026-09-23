import type { QueryCtx, MutationCtx } from "../_generated/server";
import type { Doc } from "../_generated/dataModel";

type AuthCtx = QueryCtx | MutationCtx;

async function userForIdentity(
  ctx: AuthCtx,
  identity: { subject: string; issuer: string },
): Promise<Doc<"users"> | null> {
  return await ctx.db
    .query("users")
    .withIndex("by_auth", (q) =>
      q.eq("authIssuer", identity.issuer).eq("authSubject", identity.subject),
    )
    .unique();
}

export async function getCurrentUserOrNull(ctx: AuthCtx): Promise<Doc<"users"> | null> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;
  return await userForIdentity(ctx, identity);
}

export async function getCurrentUser(ctx: AuthCtx): Promise<Doc<"users">> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error("Not authenticated");
  }

  const user = await userForIdentity(ctx, identity);
  if (!user) {
    throw new Error("User not found");
  }
  return user;
}

export function payoutAddress(user: Doc<"users">): string {
  return (user.smartAccountAddress ?? user.address).toLowerCase();
}
