import { mutation, query, internalMutation, internalQuery } from "./_generated/server";
import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { getCurrentUser, getCurrentUserOrNull, payoutAddress } from "./lib/auth";
import { paymentRequestStatus } from "./schema";

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

export const create = mutation({
  args: {
    amountUsdMicros: v.number(),
    destinationTokenSymbol: v.string(),
    destinationTokenAddress: v.string(),
    destinationTokenDecimals: v.number(),
    description: v.optional(v.string()),
    expiresAt: v.optional(v.number()),
  },
  returns: v.object({
    requestId: v.id("paymentRequests"),
    publicId: v.string(),
  }),
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    const creatorAddress = normalizeAddress(user.address);
    const recipientAddress = normalizeAddress(payoutAddress(user));

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

    console.log("Created payment request", {
      publicId: id,
      creatorAddress,
      userId: user._id,
    });

    return { requestId, publicId: id };
  },
});

const paymentRequestValidator = v.object({
  _id: v.id("paymentRequests"),
  _creationTime: v.number(),
  publicId: v.string(),
  creatorId: v.id("users"),
  creatorAddress: v.string(),
  amountUsdMicros: v.number(),
  recipientAddress: v.string(),
  destinationChainId: v.number(),
  destinationTokenSymbol: v.string(),
  destinationTokenAddress: v.string(),
  destinationTokenDecimals: v.number(),
  outputAmountBaseUnits: v.string(),
  description: v.optional(v.string()),
  expiresAt: v.optional(v.number()),
  status: paymentRequestStatus,
  createdAt: v.number(),
  updatedAt: v.number(),
});

export const listMine = query({
  args: { paginationOpts: paginationOptsValidator },
  returns: v.object({
    page: v.array(paymentRequestValidator),
    isDone: v.boolean(),
    continueCursor: v.string(),
    splitCursor: v.optional(v.union(v.string(), v.null())),
    pageStatus: v.optional(v.union(v.string(), v.null())),
  }),
  handler: async (ctx, args) => {
    const user = await getCurrentUserOrNull(ctx);
    if (!user) {
      return {
        page: [],
        isDone: true,
        continueCursor: "",
        splitCursor: null,
        pageStatus: null,
      };
    }
    return await ctx.db
      .query("paymentRequests")
      .withIndex("by_creator", (q) => q.eq("creatorId", user._id))
      .order("desc")
      .paginate(args.paginationOpts);
  },
});

export const getByPublicId = query({
  args: { publicId: v.string() },
  returns: v.union(paymentRequestValidator, v.null()),
  handler: async (ctx, args) => {
    // Expiry is written by the cron. This query stays deterministic.
    return await ctx.db
      .query("paymentRequests")
      .withIndex("by_publicId", (q) => q.eq("publicId", args.publicId))
      .unique();
  },
});

export const getInternalByPublicId = internalQuery({
  args: { publicId: v.string() },
  returns: v.union(paymentRequestValidator, v.null()),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("paymentRequests")
      .withIndex("by_publicId", (q) => q.eq("publicId", args.publicId))
      .unique();
  },
});

export const getMineByPublicId = query({
  args: { publicId: v.string() },
  returns: v.union(paymentRequestValidator, v.null()),
  handler: async (ctx, args) => {
    const user = await getCurrentUserOrNull(ctx);
    if (!user) return null;
    const request = await ctx.db
      .query("paymentRequests")
      .withIndex("by_publicId", (q) => q.eq("publicId", args.publicId))
      .unique();
    if (!request || request.creatorId !== user._id) return null;
    return request;
  },
});

export const cancel = mutation({
  args: { publicId: v.string() },
  returns: v.object({ ok: v.literal(true) }),
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    const request = await ctx.db
      .query("paymentRequests")
      .withIndex("by_publicId", (q) => q.eq("publicId", args.publicId))
      .unique();
    if (!request) throw new Error("Request not found");
    if (request.creatorId !== user._id) throw new Error("Forbidden");
    if (request.status !== "open") {
      throw new Error(`Cannot cancel request in status ${request.status}`);
    }
    await ctx.db.patch(request._id, {
      status: "cancelled",
      updatedAt: Date.now(),
    });
    console.log("Cancelled payment request", { publicId: args.publicId, userId: user._id });
    return { ok: true as const };
  },
});

export const expireDueRequests = internalMutation({
  args: {},
  returns: v.object({ expired: v.number() }),
  handler: async (ctx) => {
    const now = Date.now();
    // Missing expiresAt sorts before every number, so lte(now) alone would expire open-ended requests.
    const due = await ctx.db
      .query("paymentRequests")
      .withIndex("by_status_and_expiresAt", (q) =>
        q.eq("status", "open").gt("expiresAt", 0).lte("expiresAt", now),
      )
      .take(100);
    const expired = due.filter((req) => req.expiresAt !== undefined && req.expiresAt <= now);

    await Promise.all(
      expired.map((req) => ctx.db.patch(req._id, { status: "expired", updatedAt: now })),
    );
    if (expired.length > 0) {
      console.log("payment_requests_expired", { count: expired.length });
    }
    return { expired: expired.length };
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
