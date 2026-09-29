"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { createPublicClient, getAddress, http, type Hex } from "viem";
import { matchVaultReceipt } from "../lib/vault-receipt";

const robinhood = {
  id: 4663,
  name: "Robinhood Chain",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.mainnet.chain.robinhood.com"] } },
} as const;

export const confirm = action({
  args: { id: v.id("vaultActivities") },
  returns: v.object({
    status: v.union(v.literal("submitted"), v.literal("filled"), v.literal("failed")),
    reason: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const row = await ctx.runQuery(internal.vaultActivity.getOwned, { id: args.id });
    if (!row) throw new Error("Vault action was not recorded");
    if (row.status === "filled") return { status: "filled" as const };

    try {
      const client = createPublicClient({
        chain: robinhood,
        transport: http(robinhood.rpcUrls.default.http[0]),
      });
      const receipt = await client.getTransactionReceipt({ hash: row.userOpHash as Hex });
      if (receipt.status !== "success") {
        const reason = "The vault transaction reverted";
        await ctx.runMutation(internal.vaultActivity.markResult, {
          id: row.id,
          status: "failed",
          failureReason: reason,
        });
        return { status: "failed" as const, reason };
      }

      const matched = matchVaultReceipt(receipt.logs, {
        kind: row.kind,
        account: getAddress(row.account),
        assets: BigInt(row.assets),
        shares: row.shares === undefined ? undefined : BigInt(row.shares),
      });
      if (!matched.ok) {
        await ctx.runMutation(internal.vaultActivity.markResult, {
          id: row.id,
          status: "failed",
          failureReason: matched.reason,
        });
        console.error("vault_activity_receipt_rejected", { id: row.id, reason: matched.reason });
        return { status: "failed" as const, reason: matched.reason };
      }

      await ctx.runMutation(internal.vaultActivity.markResult, {
        id: row.id,
        status: "filled",
        assets: matched.assets.toString(),
        shares: matched.shares.toString(),
      });
      console.log("vault_activity_filled", {
        id: row.id,
        kind: row.kind,
        userOpHash: row.userOpHash,
        assets: matched.assets.toString(),
        shares: matched.shares.toString(),
      });
      return { status: "filled" as const };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      console.error("vault_activity_receipt_pending", { id: row.id, message });
      return { status: "submitted" as const, reason: "Receipt is not available yet" };
    }
  },
});
