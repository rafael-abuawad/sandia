import { Asset, Keypair, type Transaction } from "@stellar/stellar-sdk";
import { amountToStroops } from "./amount";
import { MAX_SEND_RECIPIENTS, STELLAR_USDC } from "./constants";
import { isStellarRecipient } from "./strkey";

/**
 * What Sandia's sponsor key will pay fees for, and what the embedded wallet will sign.
 * The browser and Convex both run these checks. Everything else is rejected, so a compromised
 * client can't spend the sponsor's XLM on arbitrary transactions.
 */

/** Upper bound for a sponsored transaction's fee: 100 payments at 10,000 stroops each, 0.1 XLM. */
const MAX_SPONSORED_FEE_STROOPS = 1_000_000n;
const MAX_VALIDITY_SECONDS = 300;

function isUsdc(asset: Asset): boolean {
  return asset.getCode() === STELLAR_USDC.symbol && asset.getIssuer() === STELLAR_USDC.issuer;
}

function assertNoForeignSource(tx: Transaction, source: string) {
  for (const operation of tx.operations) {
    if (operation.source && operation.source !== source) {
      throw new Error("Every operation must come from this wallet.");
    }
  }
}

function assertValidityWindow(tx: Transaction, now: number) {
  const maxTime = Number(tx.timeBounds?.maxTime ?? 0);
  if (!maxTime || maxTime > now + MAX_VALIDITY_SECONDS) {
    throw new Error("This transaction must expire within five minutes.");
  }
}

function assertUsdcPayments(tx: Transaction) {
  if (tx.operations.length === 0 || tx.operations.length > MAX_SEND_RECIPIENTS) {
    throw new Error(`A send can include at most ${MAX_SEND_RECIPIENTS} recipients.`);
  }
  for (const operation of tx.operations) {
    if (operation.type !== "payment") throw new Error("Only USDC payments can be sponsored.");
    if (!isUsdc(operation.asset)) throw new Error("Only USDC payments can be sponsored.");
    if (!isStellarRecipient(operation.destination)) throw new Error("Invalid recipient.");
    if (amountToStroops(operation.amount) <= 0n) throw new Error("Invalid amount.");
  }
}

/** Throws unless the transaction is one Sandia may sign and sponsor for `source`. */
export function assertSponsorable(
  tx: Transaction,
  source: string,
  now = Math.floor(Date.now() / 1000),
): void {
  if (tx.source !== source) throw new Error("This transaction isn't from your wallet.");
  if (BigInt(tx.fee) > MAX_SPONSORED_FEE_STROOPS) throw new Error("This fee is too high.");
  assertNoForeignSource(tx, source);
  assertValidityWindow(tx, now);
  assertUsdcPayments(tx);
}

/** Each named account must really have signed, or the network rejects it after we've done the work. */
export function assertSignedBySource(tx: Transaction, source: string) {
  const keypair = Keypair.fromPublicKey(source);
  const hash = tx.hash();
  const signed = tx.signatures.some((signature) => keypair.verify(hash, signature.signature.value));
  if (!signed) throw new Error("This transaction isn't signed by your wallet.");
}

/**
 * Account setup: the sponsor pays reserves for the user's account and USDC trustline.
 * Shape: begin sponsoring, optional zero-balance create, USDC trustline, end sponsoring.
 */
export function assertActivationTx(tx: Transaction, user: string, sponsor?: string) {
  const expectedSponsor = sponsor ?? tx.source;
  if (tx.source !== expectedSponsor || tx.source === user) {
    throw new Error("This setup transaction isn't from the Sandia sponsor.");
  }
  assertValidityWindow(tx, Math.floor(Date.now() / 1000));
  const ops = tx.operations;
  const create = ops.length === 4;
  if (ops.length !== 3 && !create) throw new Error("Unexpected setup transaction.");

  const begin = ops[0];
  if (
    begin.type !== "beginSponsoringFutureReserves" ||
    begin.sponsoredId !== user ||
    (begin.source && begin.source !== expectedSponsor)
  ) {
    throw new Error("Unexpected setup transaction.");
  }
  if (create) {
    const account = ops[1];
    if (
      account.type !== "createAccount" ||
      account.destination !== user ||
      amountToStroops(account.startingBalance) !== 0n
    ) {
      throw new Error("Unexpected setup transaction.");
    }
  }
  const trust = ops[create ? 2 : 1];
  if (
    trust.type !== "changeTrust" ||
    trust.source !== user ||
    !(trust.line instanceof Asset) ||
    !isUsdc(trust.line)
  ) {
    throw new Error("Unexpected setup transaction.");
  }
  const end = ops[create ? 3 : 2];
  if (end.type !== "endSponsoringFutureReserves" || end.source !== user) {
    throw new Error("Unexpected setup transaction.");
  }
}
