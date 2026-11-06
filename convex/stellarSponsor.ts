"use node";

import { Account, Keypair, Operation, TransactionBuilder } from "@stellar/stellar-sdk";
import { action, type ActionCtx } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { STELLAR_NETWORK_PASSPHRASE } from "../lib/stellar/constants";
import { fetchAccountState, StellarSubmitError, submitEnvelope } from "../lib/stellar/horizon";
import { assertActivationTx, assertSignedBySource, assertSponsorable } from "../lib/stellar/policy";
import {
  parseTransaction,
  TX_TIMEOUT_SECONDS,
  transactionHashHex,
  USDC_ASSET,
} from "../lib/stellar/tx";

/** Fee-bump bid per operation. The network charges market rate, up to this cap. */
const SPONSOR_BASE_FEE = "10000";

function sponsorKeypair(): Keypair {
  const secret = process.env.STELLAR_SPONSOR_SECRET;
  if (!secret) throw new Error("Fee sponsorship isn't configured.");
  return Keypair.fromSecret(secret);
}

async function requireUser(ctx: ActionCtx): Promise<{ userId: Id<"users">; address: string }> {
  const user = await ctx.runQuery(internal.users.currentForAction, {});
  if (!user) throw new Error("Sign in to continue.");
  return user;
}

async function consumeAllowance(ctx: ActionCtx, userId: Id<"users">) {
  const allowed = await ctx.runMutation(internal.sponsorUsage.consume, { userId });
  if (!allowed) throw new Error("Too many transactions this hour. Try again later.");
}

const submitResult = v.union(
  v.object({ ok: v.literal(true), hash: v.string() }),
  v.object({ ok: v.literal(false), message: v.string(), indeterminate: v.boolean() }),
);
type SubmitResult =
  | { ok: true; hash: string }
  | { ok: false; message: string; indeterminate: boolean };

/**
 * Returned rather than thrown: production Convex redacts thrown messages, and the browser must
 * tell "rejected, safe to retry" apart from "unknown, might still land".
 */
async function submit(xdr: string): Promise<SubmitResult> {
  try {
    return { ok: true, hash: await submitEnvelope(xdr) };
  } catch (error) {
    if (error instanceof StellarSubmitError) {
      console.error("stellar_submit_failed", { codes: error.codes, message: error.message });
      return { ok: false, message: error.message, indeterminate: error.indeterminate };
    }
    throw error;
  }
}

/**
 * Prepares account setup. The sponsor pays the reserves for the account and its USDC trustline,
 * so a new Sandia user holds no XLM. Reserves stay locked on the sponsor's account.
 */
export const prepareActivation = action({
  args: {},
  returns: v.union(
    v.object({ status: v.literal("active") }),
    v.object({ status: v.literal("needs_signature"), xdr: v.string(), hash: v.string() }),
  ),
  handler: async (
    ctx,
  ): Promise<{ status: "active" } | { status: "needs_signature"; xdr: string; hash: string }> => {
    const { address } = await requireUser(ctx);
    const state = await fetchAccountState(address);
    if (state.exists && state.hasUsdcTrustline) return { status: "active" };

    const sponsor = sponsorKeypair();
    const sponsorState = await fetchAccountState(sponsor.publicKey());
    if (!sponsorState.sequence) throw new Error("Fee sponsorship isn't available right now.");

    const builder = new TransactionBuilder(
      new Account(sponsor.publicKey(), sponsorState.sequence),
      {
        fee: SPONSOR_BASE_FEE,
        networkPassphrase: STELLAR_NETWORK_PASSPHRASE,
      },
    ).addOperation(Operation.beginSponsoringFutureReserves({ sponsoredId: address }));
    if (!state.exists) {
      builder.addOperation(Operation.createAccount({ destination: address, startingBalance: "0" }));
    }
    const tx = builder
      .addOperation(Operation.changeTrust({ asset: USDC_ASSET, source: address }))
      .addOperation(Operation.endSponsoringFutureReserves({ source: address }))
      .setTimeout(TX_TIMEOUT_SECONDS)
      .build();
    tx.sign(sponsor);
    return { status: "needs_signature", xdr: tx.toXDR(), hash: transactionHashHex(tx) };
  },
});

export const submitActivation = action({
  args: { xdr: v.string() },
  returns: submitResult,
  handler: async (ctx, args): Promise<SubmitResult> => {
    const { userId, address } = await requireUser(ctx);
    const sponsor = sponsorKeypair();
    const tx = parseTransaction(args.xdr);
    assertActivationTx(tx, address, sponsor.publicKey());
    assertSignedBySource(tx, sponsor.publicKey());
    assertSignedBySource(tx, address);
    await consumeAllowance(ctx, userId);
    const result = await submit(args.xdr);
    if (result.ok) console.log("stellar_account_activated", { userId, address, hash: result.hash });
    return result;
  },
});

/** Pays the fee for a USDC payment the user already signed. */
export const submitSponsored = action({
  args: { xdr: v.string() },
  returns: submitResult,
  handler: async (ctx, args): Promise<SubmitResult> => {
    const { userId, address } = await requireUser(ctx);
    const inner = parseTransaction(args.xdr);
    assertSponsorable(inner, address);
    assertSignedBySource(inner, address);
    await consumeAllowance(ctx, userId);

    const sponsor = sponsorKeypair();
    const bump = TransactionBuilder.buildFeeBumpTransaction(
      sponsor,
      SPONSOR_BASE_FEE,
      inner,
      STELLAR_NETWORK_PASSPHRASE,
    );
    bump.sign(sponsor);
    const result = await submit(bump.toXDR());
    if (result.ok) console.log("stellar_tx_sponsored", { userId, hash: result.hash });
    return result;
  },
});
