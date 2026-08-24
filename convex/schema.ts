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
);

export default defineSchema({
  users: defineTable({
    privyDid: v.optional(v.string()),
    address: v.string(),
    email: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_address", ["address"])
    .index("by_privyDid", ["privyDid"]),

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
    .index("by_status", ["status"]),

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
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_request", ["requestId"])
    .index("by_depositTxnRef", ["depositTxnRef"]),

  contacts: defineTable({
    userId: v.id("users"),
    name: v.string(),
    address: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_and_address", ["userId", "address"]),
});
