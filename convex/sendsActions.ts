import { action, internalAction } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { fetchOperations, fetchTransaction } from "../lib/stellar/horizon";
import { matchSendPayments, parseUsdcPayments, type ExpectedSend } from "../lib/stellar/payments";
import { isReconciliationStuck } from "./lib/settlement";

/** A send's validity window has long closed by now, so a missing transaction will never land. */
const GIVE_UP_AFTER_MS = 60 * 60 * 1000;

async function verifySend(txHash: string, callsJson: string) {
  const transaction = await fetchTransaction(txHash);
  if (!transaction) return { pending: true as const };
  if (!transaction.successful) {
    return { pending: false as const, ok: false, reason: "The send failed on the Stellar network" };
  }
  const payments = parseUsdcPayments(await fetchOperations(transaction.hash));
  const matched = matchSendPayments(payments, JSON.parse(callsJson) as ExpectedSend[]);
  return matched.ok
    ? { pending: false as const, ok: true }
    : { pending: false as const, ok: false, reason: matched.reason };
}

export const confirm = action({
  args: { txHash: v.string() },
  returns: v.object({
    status: v.union(v.literal("submitted"), v.literal("filled"), v.literal("failed")),
    reason: v.optional(v.string()),
  }),
  handler: async (
    ctx,
    args,
  ): Promise<{ status: "submitted" | "filled" | "failed"; reason?: string }> => {
    const row = await ctx.runQuery(internal.sends.getOwned, { txHash: args.txHash });
    if (!row) throw new Error("Send was not recorded");
    try {
      const result = await verifySend(row.txHash, row.callsJson);
      if (result.pending) return { status: "submitted", reason: "Not on the network yet" };
      if (!result.ok) {
        await ctx.runMutation(internal.sends.markResult, {
          id: row.id,
          status: "failed",
          failureReason: result.reason,
        });
        return { status: "failed", reason: result.reason };
      }
      await ctx.runMutation(internal.sends.markResult, { id: row.id, status: "filled" });
      console.log("send_filled", { txHash: row.txHash });
      return { status: "filled" };
    } catch (error) {
      console.error("send_reconcile_pending", {
        txHash: row.txHash,
        message: error instanceof Error ? error.message : "Unknown error",
      });
      return { status: "submitted", reason: "The network isn't reachable yet" };
    }
  },
});

export const reconcile = internalAction({
  args: {},
  returns: v.object({ checked: v.number() }),
  handler: async (ctx) => {
    const rows = await ctx.runQuery(internal.sends.listSubmitted, { limit: 25 });
    let checked = 0;
    for (const row of rows) {
      checked += 1;
      try {
        // One at a time, to stay inside Horizon's rate limits.
        // react-doctor-disable-next-line react-doctor/async-await-in-loop
        const result = await verifySend(row.txHash, row.callsJson);
        if (result.pending) {
          if (Date.now() - row.createdAt > GIVE_UP_AFTER_MS) {
            // react-doctor-disable-next-line react-doctor/async-await-in-loop
            await ctx.runMutation(internal.sends.markResult, {
              id: row.id,
              status: "failed",
              failureReason: "The transaction never reached the network",
            });
          } else if (isReconciliationStuck(row.createdAt, Date.now())) {
            console.error("payment_reconciliation_stuck", { txHash: row.txHash });
          }
          continue;
        }
        // react-doctor-disable-next-line react-doctor/async-await-in-loop
        await ctx.runMutation(internal.sends.markResult, {
          id: row.id,
          status: result.ok ? "filled" : "failed",
          failureReason: result.ok ? undefined : result.reason,
        });
      } catch (error) {
        console.error("send_reconcile_pending", {
          txHash: row.txHash,
          message: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }
    return { checked };
  },
});
