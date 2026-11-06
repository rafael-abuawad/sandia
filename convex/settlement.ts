import { action, internalAction } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { settlementStatus } from "./schema";
import { settlesAfter } from "./lib/settlement";
import { fetchOperations, fetchTransaction } from "../lib/stellar/horizon";
import { requestMemo } from "../lib/stellar/memo";
import { matchRequestPayment, parseUsdcPayments } from "../lib/stellar/payments";
import { isStellarAccount, isStellarRecipient } from "../lib/stellar/strkey";

const HASH = /^[0-9a-f]{64}$/;

/**
 * Settles a direct USDC payment after reading it back from Stellar. Stellar has no reorgs, so a
 * successful transaction is final. The memo binds the payment to this request.
 */
export const submitDirect = action({
  args: { publicId: v.string(), payerAddress: v.string(), txHash: v.string() },
  returns: v.object({ status: settlementStatus }),
  handler: async (ctx, args): Promise<{ status: typeof settlementStatus.type }> => {
    const txHash = args.txHash.toLowerCase();
    if (!HASH.test(txHash)) throw new Error("Invalid transaction hash");
    if (!isStellarAccount(args.payerAddress)) throw new Error("Invalid Stellar address");

    const request = await ctx.runQuery(internal.paymentRequests.getInternalByPublicId, {
      publicId: args.publicId,
    });
    if (!request) throw new Error("Payment request not found");
    if (!isStellarRecipient(request.recipientAddress)) {
      throw new Error("This request can no longer be paid.");
    }

    const transaction = await fetchTransaction(txHash);
    if (!transaction) throw new Error("The network hasn't confirmed this payment yet.");
    const reject = (reason: string) => {
      console.error("payment_deposit_rejected", { publicId: args.publicId, txHash, reason });
      return new Error(reason);
    };
    if (!transaction.successful) throw reject("This transaction failed on the Stellar network");
    if (transaction.memo !== requestMemo(args.publicId)) {
      throw reject("This transaction isn't a payment for this request");
    }
    if (!settlesAfter(transaction.created_at, request.createdAt)) {
      throw reject("This transaction is older than the request");
    }

    const matched = matchRequestPayment(parseUsdcPayments(await fetchOperations(txHash)), {
      recipient: request.recipientAddress,
      amount: request.outputAmountBaseUnits,
    });
    if (!matched.ok) throw reject(matched.reason);

    return await ctx.runMutation(internal.settlementAttempts.settleDirect, {
      publicId: args.publicId,
      payerAddress: args.payerAddress,
      txHash: transaction.hash,
      amountBaseUnits: matched.amount.toString(),
    });
  },
});

/** Runs every minute: expires requests, then follows cross-chain deposits and unconfirmed sends. */
export const reconcile = internalAction({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    await ctx.runMutation(internal.paymentRequests.expireDueRequests, {});
    await ctx.runAction(internal.nearIntents.reconcile, {});
    await ctx.runAction(internal.sendsActions.reconcile, {});
    return null;
  },
});
