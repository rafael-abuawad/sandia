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

export const settlementStatus = v.union(
  v.literal("awaiting_deposit"),
  v.literal("processing"),
  v.literal("settled"),
  v.literal("expired"),
  v.literal("refunded"),
  v.literal("failed"),
  v.literal("ignored_duplicate"),
);

export const settlementKind = v.union(v.literal("direct"), v.literal("near_intents"));

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
    // Legacy account-abstraction fields. Rows written before the Stellar cutover may carry them.
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
    // Legacy. Requests from before the Stellar cutover carry a chain id, and are no longer payable.
    destinationChainId: v.optional(v.number()),
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

  settlementAttempts: defineTable({
    requestId: v.id("paymentRequests"),
    kind: settlementKind,
    status: settlementStatus,
    /** The Stellar transaction that paid the recipient. Unique, so a payment settles once. */
    txHash: v.optional(v.string()),
    payerAddress: v.optional(v.string()),
    amountBaseUnits: v.string(),
    // NEAR Intents deposit details.
    originAsset: v.optional(v.string()),
    originSymbol: v.optional(v.string()),
    originChain: v.optional(v.string()),
    originDecimals: v.optional(v.number()),
    depositAddress: v.optional(v.string()),
    depositMemo: v.optional(v.string()),
    amountIn: v.optional(v.string()),
    minAmountIn: v.optional(v.string()),
    refundTo: v.optional(v.string()),
    deadline: v.optional(v.number()),
    timeEstimate: v.optional(v.number()),
    correlationId: v.optional(v.string()),
    quoteSignature: v.optional(v.string()),
    failureReason: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_request", ["requestId"])
    .index("by_txHash", ["txHash"])
    .index("by_status", ["status"])
    .index("by_depositAddress", ["depositAddress"]),

  contacts: defineTable({
    userId: v.id("users"),
    name: v.string(),
    address: v.string(),
    /** Memo some recipients, such as exchanges, require on incoming payments. */
    memo: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_and_address", ["userId", "address"]),

  sends: defineTable({
    userId: v.id("users"),
    txHash: v.string(),
    callsJson: v.string(),
    memo: v.optional(v.string()),
    status: activityStatus,
    failureReason: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_status", ["status"])
    .index("by_txHash", ["txHash"]),

  /** Hourly count of transactions the Sandia sponsor paid for, per user. */
  sponsorUsage: defineTable({
    userId: v.id("users"),
    windowStart: v.number(),
    count: v.number(),
  }).index("by_user_and_window", ["userId", "windowStart"]),
});
