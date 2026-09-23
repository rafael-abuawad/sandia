"use node";

import { action, internalAction } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { createPublicClient, http, type Hex } from "viem";
import { matchBatchTransfers, parseTransferLogs, type ExpectedSend } from "./lib/transferLog";
import { isReconciliationStuck } from "./lib/fillProof";

const USDG = "0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168";
const robinhood = {
  id: 4663,
  name: "Robinhood Chain",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.mainnet.chain.robinhood.com"] } },
} as const;

async function verifyBundle(bundleTxHash: string, callsJson: string) {
  const client = createPublicClient({
    chain: robinhood,
    transport: http(robinhood.rpcUrls.default.http[0]),
  });
  const receipt = await client.getTransactionReceipt({ hash: bundleTxHash as Hex });
  if (receipt.status !== "success") {
    return { ok: false as const, reason: "Bundle transaction reverted" };
  }
  const calls = JSON.parse(callsJson) as ExpectedSend[];
  return matchBatchTransfers(parseTransferLogs(receipt.logs), USDG, calls);
}

export const attachBundle = action({
  args: {
    userOpHash: v.string(),
    bundleTxHash: v.string(),
  },
  returns: v.object({
    status: v.union(v.literal("submitted"), v.literal("filled"), v.literal("failed")),
    reason: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const row = await ctx.runQuery(internal.outbound.getByUserOp, { userOpHash: args.userOpHash });
    if (!row) throw new Error("Send was not recorded");
    try {
      const result = await verifyBundle(args.bundleTxHash, row.callsJson);
      if (!result.ok) {
        await ctx.runMutation(internal.outbound.markResultInternal, {
          id: row.id,
          bundleTxHash: args.bundleTxHash.toLowerCase(),
          status: "failed",
          failureReason: result.reason,
        });
        return { status: "failed" as const, reason: result.reason };
      }
      await ctx.runMutation(internal.outbound.markResultInternal, {
        id: row.id,
        bundleTxHash: args.bundleTxHash.toLowerCase(),
        status: "filled",
      });
      console.log("outbound_filled", {
        userOpHash: args.userOpHash,
        bundleTxHash: args.bundleTxHash.toLowerCase(),
      });
      return { status: "filled" as const };
    } catch (error) {
      console.error("outbound_reconcile_pending", {
        userOpHash: args.userOpHash,
        message: error instanceof Error ? error.message : "Unknown error",
      });
      return { status: "submitted" as const, reason: "Receipt is not available yet" };
    }
  },
});

export const reconcile = internalAction({
  args: {},
  returns: v.object({ checked: v.number() }),
  handler: async (ctx) => {
    const rows = await ctx.runQuery(internal.outbound.listSubmitted, { limit: 25 });
    let checked = 0;
    for (const row of rows) {
      checked += 1;
      if (!row.bundleTxHash) {
        if (isReconciliationStuck(row.createdAt, Date.now())) {
          console.error("payment_reconciliation_stuck", {
            userOpHash: row.userOpHash,
            reason: "Send has no bundle transaction yet",
          });
        }
        continue;
      }
      try {
        const result = await verifyBundle(row.bundleTxHash, row.callsJson);
        await ctx.runMutation(internal.outbound.markResultInternal, {
          id: row.id,
          bundleTxHash: row.bundleTxHash,
          status: result.ok ? "filled" : "failed",
          failureReason: result.ok ? undefined : result.reason,
        });
      } catch (error) {
        console.error("outbound_reconcile_pending", {
          userOpHash: row.userOpHash,
          message: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }
    return { checked };
  },
});
