"use node";

import { action, internalAction } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

const ACROSS_API = "https://app.across.to/api";

type DepositStatusResponse = {
  status?: string;
  fillTxnRef?: string;
  destinationChainId?: number;
  originChainId?: number;
  depositTxnRef?: string;
  // Extra fields may appear depending on indexer version
  recipient?: string;
  outputToken?: string;
  outputAmount?: string;
  fillTx?: string;
  depositId?: string | number;
};

async function fetchDepositStatus(depositTxnRef: string): Promise<DepositStatusResponse> {
  const url = new URL(`${ACROSS_API}/deposit/status`);
  url.searchParams.set("depositTxnRef", depositTxnRef);
  const res = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Across deposit status failed (${res.status}): ${text}`);
  }
  return (await res.json()) as DepositStatusResponse;
}

export const syncDepositStatus = action({
  args: {
    depositTxnRef: v.string(),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{
    acrossStatus: string;
    fillTxnRef?: string;
    raw: DepositStatusResponse;
    requestStatus: string;
    attemptStatus: string;
  }> => {
    const depositTxnRef = args.depositTxnRef.toLowerCase();
    const status = await fetchDepositStatus(depositTxnRef);

    const acrossStatusRaw = (status.status ?? "pending").toLowerCase();
    let acrossStatus: "submitted" | "pending" | "filled" | "expired" | "refunded" | "failed" =
      "pending";

    if (acrossStatusRaw === "filled") acrossStatus = "filled";
    else if (acrossStatusRaw === "expired") acrossStatus = "expired";
    else if (acrossStatusRaw === "refunded") acrossStatus = "refunded";
    else if (acrossStatusRaw === "pending") acrossStatus = "pending";
    else acrossStatus = "pending";

    const fillTxnRef = status.fillTxnRef ?? status.fillTx;

    // Only pass fields actually returned by Across — never trust the client for fill proof.
    const result = (await ctx.runMutation(internal.paymentAttempts.applyAcrossStatus, {
      depositTxnRef,
      acrossStatus,
      fillTxnRef,
      destinationChainId: status.destinationChainId,
      outputToken: status.outputToken,
      recipient: status.recipient,
      outputAmount: status.outputAmount,
    })) as { requestStatus: string; attemptStatus: string };

    return {
      acrossStatus,
      fillTxnRef,
      raw: status,
      requestStatus: result.requestStatus,
      attemptStatus: result.attemptStatus,
    };
  },
});

export const pollPendingAttempts = internalAction({
  args: {},
  handler: async (ctx) => {
    // Cron helper: expire due requests first
    await ctx.runMutation(internal.paymentRequests.expireDueRequests, {});
  },
});
