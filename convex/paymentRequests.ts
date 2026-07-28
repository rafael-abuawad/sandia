import { mutation, query, internalMutation, type MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";

const ROBINHOOD_CHAIN_ID = 4663;
const ALLOWED_DEST_SYMBOLS = new Set(["USDC", "USDT", "USDG"]);

function normalizeAddress(address: string): string {
  const lower = address.toLowerCase();
  if (!/^0x[a-f0-9]{40}$/.test(lower)) {
    throw new Error("Invalid Ethereum address");
  }
  return lower;
}

function publicId(): string {
  const alphabet = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let id = "";
  for (const b of bytes) {
    id += alphabet[b % alphabet.length];
  }
  return id;
}

/** Convert USD micros (1e6) to token base units at 1:1 peg. */
export function usdMicrosToTokenBaseUnits(amountUsdMicros: number, tokenDecimals: number): string {
  if (!Number.isInteger(amountUsdMicros) || amountUsdMicros <= 0) {
    throw new Error("amountUsdMicros must be a positive integer");
  }
  if (!Number.isInteger(tokenDecimals) || tokenDecimals < 0 || tokenDecimals > 18) {
    throw new Error("Invalid token decimals");
  }
  if (tokenDecimals === 6) {
    return BigInt(amountUsdMicros).toString();
  }
  if (tokenDecimals > 6) {
    const factor = BigInt(10) ** BigInt(tokenDecimals - 6);
    return (BigInt(amountUsdMicros) * factor).toString();
  }
  const divisor = BigInt(10) ** BigInt(6 - tokenDecimals);
  const result = BigInt(amountUsdMicros) / divisor;
  if (result * divisor !== BigInt(amountUsdMicros)) {
    throw new Error("Amount has more precision than destination token supports");
  }
  return result.toString();
}

async function upsertUserByAddress(ctx: MutationCtx, address: string): Promise<Doc<"users">> {
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
  return user;
}

export const create = mutation({
  args: {
    creatorAddress: v.string(),
    amountUsdMicros: v.number(),
    recipientAddress: v.string(),
    destinationTokenSymbol: v.string(),
    destinationTokenAddress: v.string(),
    destinationTokenDecimals: v.number(),
    description: v.optional(v.string()),
    expiresAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const creatorAddress = normalizeAddress(args.creatorAddress);
    const user = await upsertUserByAddress(ctx, creatorAddress);

    const symbol = args.destinationTokenSymbol.toUpperCase();
    if (!ALLOWED_DEST_SYMBOLS.has(symbol)) {
      throw new Error("Destination token must be USDC, USDT, or USDG");
    }
    if (args.destinationTokenDecimals < 0 || args.destinationTokenDecimals > 18) {
      throw new Error("Invalid destination token decimals");
    }
    if (!Number.isInteger(args.amountUsdMicros) || args.amountUsdMicros <= 0) {
      throw new Error("Amount must be a positive integer in USD micros");
    }
    if (args.expiresAt !== undefined && args.expiresAt <= Date.now()) {
      throw new Error("Expiration must be in the future");
    }

    const recipientAddress = normalizeAddress(args.recipientAddress);
    const destinationTokenAddress = normalizeAddress(args.destinationTokenAddress);
    const outputAmountBaseUnits = usdMicrosToTokenBaseUnits(
      args.amountUsdMicros,
      args.destinationTokenDecimals,
    );

    const now = Date.now();
    const id = publicId();

    const requestId = await ctx.db.insert("paymentRequests", {
      publicId: id,
      creatorId: user._id,
      creatorAddress,
      amountUsdMicros: args.amountUsdMicros,
      recipientAddress,
      destinationChainId: ROBINHOOD_CHAIN_ID,
      destinationTokenSymbol: symbol,
      destinationTokenAddress,
      destinationTokenDecimals: args.destinationTokenDecimals,
      outputAmountBaseUnits,
      description: args.description?.trim() || undefined,
      expiresAt: args.expiresAt,
      status: "open",
      createdAt: now,
      updatedAt: now,
    });

    return { requestId, publicId: id };
  },
});

export const listMine = query({
  args: { creatorAddress: v.string() },
  handler: async (ctx, args) => {
    const creatorAddress = normalizeAddress(args.creatorAddress);
    return await ctx.db
      .query("paymentRequests")
      .withIndex("by_creator_address", (q) => q.eq("creatorAddress", creatorAddress))
      .order("desc")
      .collect();
  },
});

export const getByPublicId = query({
  args: { publicId: v.string() },
  handler: async (ctx, args) => {
    const request = await ctx.db
      .query("paymentRequests")
      .withIndex("by_publicId", (q) => q.eq("publicId", args.publicId))
      .unique();
    if (!request) return null;

    if (
      request.status === "open" &&
      request.expiresAt !== undefined &&
      request.expiresAt <= Date.now()
    ) {
      return { ...request, status: "expired" as const };
    }

    return request;
  },
});

export const getMineByPublicId = query({
  args: { creatorAddress: v.string(), publicId: v.string() },
  handler: async (ctx, args) => {
    const creatorAddress = normalizeAddress(args.creatorAddress);
    const request = await ctx.db
      .query("paymentRequests")
      .withIndex("by_publicId", (q) => q.eq("publicId", args.publicId))
      .unique();
    if (!request || request.creatorAddress !== creatorAddress) return null;
    return request;
  },
});

export const cancel = mutation({
  args: { creatorAddress: v.string(), publicId: v.string() },
  handler: async (ctx, args) => {
    const creatorAddress = normalizeAddress(args.creatorAddress);
    const request = await ctx.db
      .query("paymentRequests")
      .withIndex("by_publicId", (q) => q.eq("publicId", args.publicId))
      .unique();
    if (!request) throw new Error("Request not found");
    if (request.creatorAddress !== creatorAddress) throw new Error("Forbidden");
    if (request.status !== "open") {
      throw new Error(`Cannot cancel request in status ${request.status}`);
    }
    await ctx.db.patch(request._id, {
      status: "cancelled",
      updatedAt: Date.now(),
    });
    return { ok: true };
  },
});

export const expireDueRequests = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const open = await ctx.db
      .query("paymentRequests")
      .withIndex("by_status", (q) => q.eq("status", "open"))
      .collect();

    let expired = 0;
    const due = open.filter((req) => req.expiresAt !== undefined && req.expiresAt <= now);
    await Promise.all(
      due.map((req) => ctx.db.patch(req._id, { status: "expired", updatedAt: now })),
    );
    expired = due.length;
    return { expired };
  },
});

