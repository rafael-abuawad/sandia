import type { ReviewPayload } from "@/components/send-form/state";
import { usdMicrosToStroops } from "@/lib/stellar/amount";
import type { HorizonTransaction, StellarAccountState } from "@/lib/stellar/horizon";
import { assertSponsorable } from "@/lib/stellar/policy";
import { baseAccount, isMuxedAccount } from "@/lib/stellar/strkey";
import {
  buildUsdcPaymentTx,
  signWith,
  transactionHashHex,
  TX_TIMEOUT_SECONDS,
  type StellarSigner,
} from "@/lib/stellar/tx";

const PREFLIGHT_CONCURRENCY = 10;

export type SubmittedSendTransaction = {
  hash: string;
  stage: "transfer" | "activity";
  label: string;
  /** Unix seconds. After this, a transaction the network hasn't seen can never land. */
  expiresAt?: number;
};

export type SubmitResult =
  | { ok: true; hash: string }
  | { ok: false; message: string; indeterminate: boolean };

export type SendDependencies = {
  loadAccount: (address: string) => Promise<StellarAccountState>;
  lookupTransaction: (hash: string) => Promise<HorizonTransaction | null>;
  sign: StellarSigner;
  submit: (xdr: string) => Promise<SubmitResult>;
};

export type SendCall = { recipient: string; amount: bigint };

function shorten(address: string): string {
  return `${address.slice(0, 4)}…${address.slice(-4)}`;
}

/** Stellar rejects a payment to an account without a USDC trustline, so check before signing. */
export async function preflightRecipients(
  review: ReviewPayload,
  loadAccount: SendDependencies["loadAccount"],
): Promise<void> {
  const problems: string[] = [];
  const recipients = review.recipients.map((row) => row.address);
  for (let start = 0; start < recipients.length; start += PREFLIGHT_CONCURRENCY) {
    const chunk = recipients.slice(start, start + PREFLIGHT_CONCURRENCY);
    // Chunks stay sequential, so a 100-recipient batch doesn't trip Horizon's rate limit.
    // react-doctor-disable-next-line react-doctor/async-await-in-loop
    const states = await Promise.all(chunk.map((address) => loadAccount(baseAccount(address))));
    states.forEach((state, index) => {
      const address = chunk[index];
      if (!state.exists) {
        problems.push(`${shorten(address)} doesn't have a Stellar account yet.`);
      } else if (!state.hasUsdcTrustline) {
        problems.push(`${shorten(address)} hasn't enabled USDC on their account.`);
      } else if (state.memoRequired && !review.memo && !isMuxedAccount(address)) {
        problems.push(`${shorten(address)} requires a memo on incoming payments.`);
      }
    });
  }
  if (problems.length > 0) {
    const shown = problems.slice(0, 3).join(" ");
    const extra = problems.length > 3 ? ` ${problems.length - 3} more can't receive this.` : "";
    throw new Error(`${shown}${extra} Nothing was sent.`);
  }
}

export function callsForReview(review: ReviewPayload): SendCall[] {
  return review.recipients.map((row) => ({
    recipient: row.address,
    amount: usdMicrosToStroops(row.amountUsdMicros),
  }));
}

/** Thrown while the outcome is unknown. The controller keeps the transaction for a status check. */
export class SendPendingError extends Error {
  constructor(message = "The transaction is still pending.") {
    super(message);
    this.name = "SendPendingError";
  }
}

export async function executeSend({
  review,
  account,
  pending,
  deps,
  now = () => Math.floor(Date.now() / 1000),
  onAwaiting,
  onSubmitted,
  onCleared,
}: {
  review: ReviewPayload;
  account: string;
  pending: SubmittedSendTransaction | null;
  deps: SendDependencies;
  now?: () => number;
  onAwaiting: (label: string) => void;
  onSubmitted: (transaction: SubmittedSendTransaction) => void;
  onCleared: () => void;
}): Promise<{ hash: string; calls: SendCall[] }> {
  const calls = callsForReview(review);

  if (pending?.stage === "activity") {
    throw new Error(
      "This transfer is confirmed. Retry its activity update before starting another send.",
    );
  }

  if (pending) {
    const found = await deps.lookupTransaction(pending.hash);
    if (found) {
      if (found.successful) return { hash: found.hash, calls };
      onCleared();
      throw new Error("The send failed on the Stellar network. Review it and try again.");
    }
    if (pending.expiresAt !== undefined && now() <= pending.expiresAt) {
      throw new SendPendingError();
    }
    onCleared();
    throw new Error("This send expired before reaching the network. Your USDC was not sent.");
  }

  const source = await deps.loadAccount(account);
  if (!source.exists || !source.sequence || !source.hasUsdcTrustline) {
    throw new Error("Your wallet is still being set up. Try again in a moment.");
  }
  const total = usdMicrosToStroops(review.totalUsdMicros);
  if (source.usdcBalance < total) throw new Error("This wallet doesn't have enough USDC.");

  await preflightRecipients(review, deps.loadAccount);

  const tx = buildUsdcPaymentTx({
    source: account,
    sequence: source.sequence,
    memo: review.memo,
    payments: calls.map((call) => ({ destination: call.recipient, stroops: call.amount })),
  });
  assertSponsorable(tx, account);

  const label = calls.length > 1 ? "Confirm USDC batch send" : "Confirm USDC transfer";
  onAwaiting(label);
  const xdr = await signWith(tx, account, deps.sign);

  // Remember the hash first. If the response is lost, the status check can still find it.
  const hash = transactionHashHex(tx);
  onSubmitted({ hash, stage: "transfer", label, expiresAt: now() + TX_TIMEOUT_SECONDS });

  const result = await deps.submit(xdr);
  if (result.ok) return { hash: result.hash, calls };
  if (result.indeterminate) throw new SendPendingError();
  onCleared();
  throw new Error(result.message);
}
