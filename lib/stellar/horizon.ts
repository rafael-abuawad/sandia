import { amountToStroops } from "./amount";
import { HORIZON_URL, STELLAR_USDC } from "./constants";
import { baseAccount } from "./strkey";

const FETCH_TIMEOUT_MS = 15_000;
const SUBMIT_TIMEOUT_MS = 65_000;

export type StellarAccountState = {
  exists: boolean;
  hasUsdcTrustline: boolean;
  /** Spendable USDC stroops, net of open-order liabilities. */
  usdcBalance: bigint;
  /** Whether the account requires a memo on incoming payments (SEP-29). */
  memoRequired: boolean;
  sequence: string | null;
};

type HorizonBalance = {
  asset_type: string;
  asset_code?: string;
  asset_issuer?: string;
  balance: string;
  selling_liabilities?: string;
  is_authorized?: boolean;
};

export const MEMO_REQUIRED_DATA_VALUE = "MQ==";

export function parseAccountState(record: {
  sequence?: string;
  balances?: HorizonBalance[];
  data?: Record<string, string>;
}): StellarAccountState {
  const usdc = record.balances?.find(
    (balance) =>
      balance.asset_code === STELLAR_USDC.symbol && balance.asset_issuer === STELLAR_USDC.issuer,
  );
  const liabilities = usdc?.selling_liabilities ? amountToStroops(usdc.selling_liabilities) : 0n;
  const balance = usdc ? amountToStroops(usdc.balance) - liabilities : 0n;
  return {
    exists: true,
    hasUsdcTrustline: Boolean(usdc) && usdc?.is_authorized !== false,
    usdcBalance: balance > 0n ? balance : 0n,
    memoRequired: record.data?.["config.memo_required"] === MEMO_REQUIRED_DATA_VALUE,
    sequence: record.sequence ?? null,
  };
}

const MISSING_ACCOUNT: StellarAccountState = {
  exists: false,
  hasUsdcTrustline: false,
  usdcBalance: 0n,
  memoRequired: false,
  sequence: null,
};

export async function fetchAccountState(address: string): Promise<StellarAccountState> {
  const response = await fetch(`${HORIZON_URL}/accounts/${baseAccount(address)}`, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (response.status === 404) return MISSING_ACCOUNT;
  if (!response.ok) throw new Error(`Stellar network returned ${response.status}`);
  return parseAccountState((await response.json()) as Parameters<typeof parseAccountState>[0]);
}

export type HorizonTransaction = {
  hash: string;
  successful: boolean;
  created_at: string;
  source_account: string;
  memo_type?: string;
  memo?: string;
};

/** `null` means the network has not seen this hash. Inner and fee-bump hashes both resolve. */
export async function fetchTransaction(hash: string): Promise<HorizonTransaction | null> {
  const response = await fetch(`${HORIZON_URL}/transactions/${hash}`, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Stellar network returned ${response.status}`);
  return (await response.json()) as HorizonTransaction;
}

export type HorizonOperation = {
  type: string;
  transaction_successful?: boolean;
  to?: string;
  to_muxed?: string;
  asset_code?: string;
  asset_issuer?: string;
  amount?: string;
};

export async function fetchOperations(hash: string): Promise<HorizonOperation[]> {
  const response = await fetch(`${HORIZON_URL}/transactions/${hash}/operations?limit=200`, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`Stellar network returned ${response.status}`);
  const body = (await response.json()) as { _embedded?: { records?: HorizonOperation[] } };
  return body._embedded?.records ?? [];
}

const RESULT_MESSAGES: Record<string, string> = {
  tx_bad_seq: "Another transaction from this wallet went first. Try again.",
  tx_too_late: "This transaction expired before it was submitted. Try again.",
  tx_too_early: "This transaction isn't valid yet. Try again.",
  tx_bad_auth: "This transaction's signature was rejected.",
  tx_insufficient_balance: "This wallet doesn't have enough XLM for the network fee.",
  tx_insufficient_fee: "The Stellar network is busy. Try again in a moment.",
  op_underfunded: "This wallet doesn't have enough USDC.",
  op_src_no_trust: "This wallet can't hold USDC yet.",
  op_no_trust: "A recipient hasn't enabled USDC on their Stellar account.",
  op_no_destination: "A recipient's Stellar account doesn't exist yet.",
  op_not_authorized: "USDC is restricted on one of these accounts.",
  op_line_full: "A recipient's USDC trustline limit is too low.",
};

export class StellarSubmitError extends Error {
  /** True when the outcome is unknown, so the same transaction might still land. */
  readonly indeterminate: boolean;
  readonly codes: string[];

  constructor(message: string, codes: string[] = [], indeterminate = false) {
    super(message);
    this.name = "StellarSubmitError";
    this.codes = codes;
    this.indeterminate = indeterminate;
  }
}

type ResultCodes = { transaction?: string; inner_transaction?: string; operations?: string[] };

/** A fee-bump reports its inner failure separately, so all three levels are read. */
export function submitErrorFromResult(extras: { result_codes?: ResultCodes }): StellarSubmitError {
  const { transaction, inner_transaction: inner, operations = [] } = extras.result_codes ?? {};
  const codes = [transaction, inner, ...operations].filter((code): code is string => Boolean(code));
  const known = codes.find((code) => RESULT_MESSAGES[code]);
  return new StellarSubmitError(
    known ? RESULT_MESSAGES[known] : "The Stellar network rejected this transaction.",
    codes,
  );
}

/** Submits an envelope to Horizon, which waits for the ledger result. Returns the transaction hash. */
export async function submitEnvelope(xdr: string): Promise<string> {
  let response: Response;
  try {
    response = await fetch(`${HORIZON_URL}/transactions`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ tx: xdr }).toString(),
      signal: AbortSignal.timeout(SUBMIT_TIMEOUT_MS),
    });
  } catch {
    throw new StellarSubmitError("The Stellar network didn't respond in time.", [], true);
  }
  const body = (await response.json().catch(() => ({}))) as {
    hash?: string;
    extras?: { result_codes?: ResultCodes };
  };
  if (response.ok && body.hash) return body.hash;
  if (response.status === 504 || response.status >= 500) {
    throw new StellarSubmitError("The Stellar network didn't respond in time.", [], true);
  }
  throw submitErrorFromResult(body.extras ?? {});
}