export const markPending = internalMutation({
  args: { requestId: v.id("paymentRequests") },
  handler: async (ctx, args) => {
    const request = await ctx.db.get(args.requestId);
    if (!request) throw new Error("Request not found");
    if (request.status === "completed" || request.status === "cancelled") {
      return { status: request.status };
    }
    if (request.expiresAt !== undefined && request.expiresAt <= Date.now()) {
      await ctx.db.patch(request._id, {
        status: "expired",
        updatedAt: Date.now(),
      });
      return { status: "expired" as const };
    }
    await ctx.db.patch(request._id, {
      status: "pending",
      updatedAt: Date.now(),
    });
    return { status: "pending" as const };
  },
});

export const reopenIfNeeded = internalMutation({
  args: { requestId: v.id("paymentRequests") },
  handler: async (ctx, args) => {
    const request = await ctx.db.get(args.requestId);
    if (!request) return;
    if (request.status !== "pending") return;
    if (request.expiresAt !== undefined && request.expiresAt <= Date.now()) {
      await ctx.db.patch(request._id, {
        status: "expired",
        updatedAt: Date.now(),
      });
      return;
    }
    await ctx.db.patch(request._id, {
      status: "open",
      updatedAt: Date.now(),
    });
  },
});

export const markCompleted = internalMutation({
  args: { requestId: v.id("paymentRequests") },
  handler: async (ctx, args) => {
    const request = await ctx.db.get(args.requestId);
    if (!request) throw new Error("Request not found");
    if (request.status === "completed") return { status: "completed" as const };
    if (request.status === "cancelled") {
      throw new Error("Cannot complete a cancelled request");
    }
    await ctx.db.patch(request._id, {
      status: "completed",
      updatedAt: Date.now(),
    });
    return { status: "completed" as const };
  },
});

export { ROBINHOOD_CHAIN_ID, ALLOWED_DEST_SYMBOLS };
