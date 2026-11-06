import {
  Account,
  Asset,
  Memo,
  Operation,
  TransactionBuilder,
  type Transaction,
} from "@stellar/stellar-sdk";
import { stroopsToAmount } from "./amount";
import { STELLAR_NETWORK_PASSPHRASE, STELLAR_USDC } from "./constants";
import { isMemoId, memoError } from "./memo";

export const USDC_ASSET = new Asset(STELLAR_USDC.symbol, STELLAR_USDC.issuer);

/** Network minimum per operation. A sponsored fee-bump can raise the fee during surge pricing. */
const BASE_FEE = "100";
/** A signed transaction stops being valid after this, so a retry can never pay twice. */
export const TX_TIMEOUT_SECONDS = 120;

export type UsdcPaymentInput = { destination: string; stroops: bigint };

function toMemo(memo: string | undefined): Memo {
  if (!memo) return Memo.none();
  const problem = memoError(memo);
  if (problem) throw new Error(problem);
  return isMemoId(memo) ? Memo.id(memo) : Memo.text(memo);
}

/** Builds one all-or-nothing USDC transaction. Stellar batches need no contract or approval. */
export function buildUsdcPaymentTx(input: {
  source: string;
  sequence: string;
  payments: UsdcPaymentInput[];
  memo?: string;
  baseFee?: string;
}): Transaction {
  if (input.payments.length === 0) throw new Error("Add a recipient");
  const builder = new TransactionBuilder(new Account(input.source, input.sequence), {
    fee: input.baseFee ?? BASE_FEE,
    networkPassphrase: STELLAR_NETWORK_PASSPHRASE,
    memo: toMemo(input.memo),
  });
  for (const payment of input.payments) {
    builder.addOperation(
      Operation.payment({
        destination: payment.destination,
        asset: USDC_ASSET,
        amount: stroopsToAmount(payment.stroops),
      }),
    );
  }
  return builder.setTimeout(TX_TIMEOUT_SECONDS).build();
}

export function parseTransaction(xdr: string): Transaction {
  const parsed = TransactionBuilder.fromXDR(xdr, STELLAR_NETWORK_PASSPHRASE);
  if ("innerTransaction" in parsed) throw new Error("Unexpected fee-bump transaction");
  return parsed as Transaction;
}

export function transactionHashHex(tx: Transaction): string {
  return Array.from(tx.hash(), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function hexToBase64(hex: string): string {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  if (clean.length !== 128 || !/^[0-9a-fA-F]+$/.test(clean)) {
    throw new Error("The wallet returned an invalid signature.");
  }
  const bytes = Uint8Array.from(clean.match(/../g) ?? [], (pair) => parseInt(pair, 16));
  return btoa(String.fromCharCode(...bytes));
}

/** Adds a raw Ed25519 signature from Privy. The SDK checks it against the transaction hash. */
export function attachSignature(tx: Transaction, publicKey: string, signatureHex: string): string {
  tx.addSignature(publicKey, hexToBase64(signatureHex));
  return tx.toXDR();
}

export type StellarSigner = (hashHex: string) => Promise<string>;

/** Signs a parsed transaction with the embedded wallet and returns the signed envelope. */
export async function signWith(
  tx: Transaction,
  publicKey: string,
  signer: StellarSigner,
): Promise<string> {
  return attachSignature(tx, publicKey, await signer(transactionHashHex(tx)));
}
