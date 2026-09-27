import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export const paymentRequestStatus = v.union(
  v.literal("open"),
  v.literal("pending"),
  v.literal("completed"),
  v.literal("expired"),
  v.literal("cancelled"),
  v.literal("failed"),
);

export const acrossAttemptStatus = v.union(
  v.literal("submitted"),
  v.literal("pending"),
  v.literal("filled"),
  v.literal("expired"),
  v.literal("refunded"),
  v.literal("failed"),
  v.literal("ignored_duplicate"),
);

export const settlementKind = v.union(v.literal("across"), v.literal("direct"));

export const activityStatus = v.union(
  v.literal("submitted"),
  v.literal("filled"),
  v.literal("failed"),
);

export default defineSchema({
  users: defineTable({
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
  })
    .index("by_address", ["address"])
    .index("by_privyDid", ["privyDid"])
    .index("by_auth", ["authIssuer", "authSubject"])
    .index("by_smartAccount", ["smartAccountAddress"]),

  paymentRequests: defineTable({
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
  })
    .index("by_publicId", ["publicId"])
    .index("by_creator", ["creatorId"])
    .index("by_creator_address", ["creatorAddress"])
    .index("by_status", ["status"])
    .index("by_status_and_expiresAt", ["status", "expiresAt"]),

  paymentAttempts: defineTable({
    requestId: v.id("paymentRequests"),
    payerAddress: v.string(),
    originChainId: v.number(),
    inputToken: v.string(),
    quotedInputAmount: v.string(),
    expectedOutputAmount: v.string(),
    minOutputAmount: v.string(),
    feesJson: v.string(),
    quoteId: v.optional(v.string()),
    depositTxnRef: v.optional(v.string()),
    fillTxnRef: v.optional(v.string()),
    acrossStatus: acrossAttemptStatus,
    settlementKind: v.optional(settlementKind),
    failureReason: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_request", ["requestId"])
    .index("by_depositTxnRef", ["depositTxnRef"])
    .index("by_acrossStatus", ["acrossStatus"]),

  contacts: defineTable({
    userId: v.id("users"),
    name: v.string(),
    address: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_and_address", ["userId", "address"]),

  outboundTransfers: defineTable({
    userId: v.id("users"),
    userOpHash: v.string(),
    bundleTxHash: v.optional(v.string()),
    callsJson: v.string(),
    status: activityStatus,
    failureReason: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_status", ["status"])
    .index("by_userOpHash", ["userOpHash"]),

  swapFills: defineTable({
    userId: v.id("users"),
    symbol: v.string(),
    sellToken: v.string(),
    buyToken: v.string(),
    sellAmount: v.string(),
    buyAmount: v.optional(v.string()),
    minBuyAmount: v.optional(v.string()),
    userOpHash: v.optional(v.string()),
    status: activityStatus,
    failureReason: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_user", ["userId"]),

  vaultActivities: defineTable({
    userId: v.id("users"),
    vaultAddress: v.string(),
    kind: v.union(v.literal("deposit"), v.literal("withdraw"), v.literal("redeem")),
    assets: v.string(),
    shares: v.optional(v.string()),
    userOpHash: v.optional(v.string()),
    status: activityStatus,
    failureReason: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_userOpHash", ["userOpHash"]),
});
