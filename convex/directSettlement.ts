"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { createPublicClient, http, type Hex } from "viem";
import { matchTransferToPayment, parseTransferLogs } from "./lib/transferLog";

const USDG = "0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168";

const robinhood = {
  id: 4663,
  name: "Robinhood Chain",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.mainnet.chain.robinhood.com"] } },
} as const;

async function readTransfer(txHash: string) {
  const client = createPublicClient({
    chain: robinhood,
    transport: http(robinhood.rpcUrls.default.http[0]),
  });
  const receipt = await client.getTransactionReceipt({ hash: txHash as Hex });
  if (receipt.status !== "success") {
    throw new Error("USDG transfer reverted");
  }
  return parseTransferLogs(receipt.logs);
}

export const submitDirect = action({
  args: {
    publicId: v.string(),
    payerAddress: v.string(),
    depositTxnRef: v.string(),
  },
  returns: v.object({
    attemptId: v.optional(v.string()),
    duplicate: v.boolean(),
  }),
  handler: async (ctx, args): Promise<{ attemptId?: string; duplicate: boolean }> => {
    const request = await ctx.runQuery(internal.paymentRequests.getInternalByPublicId, {
      publicId: args.publicId,
    });
    if (!request) throw new Error("Payment request not found");
    if (request.destinationTokenAddress.toLowerCase() !== USDG) {
      throw new Error("Same-chain pay only settles USDG");
    }

    const depositTxnRef = args.depositTxnRef.toLowerCase();
    const transfers = await readTransfer(depositTxnRef);
    const matched = matchTransferToPayment(transfers, {
      token: request.destinationTokenAddress,
      recipient: request.recipientAddress,
      amount: request.outputAmountBaseUnits,
    });
    if (!matched.ok) {
      console.error("payment_deposit_rejected", {
        publicId: args.publicId,
        depositTxnRef,
        reason: matched.reason,
      });
      throw new Error(matched.reason);
    }

    const saved = await ctx.runMutation(internal.paymentAttempts.acceptVerifiedDeposit, {
      publicId: args.publicId,
      payerAddress: args.payerAddress,
      originChainId: 4663,
      inputToken: USDG,
      quotedInputAmount: matched.amount.toString(),
      expectedOutputAmount: request.outputAmountBaseUnits,
      minOutputAmount: request.outputAmountBaseUnits,
      feesJson: "{}",
      depositTxnRef,
      settlementKind: "direct",
    });
    if (saved.expired) throw new Error("Payment request is expired");

    await ctx.runMutation(internal.paymentAttempts.applyAcrossStatus, {
      depositTxnRef,
      acrossStatus: "filled",
      fillTxnRef: depositTxnRef,
      destinationChainId: 4663,
      outputToken: request.destinationTokenAddress,
      recipient: request.recipientAddress,
      outputAmount: matched.amount.toString(),
      transportError: false,
    });

    return { attemptId: saved.attemptId, duplicate: saved.duplicate };
  },
});
