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

function parseStoredTxHashes(raw: string | undefined): string[] {
  if (!raw) return [];
  const trimmed = raw.trim();
  if (trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      if (Array.isArray(parsed)) {
        return parsed.filter(
          (item): item is string => typeof item === "string" && item.startsWith("0x"),
        );
      }
    } catch {
      // fall through to a single hash
    }
  }
  if (trimmed.startsWith("0x")) return [trimmed];
  return [];
}

async function verifyTransfers(txHashes: string[], callsJson: string) {
  if (txHashes.length === 0) {
    return { ok: false as const, reason: "Send has no transaction hash" };
  }
  const client = createPublicClient({
    chain: robinhood,
    transport: http(robinhood.rpcUrls.default.http[0]),
  });
  const transfers = [];
  for (const hash of txHashes) {
    const receipt = await client.getTransactionReceipt({ hash: hash as Hex });
    if (receipt.status !== "success") {
      return { ok: false as const, reason: "A transfer transaction reverted" };
    }
    transfers.push(...parseTransferLogs(receipt.logs));
  }
  const calls = JSON.parse(callsJson) as ExpectedSend[];
  return matchBatchTransfers(transfers, USDG, calls);
}

export const attachBundle = action({
  args: {
    userOpHash: v.string(),
    txHashes: v.array(v.string()),
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
    const txHashes = args.txHashes
      .map((hash) => hash.toLowerCase())
      .filter((hash) => hash.startsWith("0x"));
    const stored = JSON.stringify(txHashes);
    try {
      const result = await verifyTransfers(txHashes, row.callsJson);
      if (!result.ok) {
        await ctx.runMutation(internal.outbound.markResultInternal, {
          id: row.id,
          bundleTxHash: stored,
          status: "failed",
          failureReason: result.reason,
        });
        return { status: "failed" as const, reason: result.reason };
      }
      await ctx.runMutation(internal.outbound.markResultInternal, {
        id: row.id,
        bundleTxHash: stored,
        status: "filled",
      });
      console.log("outbound_filled", {
        userOpHash: args.userOpHash,
        txHashes,
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
      const txHashes = parseStoredTxHashes(row.bundleTxHash);
      if (txHashes.length === 0) {
        if (isReconciliationStuck(row.createdAt, Date.now())) {
          console.error("payment_reconciliation_stuck", {
            userOpHash: row.userOpHash,
            reason: "Send has no transfer transaction yet",
          });
        }
        continue;
      }
      try {
        const result = await verifyTransfers(txHashes, row.callsJson);
        await ctx.runMutation(internal.outbound.markResultInternal, {
          id: row.id,
          bundleTxHash: JSON.stringify(txHashes),
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
